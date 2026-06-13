import { Curve25519Wrapper } from '@privacyresearch/curve25519-typescript';

let initPromise: Promise<void> | null = null;

/**
 * Warm up Curve25519 WASM. Do not call setCurve() — the library already uses
 * AsyncCurve25519Wrapper internally; passing the public Curve wrapper breaks keyPair().
 */
export async function ensureLibsignalInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = Curve25519Wrapper.create().then(() => undefined);
  }
  await initPromise;
}
