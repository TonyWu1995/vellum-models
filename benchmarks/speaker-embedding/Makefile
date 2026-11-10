MODELS = \
	3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced \
	3dspeaker_speech_eres2netv2_sv_zh-cn_16k-common \
	3dspeaker_speech_eres2net_base_200k_sv_zh-cn_16k-common \
	3dspeaker_speech_eres2net_large_sv_zh-cn_3dspeaker_16k \
	nemo_en_titanet_large \
	wespeaker_zh_cnceleb_resnet34_LM \
	wespeaker_en_voxceleb_resnet34_LM \
	wespeaker_en_voxceleb_resnet293_LM

# English only for the models that were good in Chinese
EN_MODELS = \
	3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced \
	3dspeaker_speech_eres2netv2_sv_zh-cn_16k-common \
	3dspeaker_speech_eres2net_base_200k_sv_zh-cn_16k-common

VOXCELEB_FILES = \
	test-00000-of-00003-d0eea6966e0eba2f \
	test-00001-of-00003-1ab27c4d03da1754 \
	test-00002-of-00003-4d6815b5778a4368

# venv/bin/python on macOS and Linux
PYTHON = venv/Scripts/python

all: setup models cnceleb voxceleb embed score

setup:
	npm install
	python -m venv venv
	$(PYTHON) -m pip install -r requirements.txt

models:
	mkdir -p models
	for m in $(MODELS); do \
		curl -fL -o models/$$m.onnx https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/main/$$m.onnx; \
	done

# The eval folder is at the start of the 22 GB archive: stop reading after it
cnceleb:
	mkdir -p data/cnceleb
	curl -s https://openslr.trmal.net/resources/82/cn-celeb_v2.tar.gz | tar xzvf - -C data/cnceleb | while read -r f; do \
		case "$$f" in CN-Celeb_flac/|CN-Celeb_flac/eval*) ;; *) break ;; esac; \
	done; true
	node cnceleb.mjs data/cnceleb/CN-Celeb_flac/eval/test data/cnceleb16k

voxceleb:
	mkdir -p data/voxceleb
	for f in $(VOXCELEB_FILES); do \
		curl -fL -o data/voxceleb/$$f.parquet https://huggingface.co/datasets/Codec-SUPERB/Voxceleb1_test_original/resolve/main/data/$$f.parquet; \
	done
	$(PYTHON) -I voxceleb.py data/voxceleb data/voxceleb16k

embed:
	mkdir -p data/embeddings
	for m in $(MODELS); do node embed.mjs data/cnceleb16k models/$$m.onnx data/embeddings/cnceleb-$$m.json; done
	for m in $(EN_MODELS); do node embed.mjs data/voxceleb16k models/$$m.onnx data/embeddings/voxceleb-$$m.json; done

score:
	node score.mjs data/embeddings/cnceleb-*.json > results/cnceleb.txt
	node score.mjs data/embeddings/voxceleb-*.json > results/voxceleb.txt

clean:
	rm -rf data models node_modules venv

.PHONY: all setup models cnceleb voxceleb embed score clean
