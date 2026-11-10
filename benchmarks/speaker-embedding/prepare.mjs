// Converts every clip to 16 kHz mono float32 samples, the format the models read,
// named <speaker>-<recording>-<n> so score.mjs can tell speakers and recordings apart
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import ffmpeg from 'ffmpeg-static'
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet'

function toSamples(input, output) {
  return new Promise((resolve, reject) => {
    const fromFile = typeof input === 'string'
    const ffmpegArgs = ['-v', 'error', '-y', '-i', fromFile ? input : 'pipe:0']
    const child = spawn(ffmpeg, [...ffmpegArgs, '-ac', '1', '-ar', '16000', '-f', 'f32le', output])
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed on ${output}`))))
    if (!fromFile) child.stdin.end(input)
  })
}

async function inParallel(items, work) {
  let next = 0
  const worker = async () => {
    while (next < items.length) await work(items[next++])
  }
  await Promise.all(Array.from({ length: 8 }, worker))
}

async function prepareChinese() {
  mkdirSync('data/chinese', { recursive: true })
  const clips = readdirSync('data/chinese-flac').filter((f) => f.endsWith('.flac'))
  await inParallel(clips, async (clip) => {
    const output = `data/chinese/${clip.replace('.flac', '.f32')}`
    if (!existsSync(output)) await toSamples(`data/chinese-flac/${clip}`, output)
  })
  console.log('chinese clips', clips.length)
}

async function prepareEnglish() {
  mkdirSync('data/english', { recursive: true })
  let count = 0
  for (const parquet of readdirSync('data/english-parquet').filter((f) => f.endsWith('.parquet'))) {
    const file = await asyncBufferFromFile(`data/english-parquet/${parquet}`)
    const rows = await parquetReadObjects({ file, utf8: false })
    await inParallel(rows, async ({ id, audio }) => {
      const output = `data/english/${id.replace('.wav', '').replaceAll('+', '-')}.f32`
      if (!existsSync(output)) await toSamples(audio.bytes, output)
    })
    count += rows.length
  }
  console.log('english clips', count)
}

await prepareChinese()
await prepareEnglish()
