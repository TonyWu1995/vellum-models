// Converts CN-Celeb eval clips (flac) to 16 kHz mono float32 files: node cnceleb.mjs <flac folder> <out folder>
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { promisify } from 'node:util'
import ffmpeg from 'ffmpeg-static'

const [src, out] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const run = promisify(execFile)
const files = readdirSync(src).filter((f) => f.endsWith('.flac'))
let next = 0
const worker = async () => {
  while (next < files.length) {
    const file = files[next++]
    const dest = `${out}/${file.replace('.flac', '.f32')}`
    if (!existsSync(dest)) {
      await run(ffmpeg, ['-v', 'error', '-i', `${src}/${file}`, '-ac', '1', '-ar', '16000', '-f', 'f32le', dest])
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
console.log('clips', files.length)
