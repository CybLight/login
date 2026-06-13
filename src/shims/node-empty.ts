/** Browser stub for Node built-ins referenced by curveasm (Emscripten). */
export default {};

export const dirname = (): string => '';
export const join = (...parts: string[]): string => parts.join('/');
export const resolve = (...parts: string[]): string => parts.join('/');
export const readFileSync = (): never => {
  throw new Error('fs is not available in the browser');
};
