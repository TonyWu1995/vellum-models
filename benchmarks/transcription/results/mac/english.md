| Model | Device | WER short | WER 30s | WER 60s | WER 120s | Speed (RTF) | Load | Peak memory | Times |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SenseVoice Small (transcribe.cpp, Q8) | cpu | 3.0% | 0.5% | 7.3% | 4.2% | 0.038 | 0.1 s | 1330 MB | none |
| SenseVoice Small (transcribe.cpp, Q8) | gpu | 3.0% | 0.5% | 7.6% | 4.0% | 0.014 | 0.1 s | 1106 MB | none |
| Parakeet TDT 0.6B v3 (transcribe.cpp, Q8) | cpu | 1.8% | 0.0% | 16.4% | 2.9% | 0.054 | 0.2 s | 2011 MB | word |
| Parakeet TDT 0.6B v3 (transcribe.cpp, Q8) | gpu | 1.8% | 0.0% | 16.4% | 2.4% | 0.018 | 0.1 s | 574 MB | word |
| Breeze-ASR-25 (transcribe.cpp, Q8) | cpu | 1.8% | 0.0% | 5.4% | 3.2% | 0.687 | 0.1 s | 2294 MB | segment |
| Breeze-ASR-25 (transcribe.cpp, Q8) | gpu | 1.8% | 0.0% | 5.6% | 3.2% | 0.146 | 0.1 s | 692 MB | segment |
| Fun-ASR-Nano-2512 (transcribe.cpp, Q8, 30 s pieces) | cpu | 2.2% | 0.0% | 4.6% | 1.9% | 0.089 | 0.2 s | 1494 MB | none |
| Fun-ASR-Nano-2512 (transcribe.cpp, Q8, 30 s pieces) | gpu | 2.1% | 0.0% | 4.6% | 1.9% | 0.045 | 0.2 s | 718 MB | none |
| Qwen3-ASR 0.6B (transcribe.cpp, Q8, 30 s pieces) | cpu | 2.1% | 0.0% | 6.4% | 2.5% | 0.102 | 0.2 s | 1788 MB | none |
| Qwen3-ASR 0.6B (transcribe.cpp, Q8, 30 s pieces) | gpu | 2.1% | 0.0% | 6.4% | 2.5% | 0.048 | 0.2 s | 719 MB | none |
| Qwen3-ASR 1.7B (transcribe.cpp, Q8, 30 s pieces) | cpu | 2.2% | 0.0% | 5.9% | 2.1% | 0.205 | 0.2 s | 3069 MB | none |
| Qwen3-ASR 1.7B (transcribe.cpp, Q8, 30 s pieces) | gpu | 2.2% | 0.0% | 5.9% | 2.1% | 0.077 | 0.2 s | 715 MB | none |
| Cohere Transcribe (transcribe.cpp, Q4_K_M, 30 s pieces) | cpu | 1.6% | 0.0% | 4.2% | 1.9% | 0.202 | 0.3 s | 3259 MB | none |
| Cohere Transcribe (transcribe.cpp, Q4_K_M, 30 s pieces) | gpu | 1.7% | 0.0% | 4.2% | 1.9% | 0.049 | 0.1 s | 515 MB | none |
