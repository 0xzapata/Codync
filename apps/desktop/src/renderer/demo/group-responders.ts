/** Mirrors host/src/chat/group.rs; the demo has no provider-backed room rounds. */
export function groupResponders(
  members: readonly { id: string; name: string }[],
  text: string,
  rootAuthor?: string,
): string[] {
  if (mentions(text, 'all') || mentions(text, 'everyone')) return members.map((m) => m.id)
  const named = members.filter((m) => {
    const name = m.name.trim().toLowerCase()
    const handles = [name, name.replace(/\s+/g, ''), name.split(/\s+/)[0]!]
    return handles.some((handle) => handle.length > 0 && mentions(text, handle))
  })
  if (named.length) return named.map((m) => m.id)
  if (rootAuthor && members.some((m) => m.id === rootAuthor)) return [rootAuthor]
  return members.map((m) => m.id)
}

function mentions(text: string, handle: string): boolean {
  const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`@${escaped}(?![a-z0-9_])`).test(text.toLowerCase())
}
