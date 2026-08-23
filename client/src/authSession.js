export function mergeAuthSession(prev, data) {
  return { ...prev, ...data, ready: true };
}
