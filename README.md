# vellum-models

Speech models converted for [Vellum](https://github.com/TonyWu1995) when no ready-made build exists, and the benchmarks behind its model choices. A converted model is a release; the app downloads its files from there and checks each file's SHA-256. No model is released now: Parakeet Realtime EOU 120M was removed with sherpa-onnx ([Vellum #243](https://github.com/TonyWu1995/Vellum/issues/243)).

## Benchmarks

| Benchmark | Chose |
| --- | --- |
| [`benchmarks/speaker-embedding`](benchmarks/speaker-embedding) | CAM++ for recognizing speakers across transcripts, Chinese and English ([Vellum #186](https://github.com/TonyWu1995/Vellum/issues/186)) |
| [`benchmarks/captions-speakers`](benchmarks/captions-speakers) | Metal for the transcribe.cpp captions on a Mac, the speakers stay on the CPU ([Vellum #171](https://github.com/TonyWu1995/Vellum/issues/171)) |
| [`benchmarks/transcription`](benchmarks/transcription) | Qwen3-ASR, Fun-ASR-Nano, SenseVoice and Breeze-ASR-25 on transcribe.cpp, in speech pieces of up to 30 s ([Vellum #53](https://github.com/TonyWu1995/Vellum/issues/53)) |
