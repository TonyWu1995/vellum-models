VELLUM ?= ../../../Vellum

all: install build download prepare captions speakers score

install:
	npm install

# The captioners, the speaker code and the catalog come from a Vellum checkout, so this measures the code Vellum ships
build:
	npx esbuild download.mjs captions.mjs speakers.mjs --bundle --platform=node --format=esm --packages=external --alias:vellum=$(abspath $(VELLUM)) --outdir=data/build

download:
	node data/build/download.js

prepare:
	node prepare.mjs

captions:
	node data/build/captions.js

speakers:
	node data/build/speakers.js

score:
	node score.mjs

clean:
	rm -rf data node_modules

.PHONY: all install build download prepare captions speakers score clean
