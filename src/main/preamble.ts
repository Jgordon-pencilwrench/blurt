export function extractStreamingVisible(text: string): string {
  // Complete tag block — return trimmed content
  const complete = text.match(/<blurt_output>([\s\S]*?)<\/blurt_output>/)
  if (complete) return complete[1].trim()

  // Inside an open (not yet closed) tag — stream content progressively,
  // but strip any trailing prefix of </blurt_output> to prevent closing tag chars leaking
  const open = text.match(/<blurt_output>([\s\S]*)$/)
  if (open) {
    const closing = '</blurt_output>'
    let content = open[1]
    for (let i = closing.length - 1; i >= 1; i--) {
      if (content.endsWith(closing.slice(0, i))) return content.slice(0, -i)
    }
    return content
  }

  // Partial opening tag still forming — suppress until we know it's complete
  if (text.includes('<blurt_output')) return ''
  const opening = '<blurt_output>'
  for (let i = opening.length - 1; i >= 1; i--) {
    if (text.endsWith(opening.slice(0, i))) return ''
  }

  // No tags at all — fallback: strip think blocks and show whatever we have
  return stripThinkBlocks(text)
}

export function extractBlurtOutput(text: string): string {
  const match = text.match(/<blurt_output>([\s\S]*?)<\/blurt_output>/)
  if (match) return match[1].trim()
  // Fallback: no tags — run the stripping pipeline
  return stripPreamble(stripLLMArtifacts(stripThinkBlocks(text)))
}

export function stripThinkBlocks(text: string): string {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '')
  const partial = stripped.replace(/<think>[\s\S]*$/, '')
  return partial.trimStart()
}

export function stripLLMArtifacts(text: string): string {
  return text.replace(/\[end of text\]/gi, '').trim()
}

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
