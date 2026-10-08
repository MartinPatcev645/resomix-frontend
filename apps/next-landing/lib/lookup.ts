/** Walk a dotted key path on a JSON message tree. */
export function lookup(root: unknown, path: string): string {
  const value = read(root, path)
  if (typeof value !== 'string') {
    throw new Error(`Missing translation string: ${path}`)
  }
  return value
}

export function lookupValue<T>(root: unknown, path: string): T {
  const value = read(root, path)
  if (value === undefined) {
    throw new Error(`Missing translation: ${path}`)
  }
  return value as T
}

function read(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, root)
}
