// Guest sessions and per-workspace repositories (server side).
//
// POST /api/session creates a random bearer token bound to a new workspace.
// Only the SHA-256 of the token is stored. Every repository call is served by
// the StoreRepository of the token's workspace, so one session can never read
// or reset another session's records. Persistence is one JSON file per
// workspace (or memory for tests). This is suitable for the demo, not for scale.

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  StoreRepository,
  buildDemoSnapshot,
  err,
  newId,
  ok,
  sha256Hex,
  toInstant,
  type Id,
  type Result,
  type SnapshotPersistence,
  type WorkspaceSnapshot,
} from '../src/core/index.ts';

type SessionIndex = Record<string, { workspaceId: Id; createdAt: string }>;

export interface WorkspaceRegistry {
  createSession(): Promise<Result<{ token: string; workspaceId: Id }>>;
  /** Resolve a bearer token to its workspace repository. */
  repositoryFor(token: string): Promise<Result<{ workspaceId: Id; repo: StoreRepository }>>;
  readonly persistence: 'memory' | 'file';
}

function memoryPersistence(): SnapshotPersistence {
  let data: WorkspaceSnapshot | null = null;
  return {
    load: async () => ok(data ? structuredClone(data) : null),
    save: async (s) => {
      data = structuredClone(s);
      return ok(undefined);
    },
  };
}

function filePersistence(path: string): SnapshotPersistence {
  return {
    async load() {
      try {
        return ok(JSON.parse(await readFile(path, 'utf8')) as WorkspaceSnapshot);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ok(null);
        return err('internal', 'Stored workspace file could not be read');
      }
    },
    async save(s) {
      try {
        const tmp = `${path}.${randomUUID()}.tmp`;
        await writeFile(tmp, JSON.stringify(s));
        await rename(tmp, path);
        return ok(undefined);
      } catch {
        return err('unavailable', 'Server storage write failed');
      }
    },
  };
}

export function createWorkspaceRegistry(opts: { dataDir: string | null; now?: () => Date }): WorkspaceRegistry {
  const now = opts.now ?? (() => new Date());
  const repos = new Map<Id, StoreRepository>();
  let sessions: SessionIndex | null = null;
  const sessionsPath = opts.dataDir ? join(opts.dataDir, 'sessions.json') : null;

  // Memoized so concurrent callers share ONE index object (a second load would drop new entries).
  let loading: Promise<SessionIndex> | null = null;
  function loadSessions(): Promise<SessionIndex> {
    loading ??= (async () => {
      if (!sessionsPath) return (sessions = {});
      try {
        sessions = JSON.parse(await readFile(sessionsPath, 'utf8')) as SessionIndex;
      } catch {
        sessions = {};
      }
      return sessions;
    })();
    return loading;
  }

  // Session-index writes are serialized; concurrent renames onto one file fail on Windows.
  let sessionWrites: Promise<void> = Promise.resolve();
  function saveSessions(): Promise<void> {
    const run = sessionWrites.then(async () => {
      if (!sessionsPath || !opts.dataDir) return;
      await mkdir(opts.dataDir, { recursive: true });
      const tmp = `${sessionsPath}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(sessions));
      await rename(tmp, sessionsPath);
    });
    sessionWrites = run.catch(() => undefined);
    return run;
  }

  function repoFor(workspaceId: Id, createdAt: string): StoreRepository {
    let repo = repos.get(workspaceId);
    if (!repo) {
      repo = new StoreRepository({
        capabilities: {
          mode: 'connected',
          persistence: 'server',
          durable: opts.dataDir !== null,
          description: 'Connected mode: workspace stored on the WayFare server for this guest session. Provider actions remain simulated.',
        },
        persistence: opts.dataDir ? filePersistence(join(opts.dataDir, `${workspaceId}.json`)) : memoryPersistence(),
        initial: () => buildDemoSnapshot({ id: workspaceId, mode: 'connected', label: 'Guest workspace', createdAt: createdAt }, 'planning'),
      });
      repos.set(workspaceId, repo);
    }
    return repo;
  }

  return {
    persistence: opts.dataDir ? 'file' : 'memory',
    async createSession() {
      try {
        if (opts.dataDir) await mkdir(opts.dataDir, { recursive: true });
        const index = await loadSessions();
        const token = randomBytes(32).toString('base64url');
        const workspaceId = newId('workspace');
        const createdAt = toInstant(now());
        index[await sha256Hex(token)] = { workspaceId, createdAt };
        await saveSessions();
        // Materialize the workspace now so the first read is fast and errors surface here.
        const snap = await repoFor(workspaceId, createdAt).getWorkspace();
        if (!snap.ok) return snap;
        return ok({ token, workspaceId });
      } catch {
        return err('unavailable', 'Could not create a guest session');
      }
    },
    async repositoryFor(token) {
      if (!token) return err('unauthorized', 'Missing session token; create a guest session first', { retryable: false });
      const entry = (await loadSessions())[await sha256Hex(token)];
      if (!entry) return err('unauthorized', 'Unknown or expired session token', { retryable: false });
      return ok({ workspaceId: entry.workspaceId, repo: repoFor(entry.workspaceId, entry.createdAt) });
    },
  };
}
