import type { FeatureModule } from '../../core/index.ts';
import { ReRoutePage } from './page.tsx';
import { triggerDemoDisruption } from './model.ts';
export const feature: FeatureModule = { key: 'reroute', path: 'reroute', title: 'ReRoute', Page: ReRoutePage, triggerDemoDisruption };
