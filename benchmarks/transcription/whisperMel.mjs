// Whisper's log-mel features (128 bands), as Qwen3-ForcedAligner's WhisperFeatureExtractor makes them:
// a centred 400-sample periodic Hann window every 160 samples, power spectrum, Slaney mel filters,
// log10, floored 8 below the loudest value and scaled to about -1..1. Kept to plain JS so Vellum needs
// no image or browser packages for it.
const N_FFT = 400
const HOP = 160
const MELS = 128
const SAMPLE_RATE = 16000
const BINS = N_FFT / 2 + 1

const hzToMel = (hz) => (hz < 1000 ? (3 * hz) / 200 : 15 + (27 * Math.log(hz / 1000)) / Math.log(6.4))
const melToHz = (mel) => (mel < 15 ? (200 * mel) / 3 : 1000 * Math.exp((Math.log(6.4) * (mel - 15)) / 27))

function melFilters() {
  const melMax = hzToMel(SAMPLE_RATE / 2)
  const bounds = Array.from({ length: MELS + 2 }, (_, m) => melToHz((melMax * m) / (MELS + 1)))
  return Array.from({ length: MELS }, (_, m) => {
    const [left, center, right] = [bounds[m], bounds[m + 1], bounds[m + 2]]
    const weights = new Float64Array(BINS)
    for (let k = 0; k < BINS; k += 1) {
      const hz = (SAMPLE_RATE * k) / N_FFT
      weights[k] = Math.max(0, Math.min((hz - left) / (center - left), (right - hz) / (right - center))) * (2 / (right - left))
    }
    return weights
  })
}

const FILTERS = melFilters()
const WINDOW = Float64Array.from({ length: N_FFT }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N_FFT))
const COS = new Float64Array(BINS * N_FFT)
const SIN = new Float64Array(BINS * N_FFT)
for (let k = 0; k < BINS; k += 1) {
  for (let n = 0; n < N_FFT; n += 1) {
    COS[k * N_FFT + n] = Math.cos((2 * Math.PI * k * n) / N_FFT)
    SIN[k * N_FFT + n] = Math.sin((2 * Math.PI * k * n) / N_FFT)
  }
}

// The window is centred on each frame, so the audio is mirrored at both ends
const reflected = (samples, i) => samples[i < 0 ? -i : i >= samples.length ? 2 * samples.length - 2 - i : i]

// Answers [MELS × frames] row by row, the layout the model's input_features takes
export function whisperMel(samples) {
  const frames = Math.floor(samples.length / HOP)
  const out = new Float32Array(MELS * frames)
  const frame = new Float64Array(N_FFT)
  const power = new Float64Array(BINS)
  let loudest = -Infinity
  for (let t = 0; t < frames; t += 1) {
    for (let n = 0; n < N_FFT; n += 1) frame[n] = reflected(samples, t * HOP + n - N_FFT / 2) * WINDOW[n]
    for (let k = 0; k < BINS; k += 1) {
      let re = 0
      let im = 0
      for (let n = 0, at = k * N_FFT; n < N_FFT; n += 1, at += 1) {
        re += frame[n] * COS[at]
        im -= frame[n] * SIN[at]
      }
      power[k] = re * re + im * im
    }
    for (let m = 0; m < MELS; m += 1) {
      let energy = 0
      const weights = FILTERS[m]
      for (let k = 0; k < BINS; k += 1) energy += weights[k] * power[k]
      const value = Math.log10(Math.max(energy, 1e-10))
      out[m * frames + t] = value
      if (value > loudest) loudest = value
    }
  }
  for (let i = 0; i < out.length; i += 1) out[i] = (Math.max(out[i], loudest - 8) + 4) / 4
  return { data: out, frames }
}
