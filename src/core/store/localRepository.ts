// Sample-mode repository: this visitor's workspace persisted in browser storage.
// Survives reload in the same browser profile; never shared with other visitors.

import { newId, type Id } from '../ids.ts';
import { err, ok, type Result } from '../result.ts';
import { toInstant } from '../time.ts';
import type { WorkspaceSnapshot } from '../schema.ts';
import type { DemoSeedStage } from '../repository.ts';
import { buildDemoSnapshot } from '../fixtures/seed.ts';
import { StoreRepository, type SnapshotPersistence } from './storeRepository.ts';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const ACTIVE_WORKSPACE_KEY = 'wayfare:v1:active-workspace';
export const workspaceStorageKey = (workspaceId: Id) => `wayfare:v1:workspace:${workspaceId}`;

// Non-browser storage (tests) shares a queue by storage identity and workspace.
// Real browsers MUST use origin-wide Web Locks, never a tab-local substitute.
const memoryQueues = new WeakMap<KeyValueStorage, Map<string, Promise<unknown>>>();

function storageLock(storage: KeyValueStorage, key: string): NonNullable<SnapshotPersistence['withExclusive']> {
  return async <T>(operation: () => Promise<Result<T>>): Promise<Result<T>> => {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (locks) {
      try {
        return await locks.request(key, { mode: 'exclusive' }, operation);
      } catch {
        return err('unavailable', 'Could not acquire the shared browser workspace lock');
      }
    }
    if (typeof window !== 'undefined') {
      return err('unsupported', 'Safe browser persistence requires Web Locks in a secure browser context');
    }
    let queues = memoryQueues.get(storage);
    if (!queues) { queues = new Map(); memoryQueues.set(storage, queues); }
    const previous = queues.get(key) ?? Promise.resolve();
    const run = previous.then(operation, operation);
    queues.set(key, run.catch(() => undefined));
    return run;
  };
}

/** The workspace ID for this browser, created on first visit. */
export function getOrCreateLocalWorkspaceId(storage: KeyValueStorage): Id {
  const existing = storage.getItem(ACTIVE_WORKSPACE_KEY);
  if (existing) return existing;
  const id = newId('workspace');
  storage.setItem(ACTIVE_WORKSPACE_KEY, id);
  return id;
}

export function storagePersistence(storage: KeyValueStorage, workspaceId: Id): SnapshotPersistence {
  const key = workspaceStorageKey(workspaceId);
  if (typeof window !== 'undefined' && storage === window.localStorage) {
    // localStorage's per-renderer cache may lag another tab even after a Web
    // Lock is released. IndexedDB reads see committed transactions across tabs.
    return indexedDbPersistence(storage, key);
  }
  return {
    withExclusive: storageLock(storage, key),
    async load(): Promise<Result<WorkspaceSnapshot | null>> {
      const raw = storage.getItem(key);
      if (raw === null) return ok(null);
      try {
        return ok(JSON.parse(raw) as WorkspaceSnapshot);
      } catch {
        return err('validation_failed', 'Stored workspace data is not valid JSON; reset the demo workspace', { retryable: false });
      }
    },
    async save(snapshot) {
      try {
        storage.setItem(key, JSON.stringify(snapshot));
        return ok(undefined);
      } catch (e) {
        return err('unavailable', `Browser storage write failed: ${(e as Error).message}`);
      }
    },
  };
}

function indexedDbPersistence(legacyStorage: KeyValueStorage, key: string): SnapshotPersistence {
  let opening: Promise<IDBDatabase> | null = null;
  const database = () => opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is unavailable')); return; }
    const request = indexedDB.open('wayfare-v1', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('workspaces')) request.result.createObjectStore('workspaces');
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = null; };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open browser storage'));
    request.onblocked = () => reject(new Error('Browser storage upgrade is blocked'));
  }).catch(error => { opening = null; throw error; });

  return {
    withExclusive: storageLock(legacyStorage, key),
    async load() {
      try {
        const db = await database();
        const value = await new Promise<WorkspaceSnapshot | undefined>((resolve, reject) => {
          const tx = db.transaction('workspaces', 'readonly');
          const request = tx.objectStore('workspaces').get(key);
          let data: WorkspaceSnapshot | undefined;
          request.onsuccess = () => { data = request.result as WorkspaceSnapshot | undefined; };
          tx.oncomplete = () => resolve(data);
          tx.onabort = () => reject(tx.error ?? new Error('Browser storage read aborted'));
          tx.onerror = () => reject(tx.error ?? new Error('Browser storage read failed'));
        });
        if (value !== undefined) return ok(value);
        // Preserve pre-upgrade sample workspaces. The next mutation commits
        // this legacy snapshot into the canonical IndexedDB store.
        const legacy = legacyStorage.getItem(key);
        return ok(legacy === null ? null : JSON.parse(legacy) as WorkspaceSnapshot);
      } catch {
        return err('unavailable', 'Could not read the browser workspace database');
      }
    },
    async save(snapshot) {
      try {
        const db = await database();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('workspaces', 'readwrite');
          tx.objectStore('workspaces').put(snapshot, key);
          // Do not release the Web Lock at request success: wait for COMMIT.
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error ?? new Error('Browser storage write aborted'));
          tx.onerror = () => reject(tx.error ?? new Error('Browser storage write failed'));
        });
        return ok(undefined);
      } catch {
        return err('unavailable', 'Could not commit the browser workspace database');
      }
    },
  };
}

export function createLocalRepository(opts: {
  storage: KeyValueStorage;
  workspaceId: Id;
  initialStage?: DemoSeedStage;
  now?: () => Date;
}): StoreRepository {
  const now = opts.now ?? (() => new Date());
  return new StoreRepository({
    capabilities: {
      mode: 'sample',
      persistence: 'browser_local',
      durable: true,
      description: 'Sample mode: fictional data saved in this browser only. Provider actions are simulated.',
    },
    persistence: storagePersistence(opts.storage, opts.workspaceId),
    initial: () =>
      buildDemoSnapshot(
        { id: opts.workspaceId, mode: 'sample', label: 'Sample workspace (this browser)', createdAt: toInstant(now()) },
        opts.initialStage ?? 'planning',
      ),
  });
}

/** In-memory storage for tests and non-browser runtimes. */
export function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
