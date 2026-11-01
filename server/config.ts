// Server configuration from environment variables. Secrets stay server-side;
// nothing here is ever sent to the browser except the non-secret summary in /api/health.

export type AiConfig =
  | { provider: 'none'; reason: string }
  | {
      provider: 'anthropic';
      apiKey: string;
      baseURL: string;
      model: string;
      effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
      timeoutMs: number;
      maxInputChars: number;
    };

export type ServerConfig = {
  port: number;
  /** Exact browser origins allowed by CORS (e.g. http://localhost:5173 and the Figma preview origin). */
  allowedOrigins: string[];
  /** Directory for workspace JSON files; null = in-memory (tests). */
  dataDir: string | null;
  maxBodyBytes: number;
  ai: AiConfig;
};

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const provider = (env.WAYFARE_AI_PROVIDER ?? 'anthropic').trim();
  const apiKey = env.WAYFARE_ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
  let ai: AiConfig;
  if (provider === 'none') ai = { provider: 'none', reason: 'WAYFARE_AI_PROVIDER=none' };
  else if (provider !== 'anthropic') ai = { provider: 'none', reason: `Unsupported WAYFARE_AI_PROVIDER "${provider}"` };
  else if (!apiKey) ai = { provider: 'none', reason: 'No ANTHROPIC_API_KEY (or WAYFARE_ANTHROPIC_API_KEY) configured on the server' };
  else {
    const effort = (env.WAYFARE_AI_EFFORT ?? 'medium') as (typeof EFFORTS)[number];
    ai = {
      provider: 'anthropic',
      apiKey,
      // Explicit so the server never inherits an unrelated ANTHROPIC_BASE_URL from the shell.
      baseURL: env.WAYFARE_ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
      model: env.WAYFARE_AI_MODEL ?? 'claude-opus-5-5',
      effort: EFFORTS.includes(effort) ? effort : 'medium',
      timeoutMs: Number(env.WAYFARE_AI_TIMEOUT_MS ?? 60_000),
      maxInputChars: Number(env.WAYFARE_AI_MAX_INPUT_CHARS ?? 20_000),
    };
  }
  return {
    port: Number(env.PORT ?? 8787),
    allowedOrigins: (env.WAYFARE_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    dataDir: env.WAYFARE_DATA_DIR === 'memory' ? null : (env.WAYFARE_DATA_DIR ?? '.data'),
    maxBodyBytes: Number(env.WAYFARE_MAX_BODY_BYTES ?? 512_000),
    ai,
  };
}

/** Non-secret summary for /api/health and logs. */
export function describeAi(ai: AiConfig) {
  return ai.provider === 'none'
    ? { configured: false, provider: 'none', reason: ai.reason }
    : { configured: true, provider: ai.provider, model: ai.model, effort: ai.effort };
}
