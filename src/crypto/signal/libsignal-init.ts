import { setCurve } from '@privacyresearch/libsignal-protocol-typescript';

type LibsignalInitResult = { Curve: unknown };

type LibsignalInitFn = () => Promise<LibsignalInitResult>;

/** Unwrap Vite/Rolldown CJS default export (`mod.default.default`). */
function resolveLibsignalInit(mod: Record<string, unknown>): LibsignalInitFn {
  const top = mod.default;

  if (typeof top === 'function') {
    return top as LibsignalInitFn;
  }

  if (top && typeof top === 'object') {
    const nested = (top as Record<string, unknown>).default;
    if (typeof nested === 'function') {
      return nested as LibsignalInitFn;
    }
  }

  throw new Error('libsignal_init_unavailable');
}

let initPromise: Promise<void> | null = null;

export async function ensureLibsignalInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const mod = await import('@privacyresearch/libsignal-protocol-typescript');
      const initFn = resolveLibsignalInit(mod as Record<string, unknown>);
      const { Curve } = await initFn();
      setCurve(Curve as Parameters<typeof setCurve>[0]);
    })();
  }
  await initPromise;
}
