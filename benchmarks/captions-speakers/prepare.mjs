// Joins the transcription benchmark's long pieces into one recording per language, about 10 min each,
// and both three times into an hour for the speakers
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const SOURCE = '../transcription/data'

const wavOf = (pcm) => {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(16000, 24)
  header.writeUInt32LE(32000, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

const recordings = []
for (const set of ['chinese', 'english']) {
  const clips = JSON.parse(readFileSync(`${SOURCE}/${set}/clips.json`, 'utf8'))
  const pieces = readdirSync(`${SOURCE}/${set}`).filter((name) => name.startsWith('long-') && name.endsWith('.wav')).sort()
  const pcm = Buffer.concat(pieces.map((name) => readFileSync(`${SOURCE}/${set}/${name}`).subarray(44)))
  writeFileSync(`data/${set}.wav`, wavOf(pcm))
  recordings.push(pcm)
  const text = pieces.map((name) => clips.find(({ id }) => `${id}.wav` === name).text).join(' ')
  writeFileSync(`data/${set}.txt`, text)
  console.log(set, pieces.length, 'pieces', Math.round(pcm.length / 32000), 's')
}
writeFileSync('data/hour.wav', wavOf(Buffer.concat([...recordings, ...recordings, ...recordings])))
