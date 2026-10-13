export function memoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: k => void map.delete(k),
    clear: () => map.clear(),
    get length() { return map.size; },
    key: i => [...map.keys()][i] ?? null,
  };
}
