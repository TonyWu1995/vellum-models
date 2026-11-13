// Both sides of a comparison are normalized the same way: Chinese to Simplified with numbers in characters,
// English lowercase with numbers as words, punctuation removed
import * as OpenCC from 'opencc-js'

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

export const NORMALIZE = {
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
