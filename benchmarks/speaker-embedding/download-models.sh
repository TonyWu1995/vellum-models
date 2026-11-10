#!/bin/sh
# Downloads every model in models.txt from the sherpa-onnx mirror on Hugging Face into models/
set -e
mkdir -p models
while read -r name; do
  [ -f "models/$name" ] || curl -fL -o "models/$name" "https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/main/$name"
done < models.txt
