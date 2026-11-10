// Scores embeddings the way Vellum matches speakers: node score.mjs <embeddings.json>...
// A clip is named <speaker>-<recording...>-<n>. A voiceprint averages one recording's clips until they reach 10 s,
// and only voiceprints from different recordings are compared, as Vellum compares a new transcript with earlier ones.
import { readFileSync } from 'node:fs'

const MIN_SECONDS = 10
const THRESHOLDS = [0.4, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8]

const normalize = (v) => {
  const length = Math.hypot(...v)
  return v.map((x) => x / length)
}
const average = (vectors) =>
  normalize(vectors.map(normalize).reduce((sum, v) => sum.map((x, i) => x + v[i])))
const similarity = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0)

function voiceprints(clips) {
  const recordings = new Map()
  for (const [name, clip] of Object.entries(clips)) {
    const recording = name.split('-').slice(0, -1).join('-')
    if (!recordings.has(recording)) recordings.set(recording, [])
    recordings.get(recording).push(clip)
  }
  const prints = []
  for (const [recording, list] of recordings) {
    let group = []
    let seconds = 0
    for (const clip of list) {
      group.push(clip.embedding)
      seconds += clip.seconds
      if (seconds >= MIN_SECONDS) {
        prints.push({ speaker: recording.split('-')[0], recording, voiceprint: average(group) })
        group = []
        seconds = 0
      }
    }
  }
  return prints
}

function pairScores(prints) {
  const same = []
  const different = []
  for (let i = 0; i < prints.length; i++) {
    for (let j = i + 1; j < prints.length; j++) {
      if (prints[i].recording === prints[j].recording) continue
      const score = similarity(prints[i].voiceprint, prints[j].voiceprint)
      if (prints[i].speaker === prints[j].speaker) same.push(score)
      else different.push(score)
    }
  }
  return { same, different }
}

const missRate = (same, threshold) => same.filter((s) => s < threshold).length / same.length
const wrongRate = (different, threshold) =>
  different.filter((s) => s >= threshold).length / different.length

function equalErrorRate({ same, different }) {
  let best = { gap: Infinity }
  for (let threshold = -1; threshold <= 1; threshold += 0.005) {
    const miss = missRate(same, threshold)
    const wrong = wrongRate(different, threshold)
    if (Math.abs(miss - wrong) < best.gap) {
      best = { gap: Math.abs(miss - wrong), rate: (miss + wrong) / 2, threshold }
    }
  }
  return best
}

if (equalErrorRate({ same: [0.9, 0.8], different: [0.1, 0.2] }).rate !== 0) {
  throw new Error('equalErrorRate self-check failed')
}

const percent = (x) => `${(x * 100).toFixed(1)}%`
for (const file of process.argv.slice(2)) {
  const prints = voiceprints(JSON.parse(readFileSync(file, 'utf8')))
  const scores = pairScores(prints)
  const eer = equalErrorRate(scores)
  const speakers = new Set(prints.map((p) => p.speaker)).size
  console.log(`\n${file.split(/[\\/]/).pop()}`)
  console.log(
    `${prints.length} voiceprints, ${speakers} speakers, ` +
      `${scores.same.length} same / ${scores.different.length} different pairs, ` +
      `EER ${percent(eer.rate)} at ${eer.threshold.toFixed(2)}`
  )
  console.log('threshold\tmissed\twrong')
  for (const threshold of THRESHOLDS) {
    const missed = percent(missRate(scores.same, threshold))
    const wrong = percent(wrongRate(scores.different, threshold))
    console.log(`${threshold}\t${missed}\t${wrong}`)
  }
}
