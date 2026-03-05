const PREAMBLE_STARTERS = [
  'here',
  'sure',
  'of course',
  'certainly',
  'absolutely',
  'below',
  'the following',
  'alright',
]

export function stripPreamble(text: string): string {
  const trimmed = text.trimStart()
  if (!trimmed) return trimmed

  const match = trimmed.match(/^([^\n]{1,120}):\s*\n+/)
  if (!match) return trimmed

  const firstLine = match[1].toLowerCase()
  if (PREAMBLE_STARTERS.some((s) => firstLine.startsWith(s))) {
    return trimmed.slice(match[0].length).trimStart()
  }
  return trimmed
}
