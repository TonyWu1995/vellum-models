# Captions and speakers benchmark

How Vellum's live captions and speakers run on each device: CPU use, delay and accuracy of the captions, and how long the speakers take for an hour. It runs Vellum's own code (the captioners in `src/main/captions/`, the speaker code in `src/main/speakers/` and the model catalog) from a Vellum checkout, so it measures what Vellum ships. First used for [Vellum #171](https://github.com/TonyWu1995/Vellum/issues/171): Metal and CoreML on a Mac.

**Result (Apple M1 Pro):**

- **Captions:** Metal cuts the CPU cores live captions keep busy by 88–96 % (to 0.02–0.07), with the same accuracy. Vellum keeps `recording.captionGpu` on by default on a Mac.
- **Speakers:** an hour takes 100 s on the CPU (q4). onnxruntime's CoreML is no faster: slower with q4, the same with fp16. Vellum keeps the speakers on the CPU on a Mac.

## How it measures

- **Recordings:** the transcription benchmark's long pieces (AISHELL-1 and LibriSpeech, 30–120 s each) joined into one recording per language, about 10 min each. The speakers get both joined three times, 62.6 min; the timing is real, but they are four readers, not a meeting.
- **Captions:** the recording goes to the captioner 100 ms at a time, as Vellum's window sends it, as fast as the captioner takes it, with 2 threads as in Vellum's caption process. Each model, device and language runs in a process of its own.
  - **CPU cores:** CPU time per second of audio, which is how many cores the captions keep busy while recording.
  - **p95 / max per chunk:** how long the captioner took for 95 % of the 100 ms chunks, and for the slowest one.
  - **CER / WER:** the captions against the reference text, normalized as in the transcription benchmark.
- **Speakers:** Nemotron-3-Diarization finds the speaker turns, then CAM++ makes a voiceprint for each turn (always on the CPU), as Vellum does after a transcription. Vellum uses q4 on the CPU and fp16 on a GPU; both are tried on each provider here.

## Run it

Requirements: make, Node 24 or later, a Vellum checkout (`VELLUM`, `../../../Vellum` by default), and the transcription benchmark's clips (`make download prepare` in `../transcription`, which also installs the normalization this one scores with).

```sh
make                # all the steps below, in order
make install        # install the packages
make build VELLUM=<Vellum checkout>  # bundle the scripts with Vellum's code
make download       # the caption and speaker models, from Vellum's catalog, checked by SHA-256
make prepare        # the 10 min recordings and the hour
make captions       # every caption model on each device and language; MODELS, DEVICES and SETS pick a subset
make speakers       # the speakers with q4 and fp16 on each provider; PROVIDERS picks a subset
make score          # write results/ (`RESULTS=results/mac` writes elsewhere)
make clean          # delete everything downloaded or made
```

`gpu` is Metal on a Mac and Vulkan elsewhere for the captions; the speakers' GPU provider is CoreML on a Mac and DirectML on Windows. npm 11 skips install scripts it has not been allowed to run; if `make prepare` finds no ffmpeg, run `node node_modules/ffmpeg-static/install.js`.

| File | Does |
| --- | --- |
| `models.mjs` | the caption models to run and where each model's files go |
| `download.mjs` | downloads the files the catalog lists and checks their SHA-256 |
| `prepare.mjs` | joins the long pieces into `data/chinese.wav`, `data/english.wav` (with their reference text) and `data/hour.wav` |
| `captions.mjs` | writes `data/text/<model>-<device>-<language>.txt` and a line in `data/results.jsonl`, skipping what is already there |
| `speakers.mjs` | writes a line in `data/speakers.jsonl` per weights and provider, skipping what is already there |
| `score.mjs` | writes `captions.md` and `speakers.md` into `RESULTS` |

## Results (2026-11-17)

Apple M1 Pro (8 performance and 2 efficiency cores, 14-core GPU, 32 GB), macOS 26.7, `transcribe-cpp` 0.4.2, `onnxruntime-node` 1.31.1. Full tables in [`results/mac/`](results/mac).

### Captions

| Caption model | Language | CPU cores, CPU → Metal | p95 per chunk, CPU → Metal | CER / WER, CPU → Metal |
| --- | --- | --- | --- | --- |
| Nemotron 3.5 Streaming 80 ms | Chinese | 0.658 → **0.069** | 55 → **36 ms** | 10.4 → 11.2 % |
| Nemotron 3.5 Streaming 320 ms | Chinese | 0.333 → **0.036** | 55 → **25 ms** | 9.6 → 9.1 % |
| Nemotron 3.5 Streaming 320 ms | English | 0.339 → **0.045** | 58 → **28 ms** | 4.2 → 4.3 % |
| Nemotron 3.5 Streaming 560 ms | Chinese | 0.263 → **0.032** | 75 → **30 ms** | 8.7 → 9.2 % |
| SenseVoice Small | Chinese | 0.543 → **0.022** | 206 → **68 ms** | 3.4 → 3.3 % |
| SenseVoice Small | English | 0.687 → **0.028** | 247 → **72 ms** | 5.5 → 5.3 % |

- Opened on Metal, the first chunk takes under 1 ms, so the captioners' warm-up works.
- With about 1800 Chinese characters and 1300 English words per recording, gaps under about 1 % are noise.
- On Windows the GPU took the sherpa-onnx captions from 0.65 to 0.15 core ([Vellum #161](https://github.com/TonyWu1995/Vellum/issues/161)); Metal does better.

### Speakers, an hour of audio

| Weights | Provider | Find speakers | Voiceprints | Total | Peak memory |
| --- | --- | --- | --- | --- | --- |
| **q4** | **CPU** | **67 s** | 33 s | **100 s** | 0.5 GB |
| q4 | CoreML | 109 s | 34 s | 143 s | 3.4 GB |
| fp16 | CPU | 77 s | 34 s | 111 s | 0.8 GB |
| fp16 | CoreML | 78 s | 33 s | 110 s | 0.8 GB |

- onnxruntime warns that CoreML does not take every node of the q4 model, so it moves data between the CPU and the GPU; with fp16 it takes hardly anything over (the same ~3.9 cores busy).

## Caveats

- One Mac. Captions were measured outside Vellum, not in a running recording; Nemotron 80 ms and 560 ms in Chinese only, and their load time was not recorded.
- The recordings are read speech in a quiet room, fed faster than real time.
