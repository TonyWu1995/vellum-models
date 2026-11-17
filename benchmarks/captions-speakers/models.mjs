export const MODEL_IDS = process.env.MODELS?.split(',') ?? [
  'nemotron-3.5-streaming-80ms-q8',
  'nemotron-3.5-streaming-320ms-q8',
  'nemotron-3.5-streaming-560ms-q8',
  'sense-voice-small-q8'
]

export const SPEAKERS_ID = 'nemotron-3-diarization'

// A model's files and the speech detector it requires, by role
export function filesOf(model, getModel) {
  const required = Object.values(model.requires ?? {}).map((id) => getModel(id))
  return [model, ...required.filter((other) => other.purposes.includes('speech-detection'))].flatMap(
    (owner) => owner.files.map((file) => ({ ...file, path: `data/models/${file.name}`, owner }))
  )
}
