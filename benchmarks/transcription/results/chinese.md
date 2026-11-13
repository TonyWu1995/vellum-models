| Model | Device | CER short | CER 30s | CER 60s | CER 120s | Speed (RTF) | Load | Peak memory | Times |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Whisper Large v3 Turbo | gpu | 6.4% | 1.8% | 3.8% | 4.9% | 0.041 | 1.9 s | 475 MB | segment |
| Parakeet TDT 0.6B v3 | cpu | 125.8% (54 empty) | 100.0% (3 empty) | 100.0% (3 empty) | 100.0% (3 empty) | 0.079 | 2.5 s | 2637 MB | token, none |
| Parakeet TDT 0.6B v3 | gpu | 126.4% (54 empty) | 100.0% (3 empty) | 100.0% (3 empty) | 100.0% (3 empty) | 0.044 | 3.7 s | 808 MB | token, none |
| Qwen3-ASR 0.6B | cpu | 3.4% | 0.4% | 100.0% | 100.0% | 0.198 | 5.7 s | 5087 MB | none |
| Qwen3-ASR 0.6B (2 min limit) | cpu | 3.4% | 0.4% | 2.6% | 2.5% | 0.611 | 4.5 s | 7288 MB | none |
| Qwen3-ASR 0.6B (2 min limit) | gpu | 3.6% | 0.4% | 2.6% | 2.0% | 2.324 | 6.6 s | 15068 MB | none |
| Qwen3-ASR 0.6B (llama.cpp, Q8) | cpu | 2.4% | 0.4% | 3.4% | 2.4% | 0.991 | 0.8 s | 1593 MB | none |
| Qwen3-ASR 0.6B (llama.cpp, Q8) | gpu | 2.3% | 0.4% | 3.2% | 2.0% | 0.020 | 1.0 s | 1115 MB | none |
| Cohere Transcribe | cpu | 4.5% | 0.7% | 31.1% | 65.4% | 0.354 | 11.4 s | 5101 MB | none |
| Cohere Transcribe | gpu | 4.5% | 0.7% | 32.1% | 66.3% | 0.612 | 16.5 s | 2425 MB | none |
| FireRedASR2 AED | cpu | 1.5% | 0.7% | 2.0% | 45.1% | 0.762 | 4.8 s | 7055 MB | none |
| FireRedASR2 AED | gpu | 1.5% | 0.7% | 1.8% | 44.8% | 0.710 | 11.0 s | 13900 MB | none |
| FireRedASR2 CTC | cpu | 3.9% | 1.1% | 4.8% | 5.9% | 0.368 | 2.1 s | 5046 MB | token |
| FireRedASR2 CTC | gpu | skipped | skipped | skipped | skipped | | | | |
| SenseVoice Small | cpu | 3.1% | 0.7% | 3.8% | 4.3% | 0.054 | 2.0 s | 1129 MB | token |
| SenseVoice Small | gpu | 3.3% | 0.7% | 3.8% | 4.2% | 0.067 | 3.0 s | 1255 MB | token |
| SenseVoice Small (transcribe.cpp, Q8) | gpu | 3.3% | 0.7% | 3.8% | 4.3% | 0.015 | 0.7 s | 1182 MB | none |
| Parakeet TDT 0.6B v3 (transcribe.cpp, Q8) | gpu | 158.0% (48 empty) | 100.0% (2 empty) | 134.1% (1 empty) | 100.0% (3 empty) | 0.025 | 1.2 s | 588 MB | word, none |
| Qwen3-ASR 0.6B (transcribe.cpp, Q8) | gpu | 2.5% | 0.7% | 2.8% | 2.9% | 0.027 | 1.3 s | 514 MB | none |
| Cohere Transcribe (transcribe.cpp, Q8) | gpu | 4.5% | 0.7% | 27.9% | 66.5% | 0.039 | 2.6 s | 782 MB | none |
| Breeze-ASR-25 (transcribe.cpp, Q8) | gpu | 5.0% | 1.8% | 4.2% | 4.4% | 0.075 | 1.9 s | 441 MB | segment |
| Fun-ASR-Nano-2512 (transcribe.cpp, Q8) | gpu | 2.1% | 0.0% | 2.8% | 40.4% | 0.025 | 1.4 s | 594 MB | none |
| Cohere Transcribe (transcribe.cpp, Q8, 30 s pieces) | gpu | 4.6% | 0.7% | 4.0% | 4.5% | 0.040 | 2.7 s | 706 MB | none |
| Fun-ASR-Nano-2512 (transcribe.cpp, Q8, 30 s pieces) | gpu | 2.1% | 0.7% | 2.8% | 2.3% | 0.033 | 1.4 s | 523 MB | none |
| FireRedASR2 AED (30 s pieces) | cpu | 1.5% | 1.1% | 1.8% | 1.5% | 0.560 | 4.9 s | 3452 MB | none |
| FireRedASR2 AED (CrispASR, Q8) | gpu | 1.3% | 0.7% | 2.2% | 2.7% | 0.178 | not measured | not measured | none |
