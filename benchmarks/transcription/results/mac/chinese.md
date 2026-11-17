| Model | Device | CER short | CER 30s | CER 60s | CER 120s | Speed (RTF) | Load | Peak memory | Times |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SenseVoice Small (transcribe.cpp, Q8) | cpu | 3.3% | 0.7% | 3.8% | 4.2% | 0.040 | 2.0 s | 1123 MB | none |
| SenseVoice Small (transcribe.cpp, Q8) | gpu | 3.3% | 0.7% | 3.8% | 4.2% | 0.015 | 0.1 s | 904 MB | none |
| Parakeet TDT 0.6B v3 (transcribe.cpp, Q8) | cpu | 156.9% (48 empty) | 100.0% (2 empty) | 128.1% (1 empty) | 100.0% (3 empty) | 0.051 | 0.2 s | 1999 MB | word, none |
| Parakeet TDT 0.6B v3 (transcribe.cpp, Q8) | gpu | 157.3% (48 empty) | 100.0% (2 empty) | 134.1% (1 empty) | 100.0% (3 empty) | 0.019 | 0.1 s | 541 MB | word, none |
| Breeze-ASR-25 (transcribe.cpp, Q8) | cpu | 5.0% | 1.8% | 4.2% | 4.4% | 0.853 | 0.3 s | 2341 MB | segment |
| Breeze-ASR-25 (transcribe.cpp, Q8) | gpu | 5.2% | 1.8% | 4.2% | 4.4% | 0.176 | 0.1 s | 703 MB | segment |
| Fun-ASR-Nano-2512 (transcribe.cpp, Q8, 30 s pieces) | cpu | 2.3% | 0.7% | 2.8% | 2.1% | 0.064 | 0.2 s | 1552 MB | none |
| Fun-ASR-Nano-2512 (transcribe.cpp, Q8, 30 s pieces) | gpu | 2.2% | 0.4% | 2.8% | 2.1% | 0.037 | 0.3 s | 706 MB | none |
| Qwen3-ASR 0.6B (transcribe.cpp, Q8, 30 s pieces) | cpu | 2.6% | 0.4% | 2.8% | 2.6% | 0.089 | 0.2 s | 1782 MB | none |
| Qwen3-ASR 0.6B (transcribe.cpp, Q8, 30 s pieces) | gpu | 2.6% | 0.4% | 2.8% | 2.5% | 0.042 | 0.3 s | 702 MB | none |
| Qwen3-ASR 1.7B (transcribe.cpp, Q8, 30 s pieces) | cpu | 1.5% | 0.4% | 2.4% | 2.7% | 0.179 | 0.2 s | 3052 MB | none |
| Qwen3-ASR 1.7B (transcribe.cpp, Q8, 30 s pieces) | gpu | 1.6% | 0.4% | 2.4% | 2.7% | 0.063 | 0.5 s | 707 MB | none |
| Cohere Transcribe (transcribe.cpp, Q4_K_M, 30 s pieces) | cpu | 4.6% | 0.7% | 4.0% | 4.4% | 0.196 | 0.3 s | 3214 MB | none |
| Cohere Transcribe (transcribe.cpp, Q4_K_M, 30 s pieces) | gpu | 4.7% | 0.7% | 4.0% | 4.4% | 0.051 | 0.7 s | 487 MB | none |
