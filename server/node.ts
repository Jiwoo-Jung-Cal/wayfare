// Node 24 entry point: `npm run server` (runs TypeScript directly via type stripping).
// Adapts node:http to the web-standard handler in api.ts.

import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createApiHandler } from './api.ts';
import { createAnthropicAdapter, consoleLogger } from './ai/modelAdapter.ts';
import { describeAi, loadConfig } from './config.ts';
import { createWorkspaceRegistry } from './workspaces.ts';

const config = loadConfig();
const adapter = config.ai.provider === 'anthropic' ? createAnthropicAdapter(config.ai) : null;
const handler = createApiHandler({
  config,
  registry: createWorkspaceRegistry({ dataDir: config.dataDir, sessionTtlMs: config.sessionTtlMs }),
  adapter,
  log: consoleLogger,
});

function clientIp(req: import('node:http').IncomingMessage): string | undefined {
  if (config.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? undefined;
}

const server = createServer(async (req, res) => {
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // @ts-expect-error Node's fetch requires duplex for streamed request bodies.
    duplex: 'half',
  });
  const response = await handler(request, { clientIp: clientIp(req) });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(config.port, () => {
  consoleLogger({
    event: 'listening',
    port: config.port,
    ai: describeAi(config.ai),
    persistence: config.dataDir ?? 'memory',
    allowedOrigins: config.allowedOrigins,
  });
});
