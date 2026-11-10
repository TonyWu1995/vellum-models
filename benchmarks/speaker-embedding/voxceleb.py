"""Writes VoxCeleb1 test clips from the Hugging Face parquet files as 16 kHz float32 files.

python voxceleb.py <parquet folder> <out folder>
"""
import glob
import io
import os
import sys

import pyarrow.parquet as pq
import soundfile as sf

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
count = 0
for path in sorted(glob.glob(os.path.join(src, '*.parquet'))):
    for batch in pq.ParquetFile(path).iter_batches(batch_size=64):
        for row in batch.to_pylist():
            data, rate = sf.read(io.BytesIO(row['audio']['bytes']), dtype='float32')
            assert rate == 16000 and data.ndim == 1, (row['id'], rate)
            name = row['id'].replace('.wav', '').replace('+', '-')
            data.astype('<f4').tofile(os.path.join(out, name + '.f32'))
            count += 1
print('clips', count)
