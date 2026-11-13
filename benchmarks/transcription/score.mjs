// Scores every transcript in data/transcripts: Chinese by characters (CER), English by words (WER)
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import * as OpenCC from 'opencc-js'
import models from './models.json' with { type: 'json' }

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' })
const ZH_DIGITS = '零一二三四五六七八九'
const EN_ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ')
const EN_TENS = ' ten twenty thirty forty fifty sixty seventy eighty ninety'.split(' ')

// AISHELL writes numbers in characters; a model's digits are read the usual way: years digit by digit
function chineseNumber(digits) {
  if (digits.length >= 4 || digits.startsWith('0')) return [...digits].map((d) => ZH_DIGITS[d]).join('')
  const n = Number(digits)
  if (n < 10) return ZH_DIGITS[n]
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const ones = n % 10
  let out = hundreds ? `${ZH_DIGITS[hundreds]}百` : ''
  if (tens) out += `${hundreds || tens > 1 ? ZH_DIGITS[tens] : ''}十`
  else if (hundreds && ones) out += '零'
  if (ones) out += ZH_DIGITS[ones]
  return out
}

function englishNumber(n) {
  if (n < 20) return EN_ONES[n]
  if (n < 100) return `${EN_TENS[Math.floor(n / 10)]}${n % 10 ? ` ${EN_ONES[n % 10]}` : ''}`
  if (n < 1000) return `${EN_ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${englishNumber(n % 100)}` : ''}`
  return `${englishNumber(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${englishNumber(n % 1000)}` : ''}`
}

const NORMALIZE = {
  chinese: (text) =>
    [
      ...toSimplified(text)
        .toLowerCase()
        .replace(/(\d+)%/g, '百分之$1')
        .replace(/\d+/g, chineseNumber)
        .replace(/[^\p{Script=Han}a-z]/gu, '')
    ],
  english: (text) =>
    text
      .toLowerCase()
      .replace(/(\d),(\d)/g, '$1$2')
      .replace(/\d+/g, (digits) => ` ${englishNumber(Number(digits))} `)
      .replace(/[^a-z' ]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
}

function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

const seconds = (set, id) => (statSync(`data/${set}/${id}.wav`).size - 44) / 32000
const percent = (errors, total) => `${((100 * errors) / total).toFixed(1)}%`

function score(set, transcript, clips) {
  const groups = {}
  let audio = 0
  let busy = 0
  for (const clip of clips) {
    const found = transcript.results.find(({ id }) => id === clip.id)
    const reference = NORMALIZE[set](clip.text)
    const group = (groups[clip.length] ??= { errors: 0, total: 0, failed: 0 })
    group.errors += editDistance(reference, NORMALIZE[set](found.text))
    group.total += reference.length
    if (found.error || !found.text.trim()) group.failed += 1
    audio += seconds(set, clip.id)
    busy += found.ms
  }
  const timings = [...new Set(transcript.results.map(({ timing }) => timing).filter(Boolean))]
  return { groups, rtf: busy / 1000 / audio, timings }
}

mkdirSync('results', { recursive: true })
for (const set of ['chinese', 'english']) {
  const clips = JSON.parse(readFileSync(`data/${set}/clips.json`, 'utf8'))
  const lengths = [...new Set(clips.map(({ length }) => length))]
  const unit = set === 'chinese' ? 'CER' : 'WER'
  const lines = [
    `| Model | Device | ${lengths.map((length) => `${unit} ${length}`).join(' | ')} | Speed (RTF) | Load | Peak memory | Times |`,
    `| --- | --- | ${lengths.map(() => '---').join(' | ')} | --- | --- | --- | --- |`
  ]
  for (const model of models) {
    for (const device of ['cpu', 'gpu']) {
      const path = `data/transcripts/${model.id}-${device}-${set}.json`
      if (!existsSync(path)) continue
      const transcript = JSON.parse(readFileSync(path, 'utf8'))
      const status = ['skipped', 'crashed'].find((name) => transcript[name])
      if (status) {
        lines.push(`| ${model.label} | ${device} | ${lengths.map(() => status).join(' | ')} | | | | |`)
        continue
      }
      const { groups, rtf, timings } = score(set, transcript, clips)
      const cells = lengths.map((length) => {
        const { errors, total, failed } = groups[length]
        return `${percent(errors, total)}${failed ? ` (${failed} empty)` : ''}`
      })
      lines.push(
        `| ${model.label} | ${device} | ${cells.join(' | ')} | ${rtf.toFixed(3)} | ${(transcript.loadMs / 1000).toFixed(1)} s | ${transcript.maxRssMb} MB | ${timings.join(', ')} |`
      )
    }
  }
  writeFileSync(`results/${set}.md`, `${lines.join('\n')}\n`)
  console.log(`\n${set}\n${lines.join('\n')}`)
}
