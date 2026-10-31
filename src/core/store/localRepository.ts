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
  return {
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
