const OLLAMA_URL = 'http://localhost:11434/api/generate'
const MODEL = 'llama3.2:3b'

export async function* summarize(rawText: string, systemPrompt: string): AsyncGenerator<string> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${systemPrompt}\n\nTranscription:\n${rawText}`,
      stream: true,
    }),
  })

  if (!response.ok) throw new Error(`Ollama error: ${response.status}`)
  if (!response.body) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of response.body as any) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const data = JSON.parse(line)
      if (data.response) yield data.response
      if (data.done) return
    }
  }
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/', { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

export async function pullModel(onProgress: (status: string) => void): Promise<void> {
  const response = await fetch('http://localhost:11434/api/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: MODEL, stream: true }),
  })
  const decoder = new TextDecoder()
  for await (const chunk of response.body as any) {
    const line = decoder.decode(chunk)
    try {
      const data = JSON.parse(line)
      if (data.status) onProgress(data.status)
    } catch { /* ignore partial lines */ }
  }
}
