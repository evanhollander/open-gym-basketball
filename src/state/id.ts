// crypto.randomUUID() needs a secure context (https, or localhost) and isn't
// available on older iOS Safari (< 15.4). Since this app is meant to be used
// courtside on phones, fall back to a simple random id instead of assuming
// the newer API is always there.
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
