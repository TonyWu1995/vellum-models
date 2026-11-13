# vellum-models

Speech models converted for [Vellum](https://github.com/TonyWu1995) live captions when no ready-made build exists. Each model is a release; the app downloads its files from there and checks each file's SHA-256.

| Release | Model | License |
| --- | --- | --- |
| [`parakeet-eou-120m-v1`](https://github.com/TonyWu1995/vellum-models/releases/tag/parakeet-eou-120m-v1) | NVIDIA Parakeet Realtime EOU 120M v1, int8, for sherpa-onnx | NVIDIA Open Model License (`LICENSE` and `NOTICE` in the release) |

Model weights keep their original license; see each release.

## Benchmarks

| Benchmark | Chose |
| --- | --- |
| [`benchmarks/speaker-embedding`](benchmarks/speaker-embedding) | CAM++ for recognizing speakers across transcripts, Chinese and English ([Vellum #186](https://github.com/TonyWu1995/Vellum/issues/186)) |
| [`benchmarks/transcription`](benchmarks/transcription) | Qwen3-ASR, Fun-ASR-Nano, SenseVoice and Breeze-ASR-25 on transcribe.cpp, in speech pieces of up to 30 s ([Vellum #53](https://github.com/TonyWu1995/Vellum/issues/53)) |
