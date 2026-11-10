all: install download prepare voiceprints score

install:
	npm install

download:
	node download.mjs

prepare:
	node prepare.mjs

voiceprints:
	node voiceprints.mjs

score:
	node score.mjs

clean:
	rm -rf data node_modules

.PHONY: all install download prepare voiceprints score clean
