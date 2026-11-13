# Transcription benchmark

Vellum wants transcription models more accurate than Whisper, in Chinese and English, that still run on an ordinary computer ([Vellum #53](https://github.com/TonyWu1995/Vellum/issues/53)). This benchmark compared the candidates and the libraries that can run them.

**Result:**

- **Models:** Qwen3-ASR 0.6B and Fun-ASR-Nano-2512 are the most accurate (Chinese CER about 2 %, against 6.4 % for Whisper large-v3-turbo), and SenseVoice Small (3.1 %) is the best model that also gives times. Breeze-ASR-25 (5.0 %, tuned for Taiwanese Mandarin) writes Traditional Chinese and gives segment times. Qwen3-ASR and Fun-ASR-Nano give no times, so Vellum needs a forced aligner before it can add them.
- **Library:** the library matters more than the model. On [transcribe.cpp](https://github.com/handy-computer/transcribe.cpp) (ggml, Vulkan) the same model is 2–30× faster than on sherpa-onnx with DirectML and uses a fraction of the memory.
- **Pieces of up to 30 s:** Cohere Transcribe, FireRedASR2 AED and Fun-ASR-Nano only learned short audio. Given 1–2 minutes at once they skip the middle; cut into pieces of up to 30 s (as their own tools do) they are as good as on short clips.

## How it measures

- **Accuracy:** Chinese by characters (CER), English by words (WER); lower is better. Both sides are normalized first: Chinese to Simplified (OpenCC) with digits read as characters, English lowercase with numbers as words, punctuation removed.
- **Lengths:** 100 short clips per language (a few seconds each), plus 3 pieces each of 30, 60 and 120 s made by joining the clips that follow with 0.5 s of silence, because Vellum hands a model up to 120 s of speech at once.
- **Speed (RTF):** seconds spent per second of audio; 0.02 means an hour of audio in about 72 s. Measured while other runs used the same machine, so compare rows loosely; the clean speeds are below.
- **Times:** what the model gives besides the text: `word`, `token`, `segment` or `none`. Vellum needs times to seek in the player, export SRT / VTT and find speakers.
- **Peak memory:** the largest resident memory of the process running that model (each model, device and language runs in a process of its own).
- **A real recording:** two parts of a meeting recording of the user's (about 12 min, Chinese, phone, not published), cut the way Vellum cuts speech. With no reference text it only shows whether a model keeps everything (characters out) and whether it loops.

## Data

The audio is not in this repository; `make download` gets it:

| Set | Language | What was used | Where |
| --- | --- | --- | --- |
| AISHELL-1 test | Chinese | the first of three parquet files | [AudioLLMs/aishell_1_zh_test](https://huggingface.co/datasets/AudioLLMs/aishell_1_zh_test) |
| LibriSpeech test-clean | English | the first parquet file | [openslr/librispeech_asr](https://huggingface.co/datasets/openslr/librispeech_asr) |

## Run it

Requirements: make, Node 24 or later, and `gh` signed in for `make gpu` (Windows only). The results below came from Windows 11 on an AMD Ryzen 7 3800X with 32 GB of RAM and an NVIDIA RTX 2070 SUPER (8 GB), 4 threads per model.

```sh
make             # all the steps below, in order
make install     # install the packages
make gpu         # Windows: swap in Vellum's sherpa-onnx build with DirectML
make download    # download the models and the Chinese and English clips
make prepare     # pick the clips and make the long pieces
make transcribe  # every model transcribes every clip, on each device
make crispasr    # Windows: the CrispASR models
make align       # Windows: word times from a forced aligner, on the long pieces
make score       # write results/
make clean       # delete everything downloaded or made
```

| File | Does |
| --- | --- |
| `models.json` | the models to test, their library (`kind`) and devices; `pieceSeconds` cuts speech into pieces first |
| `recognizers.mjs` | opens a model on sherpa-onnx, whisper.cpp, llama.cpp or transcribe.cpp the way Vellum would |
| `transcribe.mjs` | writes `data/transcripts/<model>-<device>-<language>.json`, skipping what is already there; `MODELS`, `DEVICES` and `SETS` pick a subset |
| `score.mjs` | writes `results/chinese.md` and `results/english.md` |
| `crispasr.mjs` | Windows: runs the `crispasr` models on [CrispASR](https://github.com/CrispStrobe/CrispASR)'s command line (it has no Node package), one process per language; its RTF is CrispASR's own timing, without loading, and memory is not measured |
| `align.mjs` | runs Qwen3-ForcedAligner (on CrispASR) on the long pieces with the reference text and with each model's transcript, and writes `results/alignment.md` |
| `normalize.mjs` | the text normalization `score.mjs` and `align.mjs` share |
| `own.mjs` | `node own.mjs <recording>...` converts your own recordings, then `node own.mjs` transcribes them into `data/own/`, which stays on your computer |

A full run downloads about 25 GB of models and takes most of a day, mostly the slow sherpa-onnx runs.

## Results (2026-11-13)

The full tables, every model and device, are in [`results/`](results).

Libraries, as named in the tables below:

| Library | Package (version) | Devices used |
| --- | --- | --- |
| sherpa-onnx | `sherpa-onnx-node` 2.0.1, with Vellum's onnxruntime-directml build | CPU, DirectML |
| whisper.cpp | `@fugood/whisper.node` 1.2.0-rc.1 | Vulkan |
| llama.cpp | `@fugood/llama.node` 1.7.15 | CPU, Vulkan |
| transcribe.cpp | `transcribe-cpp` 0.4.2 | Vulkan |
| CrispASR | `crispasr-windows-x86_64-vulkan.zip` v0.8.53 (command line) | Vulkan (encoder) + CPU (decoder) |

### Chinese: AISHELL-1 (CER, lower is better)

| Model | Library, device | Short | 30 s | 60 s | 120 s | RTF | Memory | Times |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Qwen3-ASR 0.6B** (Q8) | llama.cpp, GPU | 2.3 % | 0.4 % | 3.2 % | 2.0 % | 0.020 | 1.1 GB | none |
| **Qwen3-ASR 0.6B** (Q8) | transcribe.cpp, GPU | 2.5 % | 0.7 % | 2.8 % | 2.9 % | 0.027 | 0.5 GB | none |
| **Fun-ASR-Nano-2512** (Q8, 30 s pieces) | transcribe.cpp, GPU | 2.1 % | 0.7 % | 2.8 % | 2.3 % | 0.033 | 0.5 GB | none |
| **SenseVoice Small** (int8) | sherpa-onnx, CPU | 3.1 % | 0.7 % | 3.8 % | 4.3 % | 0.054 | 1.1 GB | token |
| SenseVoice Small (Q8) | transcribe.cpp, GPU | 3.3 % | 0.7 % | 3.8 % | 4.3 % | 0.015 | 1.2 GB | none |
| Cohere Transcribe (Q8, 30 s pieces) | transcribe.cpp, GPU | 4.6 % | 0.7 % | 4.0 % | 4.5 % | 0.040 | 0.7 GB | none |
| Breeze-ASR-25 (Q8) | transcribe.cpp, GPU | 5.0 % | 1.8 % | 4.2 % | 4.4 % | 0.075 | 0.4 GB | segment |
| FireRedASR2 AED (Q8) | CrispASR, GPU + CPU | 1.3 % | 0.7 % | 2.2 % | 2.7 % | 0.178 | not measured | none |
| FireRedASR2 AED (int8, 30 s pieces) | sherpa-onnx, CPU | 1.5 % | 1.1 % | 1.8 % | 1.5 % | 0.560 | 3.5 GB | none |
| FireRedASR2 CTC (int8) | sherpa-onnx, CPU | 3.9 % | 1.1 % | 4.8 % | 5.9 % | 0.368 | 5.0 GB | token |
| Whisper large-v3-turbo (today's default) | whisper.cpp, GPU | 6.4 % | 1.8 % | 3.8 % | 4.9 % | 0.041 | 0.5 GB | segment |

Parakeet TDT v3 does not know Chinese. Without pieces, Cohere scores 28–32 % at 60 s and 65 % at 120 s, FireRed AED 45 % and Fun-ASR-Nano 40 % at 120 s: they skip the middle of the audio.

### English: LibriSpeech test-clean (WER, lower is better)

| Model | Library, device | Short | 30 s | 60 s | 120 s | RTF |
| --- | --- | --- | --- | --- | --- | --- |
| Qwen3-ASR 0.6B (Q8) | llama.cpp, GPU | 1.3 % | 0.0 % | 7.6 % | 2.5 % | 0.024 |
| Qwen3-ASR 0.6B (Q8) | transcribe.cpp, GPU | 1.7 % | 0.0 % | 6.1 % | 3.7 % | 0.028 |
| Fun-ASR-Nano-2512 (Q8, 30 s pieces) | transcribe.cpp, GPU | 2.0 % | 0.0 % | 4.4 % | 1.9 % | 0.037 |
| SenseVoice Small (int8) | sherpa-onnx, CPU | 2.9 % | 0.0 % | 7.8 % | 4.3 % | 0.049 |
| Cohere Transcribe (Q8, 30 s pieces) | transcribe.cpp, GPU | 1.7 % | 0.0 % | 4.4 % | 1.9 % | 0.039 |
| Breeze-ASR-25 (Q8) | transcribe.cpp, GPU | 1.8 % | 0.0 % | 5.6 % | 3.2 % | 0.055 |
| Parakeet TDT v3 (Q8) | transcribe.cpp, GPU | 1.8 % | 0.0 % | 16.4 % | 2.4 % | 0.022 |
| FireRedASR2 AED (Q8) | CrispASR, GPU + CPU | 1.9 % | 0.0 % | 4.9 % | 2.6 % | 0.228 |
| FireRedASR2 CTC (int8) | sherpa-onnx, CPU | 9.8 % | 5.8 % | 12.2 % | 10.0 % | 0.364 |
| Whisper large-v3-turbo | whisper.cpp, GPU | 2.2 % | 0.0 % | 6.8 % | 3.1 % | 0.036 |

The 60 s pieces hold a few rare names that most models miss, so that column is noisier than the others.

### The library

Qwen3-ASR 0.6B on each library (Chinese):

| Library, device | RTF | Memory |
| --- | --- | --- |
| sherpa-onnx int8, CPU | 0.611 | 7.3 GB |
| sherpa-onnx int8, DirectML | 2.324 | 15.1 GB |
| llama.cpp Q8, CPU | 0.991 | 1.6 GB |
| llama.cpp Q8, Vulkan | 0.020 | 1.1 GB |
| transcribe.cpp Q8, Vulkan | 0.027 | 0.5 GB |

sherpa-onnx's Qwen3-ASR keeps only 512 tokens of audio and text by default (`maxTotalLen`); past about 30 s it returns nothing, so the rows above raise it to 2600 (`qwen3-asr-0.6b-long`). On DirectML it is slower than on the CPU, because sherpa-onnx copies the decoder's cache to and from the GPU on every token.

Clean speeds, one model at a time (Chinese, RTF): SenseVoice int8 CPU 0.063, fp32 CPU 0.067, int8 DirectML 0.045, fp32 DirectML 0.039; Parakeet TDT v3 CPU 0.108, DirectML 0.042; Whisper large-v3-turbo Vulkan 0.041. int8 against fp32 hardly matters.

whisper.cpp's CUDA build did not load without the CUDA runtime installed, so Whisper ran on Vulkan.

### The real recording

Characters out over the whole recording, cut into pieces of up to 120 s as Vellum does (complete models give about 2800):

| Model | Library, device | Characters | Loops | Failed pieces |
| --- | --- | --- | --- | --- |
| Qwen3-ASR 0.6B | llama.cpp, GPU | 2810 | no | 0 |
| Qwen3-ASR 0.6B (2600 tokens) | sherpa-onnx, CPU | 2790 | no | 0 |
| SenseVoice Small | sherpa-onnx, CPU | 2761 | no | 0 |
| SenseVoice Small | transcribe.cpp, GPU | 2757 | no | 0 |
| Whisper large-v3-turbo | whisper.cpp, GPU | 2661 | no | 0 |
| Breeze-ASR-25 | transcribe.cpp, GPU | 2616 | no | 0 |
| Fun-ASR-Nano, 120 s pieces | transcribe.cpp, GPU | 1904 | yes | 1 |
| **Fun-ASR-Nano, 30 s pieces** | transcribe.cpp, GPU | **2798** | no | 0 |
| Cohere Transcribe, 120 s pieces | sherpa-onnx, CPU | 2168 | yes (one word 641 times) | 0 |
| Cohere Transcribe, 30 s pieces | transcribe.cpp, GPU | 2565 | no | 0 |
| FireRedASR2 AED, 120 s pieces | sherpa-onnx, CPU | 1834 | no | 0 |

FireRedASR2 AED on CrispASR was not run on the real recording.

### Word times from a forced aligner

Qwen3-ASR, Fun-ASR-Nano and SenseVoice give no times on transcribe.cpp (it answers "unsupported timestamp granularity"), so `align.mjs` gives their transcripts to [Qwen3-ForcedAligner-0.6B](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B) (Q8, on CrispASR's `--align-only`, Vulkan), which times every character or word. The truth is where speech starts and ends in each sentence of the long pieces (speech detection on each joined clip). Full table: [`results/alignment.md`](results/alignment.md).

| Text given to the aligner | Language | Sentences | Median start error | Median end error | Boundaries within 0.2 s | Within 0.5 s | RTF |
| --- | --- | --- | --- | --- | --- | --- | --- |
| the reference | Chinese | 118 | 0.04 s | 0.05 s | 97 % | 99 % | 0.046 |
| Qwen3-ASR's transcript | Chinese | 118 | 0.04 s | 0.05 s | 96 % | 97 % | 0.035 |
| Fun-ASR-Nano's transcript | Chinese | 118 | 0.04 s | 0.05 s | 96 % | 97 % | 0.037 |
| SenseVoice's transcript | Chinese | 118 | 0.04 s | 0.05 s | 95 % | 97 % | 0.038 |
| the reference | English | 68 | 0.03 s | 0.26 s | 60 % | 90 % | 0.038 |
| Qwen3-ASR's transcript | English | 68 | 0.03 s | 0.27 s | 60 % | 93 % | 0.038 |
| Fun-ASR-Nano's transcript | English | 68 | 0.03 s | 0.26 s | 60 % | 93 % | 0.038 |
| SenseVoice's transcript | English | 68 | 0.03 s | 0.28 s | 57 % | 91 % | 0.041 |

- A model's mistakes hardly move the times: the aligner places a wrong word where it was said.
- In English the aligner ends a sentence about 0.26 s before speech detection does, and starts one in ten sentences about 1 s early; Chinese has neither.
- RTF includes starting CrispASR and loading the aligner for every piece.

### Not chosen

- **Cohere Transcribe:** works in 30 s pieces, but less accurate in Chinese than Qwen3-ASR and Fun-ASR-Nano, still drops about 9 % of the real recording, and gives no times.
- **FireRedASR2 AED:** the most accurate in Chinese, but transcribe.cpp and llama.cpp do not support it. On CrispASR (Vulkan encoder, CPU decoder) it takes 0.18 s per second of audio, 6–7× slower than Qwen3-ASR and Fun-ASR-Nano on transcribe.cpp, and would add a second library to Vellum; on sherpa-onnx's CPU 0.56 s. The other GPU builds (PyTorch, TensorRT-LLM) need Python or a server. Not added for now; worth another look if Vellum ends up on CrispASR.
- **FireRedASR2 CTC:** 9.8 % English WER.
- **Fun-ASR-Nano on sherpa-onnx 2.0.1:** produced no text, even on its own sample files; it was tested on transcribe.cpp instead.

## Caveats

- One machine, one GPU, Windows only; Metal on Mac was not measured.
- The speeds in the main tables were measured while other runs shared the machine; the clean speeds are the ones to compare.
- AISHELL-1 is read speech in a quiet room; a meeting is harder. The real recording shows completeness, not accuracy.
- FireRedASR2 AED in 30 s pieces was run on Chinese only.
- The "30 s pieces" rows load the speech detector again for every clip, so their RTF is a little high.
- The alignment truth comes from speech detection, which can itself be off by a few tens of milliseconds.
- English numbers are scored as plain numbers ("1860" becomes "one thousand eight hundred sixty"), so models that write digits lose a little WER on years read the other way.
