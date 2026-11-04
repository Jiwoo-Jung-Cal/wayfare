import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Build provenance (#8): which source commit and mode a build came from, so a hosted
 * or Figma-embedded demo can be mapped to an exact commit. Non-visual: a <meta> tag in
 * index.html and a version.json next to it. WAYFARE_SOURCE_SHA overrides git (CI, or an
 * import without .git); Vercel builds have no .git, so its VERCEL_GIT_COMMIT_SHA is used
 * next; a checkout with uncommitted changes is marked "-dirty".
 */
function buildProvenance(): Plugin {
  const git = (cmd: string) => {
    try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
  };
  let info: { source: string; dirty: boolean; mode: 'sample' | 'connected'; builtAt: string };
  return {
    name: 'wayfare-build-provenance',
    apply: 'build',
    configResolved(config) {
      const explicit = process.env.WAYFARE_SOURCE_SHA?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim();
      const sha = explicit || git('git rev-parse HEAD') || 'unknown';
      const dirty = !explicit && sha !== 'unknown' && git('git status --porcelain --untracked-files=no') !== '';
      const apiUrl = config.env.VITE_WAYFARE_API_URL ?? process.env.VITE_WAYFARE_API_URL ?? '';
      info = { source: sha, dirty, mode: apiUrl ? 'connected' : 'sample', builtAt: new Date().toISOString() };
    },
    transformIndexHtml() {
      const content = `${info.source}${info.dirty ? '-dirty' : ''}; mode=${info.mode}`;
      return [{ tag: 'meta', attrs: { name: 'wayfare-source', content }, injectTo: 'head' }];
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify(info, null, 2)}\n` });
    },
  };
}

// Relative base so the production build can be served from any path
// (static host, Figma Code Layer preview, GitHub Pages) without rewrites.
export default defineConfig({
  base: './',
  plugins: [react(), buildProvenance()],
  build: {
    rolldownOptions: {
      output: {
        // Vendor libraries are ~90% of the bundle and change far less often
        // than app code. Separate chunks keep each under the 500 kB warning
        // and stay cached across app-only deploys. Feature pages are small
        // (~60 kB of source), so per-route lazy loading would not pay for a
        // FeatureModule contract change.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'vendor-router', test: /node_modules[\\/](react-router|cookie|set-cookie-parser)[\\/]/, priority: 20 },
            { name: 'vendor-zod', test: /node_modules[\\/]zod[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    // Vitest's persistent transform cache (default on) keys modules by their own
    // content, so featureRegistry.ts's import.meta.glob kept a stale feature list
    // when a new src/features/<name>/ folder appeared: ReRoute's registration
    // check was silently skipped locally. The suite is small; correctness first.
    fsModuleCache: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
