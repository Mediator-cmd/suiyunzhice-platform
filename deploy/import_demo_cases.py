import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageOps


def run(source):
    web = Path(__file__).resolve().parents[1] / 'web'
    destination = web / 'public' / 'casebook'
    destination.mkdir(parents=True, exist_ok=True)
    record = (source / '验证记录.txt').read_text(encoding='utf-8-sig')
    labels = ['rust', 'powdery', 'fusarium', 'sheath_blight', 'healthy']
    samples = []
    for filename, predicted, score in re.findall(r'OK\s+(\S+\.jpg)\s+->\s+(\S+)\s+conf=([\d.]+)', record):
        group, label, number = Path(filename).stem.split('-')
        original = source / f'{group}-{label}' / filename
        key = f'{labels[int(group) - 1]}-{number}'
        shutil.copyfile(original, destination / f'{key}.jpg')
        with Image.open(original) as photo:
            preview = ImageOps.exif_transpose(photo).convert('RGB')
            preview.thumbnail((480, 360))
            preview.save(destination / f'{key}.webp', quality=82)
        samples.append(dict(id=key, group=labels[int(group)-1], number=number, label=label, predicted=predicted,
                            percent=float(score), sha256=hashlib.sha256(original.read_bytes()).hexdigest()))
    if len(set(item['id'] for item in samples)) != 50 or 'resnet18-v5.2' not in record.lower():
        raise ValueError('演示记录不完整或模型版本不同')
    (web / 'src' / 'casebook.json').write_text(json.dumps(samples, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    run(Path(sys.argv[1]))
