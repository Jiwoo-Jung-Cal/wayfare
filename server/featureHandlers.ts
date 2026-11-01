// Only this fixed server entry point is loaded; never a client-selected path.
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { WalletEvidenceHandler } from './walletEvidence.ts';

export async function loadWalletEvidenceHandler(): Promise<WalletEvidenceHandler | null> {
  const entry = new URL('../src/features/tripwallet/server.ts', import.meta.url);
  try { await access(fileURLToPath(entry)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const module = await import(entry.href) as { walletEvidenceHandler?: WalletEvidenceHandler };
  if (typeof module.walletEvidenceHandler?.extract !== 'function') {
    throw new Error('TripWallet server.ts must export walletEvidenceHandler with extract(request, context)');
  }
  return module.walletEvidenceHandler;
}
