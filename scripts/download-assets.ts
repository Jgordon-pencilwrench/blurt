import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import https from 'https'
import fs from 'fs'

const ROOT = join(__dirname, '..')
const BIN_DIR = join(ROOT, 'bin')
const WHISPER_BINARY = join(BIN_DIR, 'whisper-cli')
const WHISPER_MODEL = join(BIN_DIR, 'ggml-base.en.bin')
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'
const WHISPER_REPO = 'https://github.com/ggerganov/whisper.cpp.git'
const TMP_DIR = '/tmp/whisper-cpp-build'

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
  if (!existsSync(WHISPER_BINARY)) {
    console.log('Building whisper.cpp...')
    if (!existsSync(TMP_DIR)) {
      run(`git clone --depth 1 ${WHISPER_REPO} ${TMP_DIR}`)
    }
    run('cmake -B build -DGGML_METAL=ON', TMP_DIR)
    run('cmake --build build --config Release -j4', TMP_DIR)
    run(`cp ${TMP_DIR}/build/bin/whisper-cli ${WHISPER_BINARY}`)
    console.log('whisper-cli built successfully.')
  } else {
    console.log('whisper-cli already exists, skipping build.')
  }

  if (!existsSync(WHISPER_MODEL)) {
    await downloadFile(MODEL_URL, WHISPER_MODEL)
    console.log('Model downloaded.')
  } else {
    console.log('Model already exists, skipping download.')
  }

  console.log('Assets ready.')
}

main().catch((e) => { console.error(e); process.exit(1) })
