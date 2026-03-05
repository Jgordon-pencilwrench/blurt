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

export interface WhisperModel {
  id: string
  name: string
  filename: string
  size: string
  sizeBytes: number
  url: string
  description: string
  bundled: boolean
}

export const WHISPER_CATALOG: WhisperModel[] = [
  {
    id: 'tiny.en',
    name: 'Whisper Tiny',
    filename: 'ggml-tiny.en.bin',
    size: '75 MB',
    sizeBytes: 75_000_000,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
    description: 'Fastest. Best for short dictation in Message, Quick Note, and Agent modes.',
    bundled: false,
  },
  {
    id: 'base.en',
    name: 'Whisper Base',
    filename: 'ggml-base.en.bin',
    size: '148 MB',
    sizeBytes: 148_000_000,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
    description: 'Bundled default. Good balance of speed and accuracy.',
    bundled: true,
  },
  {
    id: 'small.en',
    name: 'Whisper Small',
    filename: 'ggml-small.en.bin',
    size: '466 MB',
    sizeBytes: 466_000_000,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
    description: 'Better accuracy than base.en with moderate speed.',
    bundled: false,
  },
  {
    id: 'medium.en',
    name: 'Whisper Medium',
    filename: 'ggml-medium.en.bin',
    size: '1.5 GB',
    sizeBytes: 1_528_000_000,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
    description: 'Highest accuracy. Recommended for Meeting mode.',
    bundled: false,
  },
]

export function getWhisperModelById(id: string): WhisperModel | undefined {
  return WHISPER_CATALOG.find((m) => m.id === id)
}
