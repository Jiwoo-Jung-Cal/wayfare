// Public shared imports for every feature module and the server.
// Import from 'src/core/index.ts' (relative path), not from internal files,
// so internals can move without breaking consumers.

export * from './result.ts';
export * from './money.ts';
export * from './time.ts';
export * from './ids.ts';
export * from './schema.ts';
export type * from './repository.ts';
export * from './feature.ts';
export { StoreRepository, normalizeReference, type SnapshotPersistence } from './store/storeRepository.ts';
export {
  createLocalRepository,
  getOrCreateLocalWorkspaceId,
  memoryStorage,
  storagePersistence,
  workspaceStorageKey,
  ACTIVE_WORKSPACE_KEY,
  type KeyValueStorage,
} from './store/localRepository.ts';
export * from './fixtures/demoNyc.ts';
export { buildDemoSnapshot, emptySnapshot } from './fixtures/seed.ts';
export * as sampleDocuments from './fixtures/documents.ts';
export * from './extraction.ts';
export {
  SAMPLE_RAW_EXTRACTIONS,
  createSampleExtractionService,
  fixtureForHash,
  sampleExtractBooking,
} from './fixtures/sampleExtractions.ts';
export {
  createHttpExtractionService,
  createHttpRepository,
  fetchHealth,
  forgetGuestSession,
  getOrCreateGuestSession,
  type ApiClientOptions,
  type FetchLike,
  type ServerHealth,
} from './http/httpClient.ts';
