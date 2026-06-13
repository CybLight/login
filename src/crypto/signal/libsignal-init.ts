import initWasm, { init } from '@getmaapp/signal-wasm';

let initPromise: Promise<void> | null = null;

export async function ensureLibsignalInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initWasm().then(() => {
      init();
    });
  }
  await initPromise;
}
