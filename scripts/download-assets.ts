import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import https from 'https'
import fs from 'fs'

const ROOT = join(__dirname, '..')
const BIN_DIR = join(ROOT, 'bin')
const WHISPER_BINARY = join(BIN_DIR, 'whisper-cli')
const WHISPER_MODEL = join(BIN_DIR, 'ggml-base.en.bin')
const WHISPER_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'
const WHISPER_REPO = 'https://github.com/ggerganov/whisper.cpp.git'
const WHISPER_TMP = '/tmp/whisper-cpp-build'

const LLAMA_BINARY = join(BIN_DIR, 'llama-completion')
const LLAMA_REPO = 'https://github.com/ggerganov/llama.cpp.git'
const LLAMA_TMP = '/tmp/llama-cpp-build'

// Dev-only: download default model for local testing
const DEV_MODEL = join(BIN_DIR, 'SmolLM3-Q4_K_M.gguf')
const DEV_MODEL_URL =
  'https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/resolve/main/SmolLM3-Q4_K_M.gguf'

if (!existsSync(BIN_DIR)) mkdirSync(BIN_DIR)

function run(cmd: string, cwd?: string) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd })
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`)
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close()
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', reject)
  })
}

async function main() {
  // Build whisper-cli
  if (!existsSync(WHISPER_BINARY)) {
    console.log('Building whisper.cpp...')
    if (!existsSync(WHISPER_TMP)) {
      run(`git clone --depth 1 ${WHISPER_REPO} ${WHISPER_TMP}`)
    }
    run('cmake -B build -DGGML_METAL=ON -DBUILD_SHARED_LIBS=OFF -DCMAKE_BUILD_TYPE=Release', WHISPER_TMP)
    run('cmake --build build --config Release -j4', WHISPER_TMP)
    run(`cp ${WHISPER_TMP}/build/bin/whisper-cli ${WHISPER_BINARY}`)
    console.log('whisper-cli built successfully.')
  } else {
    console.log('whisper-cli already exists, skipping build.')
  }

  // Download whisper model
  if (!existsSync(WHISPER_MODEL)) {
    await downloadFile(WHISPER_MODEL_URL, WHISPER_MODEL)
    console.log('Whisper model downloaded.')
  } else {
    console.log('Whisper model already exists, skipping download.')
  }

  // Build llama-completion
  if (!existsSync(LLAMA_BINARY)) {
    console.log('Building llama.cpp...')
    if (!existsSync(LLAMA_TMP)) {
      run(`git clone --depth 1 ${LLAMA_REPO} ${LLAMA_TMP}`)
    }
    run('cmake -B build -DGGML_METAL=ON -DBUILD_SHARED_LIBS=OFF -DLLAMA_CURL=OFF -DLLAMA_OPENSSL=OFF -DCMAKE_BUILD_TYPE=Release', LLAMA_TMP)
    run('cmake --build build --config Release -j4', LLAMA_TMP)
    run(`cp ${LLAMA_TMP}/build/bin/llama-completion ${LLAMA_BINARY}`)
    console.log('llama-completion built successfully.')
  } else {
    console.log('llama-completion already exists, skipping build.')
  }

  // Dev-only: download default LLM model for local testing
  if (!existsSync(DEV_MODEL)) {
    console.log('Downloading dev LLM model (this may take a while)...')
    await downloadFile(DEV_MODEL_URL, DEV_MODEL)
    console.log('Dev LLM model downloaded.')
  } else {
    console.log('Dev LLM model already exists, skipping download.')
  }

  console.log('Assets ready.')
}

main().catch((e) => { console.error(e); process.exit(1) })
