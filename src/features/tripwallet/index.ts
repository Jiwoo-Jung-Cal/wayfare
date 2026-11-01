import type { FeatureModule } from '../../core/index.ts';
import { TripWalletPage } from './page.tsx';
import { syncClaimsFromActions } from './ledger.ts';
export * from './ledger.ts';
export * from './evidence.ts';
export const feature: FeatureModule = { key: 'tripwallet', title: 'TripWallet', path: 'wallet', Page: TripWalletPage, syncClaimsFromActions };
