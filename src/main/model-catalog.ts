export type ChatTemplate = 'llama3' | 'chatml'

export interface ModelOption {
  id: string
  name: string
  description: string
  size: string
  sizeBytes: number
  speed: string
  url: string
  filename: string
  recommended: boolean
  chatTemplate: ChatTemplate
}

export const MODEL_CATALOG: ModelOption[] = [
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B',
    description: 'Lightweight and fast. Good for quick notes and simple text cleanup.',
    size: '0.8 GB',
    sizeBytes: 800_000_000,
    speed: 'Fastest',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    recommended: false,
    chatTemplate: 'llama3',
  },
  {
    id: 'smollm3-3b',
    name: 'SmolLM3 3B',
    description: 'Best balance of speed and quality. Outperforms larger models at a fraction of the size.',
    size: '1.9 GB',
    sizeBytes: 1_915_305_312,
    speed: 'Fast',
    url: 'https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/resolve/main/SmolLM3-Q4_K_M.gguf',
    filename: 'SmolLM3-Q4_K_M.gguf',
    recommended: true,
    chatTemplate: 'chatml',
  },
  {
    id: 'qwen3-4b',
    name: 'Qwen3 4B',
    description: 'Most capable. Excellent for complex prompts and detailed summaries.',
    size: '2.5 GB',
    sizeBytes: 2_497_280_256,
    speed: 'Fast',
    url: 'https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf',
    filename: 'Qwen3-4B-Q4_K_M.gguf',
    recommended: false,
    chatTemplate: 'chatml',
  },
]

export function getModelById(id: string): ModelOption | undefined {
  return MODEL_CATALOG.find((m) => m.id === id)
}

export function getDefaultModel(): ModelOption {
  return MODEL_CATALOG.find((m) => m.recommended)!
}
