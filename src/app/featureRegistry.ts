// Discovers feature modules: each owner exports `feature` from
// src/features/<name>/index.ts(x). No shell edit is required to register.

import type { FeatureKey, FeatureModule } from '../core/index.ts';

const modules = import.meta.glob<{ feature?: FeatureModule }>(['../features/*/index.ts', '../features/*/index.tsx'], { eager: true });

export const FEATURES: Partial<Record<FeatureKey, FeatureModule>> = {};
for (const [path, mod] of Object.entries(modules)) {
  if (mod.feature) FEATURES[mod.feature.key] = mod.feature;
  else console.warn(`[wayfare] ${path} does not export "feature"; skipped`);
}

export const ROUTE_TABLE: { path: FeatureModule['path']; key: FeatureKey; title: string; owner: string }[] = [
  { path: 'plan', key: 'wayfinder', title: 'Plan', owner: 'Agent 2 (Wayfinder)' },
  { path: 'import', key: 'intake', title: 'Import bookings', owner: 'Agent 2 (Intake)' },
  { path: 'reroute', key: 'reroute', title: 'ReRoute', owner: 'Agent 4 / Kelvin (ReRoute)' },
  { path: 'wallet', key: 'tripwallet', title: 'TripWallet', owner: 'Agent 5 / Brian (TripWallet)' },
];
