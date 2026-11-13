| Model | Device | WER short | WER 30s | WER 60s | WER 120s | Speed (RTF) | Load | Peak memory | Times |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Whisper Large v3 Turbo | gpu | 2.2% | 0.0% | 6.8% | 3.1% | 0.036 | 1.9 s | 495 MB | segment |
| Parakeet TDT 0.6B v3 | cpu | 1.5% | 15.3% | 7.6% | 3.9% | 0.079 | 2.9 s | 2906 MB | token |
| Parakeet TDT 0.6B v3 | gpu | 1.6% | 15.3% | 7.1% | 4.4% | 0.047 | 3.5 s | 809 MB | token |
| Qwen3-ASR 0.6B | cpu | 2.1% | 0.5% | 100.0% | 100.0% | 0.241 | 5.9 s | 5203 MB | none |
| Qwen3-ASR 0.6B (2 min limit) | cpu | 2.1% | 0.5% | 6.6% | 2.8% | 0.748 | 8.2 s | 7250 MB | none |
| Qwen3-ASR 0.6B (llama.cpp, Q8) | cpu | skipped | skipped | skipped | skipped | | | | |
| Qwen3-ASR 0.6B (llama.cpp, Q8) | gpu | 1.3% | 0.0% | 7.6% | 2.5% | 0.024 | 1.1 s | 1115 MB | none |
| Cohere Transcribe | cpu | 1.2% | 0.0% | 34.5% | 63.4% | 0.352 | 9.3 s | 5379 MB | none |
| Cohere Transcribe | gpu | 1.2% | 0.0% | 34.5% | 64.2% | 0.597 | 16.1 s | 1549 MB | none |
| FireRedASR2 AED | cpu | 2.2% | 0.0% | 5.1% | 51.7% | 0.847 | 4.1 s | 7304 MB | none |
| FireRedASR2 CTC | cpu | 9.8% | 5.8% | 12.2% | 10.0% | 0.364 | 2.4 s | 4953 MB | token |
| FireRedASR2 CTC | gpu | skipped | skipped | skipped | skipped | | | | |
| SenseVoice Small | cpu | 2.9% | 0.0% | 7.8% | 4.3% | 0.049 | 1.8 s | 1014 MB | token |
| SenseVoice Small | gpu | 2.8% | 0.0% | 7.8% | 4.0% | 0.054 | 3.2 s | 1286 MB | token |
| SenseVoice Small (transcribe.cpp, Q8) | gpu | 3.0% | 0.5% | 7.6% | 4.0% | 0.011 | 0.6 s | 1082 MB | none |
| Parakeet TDT 0.6B v3 (transcribe.cpp, Q8) | gpu | 1.8% | 0.0% | 16.4% | 2.4% | 0.022 | 1.0 s | 593 MB | word |
| Qwen3-ASR 0.6B (transcribe.cpp, Q8) | gpu | 1.7% | 0.0% | 6.1% | 3.7% | 0.028 | 1.3 s | 579 MB | none |
| Cohere Transcribe (transcribe.cpp, Q8) | gpu | 1.0% | 0.0% | 55.5% (1 empty) | 65.2% | 0.024 | 2.6 s | 619 MB | none |
| Breeze-ASR-25 (transcribe.cpp, Q8) | gpu | 1.8% | 0.0% | 5.6% | 3.2% | 0.055 | 2.0 s | 438 MB | segment |
| Fun-ASR-Nano-2512 (transcribe.cpp, Q8) | gpu | 1.7% | 0.0% | 4.4% | 43.0% | 0.025 | 1.4 s | 621 MB | none |
| Cohere Transcribe (transcribe.cpp, Q8, 30 s pieces) | gpu | 1.7% | 0.0% | 4.4% | 1.9% | 0.039 | 2.8 s | 700 MB | none |
| Fun-ASR-Nano-2512 (transcribe.cpp, Q8, 30 s pieces) | gpu | 2.0% | 0.0% | 4.4% | 1.9% | 0.037 | 1.4 s | 500 MB | none |
| FireRedASR2 AED (30 s pieces) | cpu | skipped | skipped | skipped | skipped | | | | |
