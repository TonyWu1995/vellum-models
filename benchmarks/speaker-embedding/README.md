# Speaker embedding benchmark

Vellum recognizes a speaker it has heard before by comparing voiceprints ([Vellum #186](https://github.com/TonyWu1995/Vellum/issues/186)). This benchmark picked the model that makes those voiceprints. It has to work for Chinese and English, and it has to run on an ordinary computer.

**Result:** CAM++ (`3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx`, 28 MB), with a match threshold of 0.6 and at least 10 s of speech per voiceprint. It is the only model that is good in both languages, and it is also the smallest and the fastest.

## How Vellum matches, and how this measures it

- Each clip gives one embedding from its first 10 s. Vellum also caps a turn at 10 s.
- A **voiceprint** averages one recording's clips until they add up to 10 s. Vellum needs 10 s of clean speech before it makes a voiceprint.
- Two voiceprints are compared by cosine similarity. Only voiceprints from **different recordings** are compared, because Vellum compares a new transcript with earlier ones.
- Each pair is counted as one of two errors:
  - **missed**: the same person scores below the threshold, so Vellum leaves "Speaker N" and the user types the name.
  - **wrong**: two different people score at or above the threshold, so Vellum puts the wrong name on a line. This is the worse error.
- **EER** is the rate at the threshold where missed and wrong are equal. Lower is better, and it compares models regardless of threshold.

## Data

The audio is not in this repository. Get it yourself:

| Set | Language | What was used | Where |
| --- | --- | --- | --- |
| CN-Celeb (v2) eval | Chinese | 2365 clips, 195 speakers (162 have voiceprints from two recordings or more), 11 genres (interview, speech, singing, vlog, live broadcast, ...) | [OpenSLR 82](https://openslr.org/82/), `cn-celeb_v2.tar.gz` (22 GB). `CN-Celeb_flac/eval/` comes first in the archive, so `make` streams it and stops after the eval folder. Our download stalled partway, so we used the part that arrived. |
| VoxCeleb1 test | English | all 4874 clips, 40 speakers | The official download needs a login; the same files are in the [Codec-SUPERB/Voxceleb1_test_original](https://huggingface.co/datasets/Codec-SUPERB/Voxceleb1_test_original) parquet files (1.3 GB). |

Clip names become `<speaker>-<recording>-<n>`. A CN-Celeb recording is a speaker's genre session (`id00800-interview-02`); a VoxCeleb recording is one video.

## Run it

Requirements: make, Node 24 or later, Python 3, curl. The results below came from Windows 11 on an AMD Ryzen 7 3800X with 32 GB of RAM, CPU only, 2 threads per model.

```sh
make                       # everything: download, convert, embed, score into results/
make setup                 # only install the Node and Python packages
make models                # only download the models
make results/voxceleb.txt  # only the English run
make clean                 # delete the downloads and everything made from them
```

`make` skips what is already done, so it can be stopped and run again. Everything it downloads or makes goes in `data/`, `models/`, `node_modules/` and `venv/`, none of which is committed. A full run downloads about 4 GB and takes about two hours. Embedding with the larger models takes the longest.

To try another model from [the sherpa-onnx collection](https://huggingface.co/csukuangfj/speaker-embedding-models), add its file name without `.onnx` to `MODELS` (and `EN_MODELS` for English) in the `Makefile`.

## Results (2026-11-10)

The full `score.mjs` output for every model, with each threshold, is in [`results/`](results) (`cnceleb.txt`, `voxceleb.txt`), and the embedding times are in `results/timing.txt`.

### Chinese: CN-Celeb

891 voiceprints, 3861 same-person and 391242 different-person pairs.

| Model | Size | EER | Missed at 0.6 | Wrong at 0.6 |
| --- | --- | --- | --- | --- |
| 3D-Speaker ERes2NetV2 (zh) | 71 MB | 1.8% | 17.7% | 0.0% |
| 3D-Speaker ERes2Net base 200k (zh) | 40 MB | 3.5% | 28.4% | 0.1% |
| **3D-Speaker CAM++ (zh + en)** | **28 MB** | **4.0%** | 28.7% | 0.2% |
| 3D-Speaker ERes2Net large (zh) | 116 MB | 10.4% | 57.3% | 0.1% |
| NeMo TitaNet large (en) | 101 MB | 10.7% | 36.7% | 0.8% |
| WeSpeaker ResNet34-LM (CN-Celeb) | 27 MB | 18.7% | 35.0% | 3.4% |
| WeSpeaker ResNet34-LM (VoxCeleb) | 27 MB | 32.4% | 10.4% | 78.2% |
| WeSpeaker ResNet293-LM (VoxCeleb) | 114 MB | 35.3% | 1.9% | 89.4% |

Leaving out the singing clips lowers every EER by about one point and does not change the order.

### English: VoxCeleb1 test

Only the three models that were good in Chinese. 2419 voiceprints, 86918 same-person and 2828419 different-person pairs.

| Model | EER | Missed at 0.6 | Wrong at 0.6 |
| --- | --- | --- | --- |
| **CAM++ (zh + en)** | **0.7%** | 9.8% | **0.0%** |
| ERes2NetV2 (zh) | 4.3% | 2.9% | 5.8% |
| ERes2Net base 200k (zh) | 4.3% | 3.2% | 5.3% |

### Why not ERes2NetV2 with a higher threshold

Each model has its own scale, and ERes2NetV2's scale differs by language: English voices all score high. Vellum uses one threshold, so it has to work for both languages at once:

| Threshold | CAM++ zh missed / wrong | CAM++ en missed / wrong | ERes2NetV2 zh missed / wrong | ERes2NetV2 en missed / wrong |
| --- | --- | --- | --- | --- |
| 0.5 | 11.4% / 1.0% | 1.8% / 0.2% | 6.3% / 0.1% | 0.2% / 21.1% |
| **0.6** | 28.7% / 0.2% | 9.8% / 0.0% | 17.7% / 0.0% | 2.9% / 5.8% |
| 0.65 | 42.2% / 0.1% | 20.0% / 0.0% | 28.7% / 0.0% | 9.2% / 2.0% |
| 0.7 | 54.7% / 0.0% | 36.6% / 0.0% | 41.1% / 0.0% | 22.7% / 0.5% |

ERes2NetV2 stops naming the wrong English speaker only at 0.7, where it misses 41% of Chinese speakers. CAM++ at 0.6 almost never names the wrong person in either language.

CN-Celeb is harder than a meeting: the same person is compared across genres (an interview against a live stream or a song). On the user's own phone recordings (not published) CAM++ scored the same person 0.68–0.94, so 0.6 missed nobody there.

### Other checks

- **Speed:** CAM++ was the fastest. Embedding all of CN-Celeb (2365 clips, up to 10 s each) with 9 models running at once took CAM++ 630 s, ERes2Net base 1091 s, TitaNet 1250 s, ERes2NetV2 2085 s and ERes2Net large 2570 s. No separate speed run was needed, because only one model was left.
- **Memory:** WeSpeaker SimAM-ResNet100 (VoxBlink2, multilingual, 200 MB) used 1 to 1.5 GB of RAM and had not finished CN-Celeb after 97 minutes, so it was dropped.
- **Earlier tests**, on the user's recordings and AMI: see [Vellum #186](https://github.com/TonyWu1995/Vellum/issues/186). There, a speaker heard for only 3 s was missed by every model, which is why Vellum needs 10 s.

## Caveats

- The 3D-Speaker models were trained on about 200k speakers, which may include other parts of CN-Celeb, so their Chinese numbers may be a little optimistic.
- The CN-Celeb download stalled, so 195 of its 200 eval speakers were used; a full run may differ slightly.
