// Kaldi fbank as sherpa-onnx computes it for 3D-Speaker models: 80 bins, 25 ms frames every 10 ms,
// no edge snipping, Povey window, mean over the clip subtracted from every frame
import FFT from 'fft.js'

const SAMPLE_RATE = 16000
const FRAME = 400
const SHIFT = 160
const N_FFT = 512
const BINS = 80
const LOW_HZ = 20
const HIGH_HZ = SAMPLE_RATE / 2 - 400
const PREEMPHASIS = 0.97
const FLOOR = 1.1920928955078125e-7

const mel = (hz) => 1127 * Math.log(1 + hz / 700)

function melBank() {
  const low = mel(LOW_HZ)
  const delta = (mel(HIGH_HZ) - low) / (BINS + 1)
  return Array.from({ length: BINS }, (_, m) => {
    const [left, center, right] = [low + m * delta, low + (m + 1) * delta, low + (m + 2) * delta]
    const weights = []
    let from = -1
    for (let k = 0; k < N_FFT / 2; k++) {
      const at = mel((SAMPLE_RATE * k) / N_FFT)
      if (at <= left || at >= right) continue
      if (from < 0) from = k
      weights[k - from] = at <= center ? (at - left) / (center - left) : (right - at) / (right - center)
    }
    return { from, weights }
  })
}

const WINDOW = Float64Array.from(
  { length: FRAME },
  (_, i) => (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1))) ** 0.85
)
const BANK = melBank()
const fft = new FFT(N_FFT)

export function fbank(samples) {
  const count = Math.floor((samples.length + SHIFT / 2) / SHIFT)
  const at = (i) =>
    samples[i < 0 ? -i - 1 : i >= samples.length ? 2 * samples.length - 1 - i : i]
  const features = new Float32Array(count * BINS)
  const frame = new Array(N_FFT).fill(0)
  const spectrum = fft.createComplexArray()
  const power = new Float64Array(N_FFT / 2)
  for (let t = 0; t < count; t++) {
    const start = t * SHIFT + SHIFT / 2 - FRAME / 2
    let mean = 0
    for (let i = 0; i < FRAME; i++) mean += frame[i] = at(start + i)
    mean /= FRAME
    for (let i = 0; i < FRAME; i++) frame[i] -= mean
    for (let i = FRAME - 1; i > 0; i--) frame[i] -= PREEMPHASIS * frame[i - 1]
    frame[0] -= PREEMPHASIS * frame[0]
    for (let i = 0; i < FRAME; i++) frame[i] *= WINDOW[i]
    for (let i = FRAME; i < N_FFT; i++) frame[i] = 0
    fft.realTransform(spectrum, frame)
    for (let k = 0; k < N_FFT / 2; k++) power[k] = spectrum[2 * k] ** 2 + spectrum[2 * k + 1] ** 2
    BANK.forEach(({ from, weights }, m) => {
      let sum = 0
      for (let k = 0; k < weights.length; k++) sum += weights[k] * power[from + k]
      features[t * BINS + m] = Math.log(Math.max(sum, FLOOR))
    })
  }
  for (let m = 0; m < BINS; m++) {
    let mean = 0
    for (let t = 0; t < count; t++) mean += features[t * BINS + m]
    mean /= count
    for (let t = 0; t < count; t++) features[t * BINS + m] -= mean
  }
  return { features, frames: count }
}

export { BINS, SAMPLE_RATE }
