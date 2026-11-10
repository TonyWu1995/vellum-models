MODELS := \
	3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced \
	3dspeaker_speech_eres2netv2_sv_zh-cn_16k-common \
	3dspeaker_speech_eres2net_base_200k_sv_zh-cn_16k-common \
	3dspeaker_speech_eres2net_large_sv_zh-cn_3dspeaker_16k \
	nemo_en_titanet_large \
	wespeaker_zh_cnceleb_resnet34_LM \
	wespeaker_en_voxceleb_resnet34_LM \
	wespeaker_en_voxceleb_resnet293_LM
# English was run only for the models that were good in Chinese
EN_MODELS := \
	3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced \
	3dspeaker_speech_eres2netv2_sv_zh-cn_16k-common \
	3dspeaker_speech_eres2net_base_200k_sv_zh-cn_16k-common

MODEL_URL := https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/main
CNCELEB_URL := https://openslr.trmal.net/resources/82/cn-celeb_v2.tar.gz
VOXCELEB_URL := https://huggingface.co/datasets/Codec-SUPERB/Voxceleb1_test_original/resolve/main/data
VOXCELEB_PARTS := \
	test-00000-of-00003-d0eea6966e0eba2f \
	test-00001-of-00003-1ab27c4d03da1754 \
	test-00002-of-00003-4d6815b5778a4368

ifeq ($(OS),Windows_NT)
PYTHON := venv/Scripts/python
else
PYTHON := venv/bin/python
endif

.PHONY: all setup models clean
all: results/cnceleb.txt results/voxceleb.txt

setup: node_modules $(PYTHON)

node_modules: package.json
	npm install
	touch $@

$(PYTHON): requirements.txt
	python -m venv venv
	$(PYTHON) -m pip install -r requirements.txt

models: $(MODELS:%=models/%.onnx)

models/%.onnx:
	mkdir -p models
	curl -fL -o $@ $(MODEL_URL)/$*.onnx

# The eval folder comes first in the 22 GB archive; stop reading at the first file after it
data/cnceleb/.done:
	mkdir -p data/cnceleb
	curl -s $(CNCELEB_URL) | tar xzvf - -C data/cnceleb | while read -r name; do \
		case "$$name" in CN-Celeb_flac/|CN-Celeb_flac/eval*) ;; *) break ;; esac; \
	done; true
	touch $@

data/cnceleb16k/.done: data/cnceleb/.done node_modules
	node cnceleb.mjs data/cnceleb/CN-Celeb_flac/eval/test data/cnceleb16k
	touch $@

data/voxceleb/%.parquet:
	mkdir -p data/voxceleb
	curl -fL -o $@ $(VOXCELEB_URL)/$*.parquet

data/voxceleb16k/.done: $(VOXCELEB_PARTS:%=data/voxceleb/%.parquet) $(PYTHON)
	$(PYTHON) -I voxceleb.py data/voxceleb data/voxceleb16k
	touch $@

data/embeddings/cnceleb-%.json: data/cnceleb16k/.done models/%.onnx
	mkdir -p data/embeddings
	node embed.mjs data/cnceleb16k models/$*.onnx $@

data/embeddings/voxceleb-%.json: data/voxceleb16k/.done models/%.onnx
	mkdir -p data/embeddings
	node embed.mjs data/voxceleb16k models/$*.onnx $@

results/cnceleb.txt: $(MODELS:%=data/embeddings/cnceleb-%.json)
	mkdir -p results
	node score.mjs $^ > $@

results/voxceleb.txt: $(EN_MODELS:%=data/embeddings/voxceleb-%.json)
	mkdir -p results
	node score.mjs $^ > $@

.SECONDARY:

clean:
	rm -rf data models node_modules venv
