all: install gpu download prepare transcribe crispasr align score

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

crispasr:
	node crispasr.mjs

align:
	node align.mjs

score:
	node score.mjs

clean:
	rm -rf data node_modules

.PHONY: all install gpu download prepare transcribe crispasr align score clean
