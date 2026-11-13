all: install gpu download prepare transcribe score

install:
	npm install

gpu:
	node gpu.mjs

download:
	node download.mjs

prepare:
	node prepare.mjs

transcribe:
	node transcribe.mjs

score:
	node score.mjs

clean:
	rm -rf data node_modules

.PHONY: all install gpu download prepare transcribe score clean
