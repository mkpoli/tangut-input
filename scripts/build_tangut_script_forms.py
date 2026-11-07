# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==11.3.0"]
# ///
"""Cut the recorded script forms out of their source images.

The 壽陵 title is one horizontal strip of sixteen seal-script characters. The file's description
gives the sixteen Unicode characters in the strip's order; the blank columns between them are the
cut lines. Each crop goes to app/public/seal/shouling/ and the record to
app/data/tangut-script-forms.json.

    uv run scripts/build_tangut_script_forms.py
"""
import json
from datetime import date
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/shouling/seal-title.jpg'
OUT = ROOT / 'app/public/seal/shouling'
RECORD = ROOT / 'app/data/tangut-script-forms.json'

# The characters in the order the Commons file lists them, with the 夏漢字典 index the file gives.
CHARS = '𗴂𗹭𗂧𘜶𗓑𗍁𗼈𗣼𗫡𗤓𘓺𘋨𘗽𗳇𘋼𘝞'
INDEXES = ['1572', '1890', '2937', '4457', '4976', '0289', '2546', '2748', '2679', '3228', '0510', '5306', '0590', '0466', '5545', '4797']
# The blank columns that separate the characters, read from the file at its 612×49 pixels.
CUTS = [0, 38.5, 71, 109, 149, 183.5, 223.5, 262.5, 301, 341, 379, 417.5, 455, 494.5, 533.5, 571.5, 612]

SOURCE_INFO = {
    'id': 'shouling',
    'title': '壽陵碑額',
    'titleZh': '大白高國護城聖德至懿皇帝壽陵誌銘',
    'author': '唐吉訶德的侍從',
    'url': 'https://commons.wikimedia.org/wiki/File:%E8%A5%BF%E5%A4%8F%E6%96%87_%E5%A4%A7%E7%99%BD%E9%AB%98%E5%9C%8B%E8%AD%B7%E5%9F%8E%E8%81%96%E5%BE%B7%E8%87%B3%E6%87%BF%E7%9A%87%E5%B8%9D%E5%A3%BD%E9%99%B5%E8%AA%8C%E9%8A%98.jpg',
    'licence': 'CC BY-SA 4.0',
    'licenceUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'basedOn': '李範文《夏漢字典》 p. 90',
    'retrieved': '2026-11-07',
    'note': 'The sixteen characters in the order the file lists them.',
}


def main():
    image = Image.open(SOURCE).convert('RGB')
    if image.size != (612, 49):
        raise SystemExit(f'{SOURCE}: expected 612×49, found {image.size[0]}×{image.size[1]}')
    if len(CHARS) != 16 or len(CUTS) != 17:
        raise SystemExit('the sixteen characters and sixteen cuts do not line up')
    OUT.mkdir(parents=True, exist_ok=True)
    forms = []
    for i, char in enumerate(CHARS):
        left = round(CUTS[i])
        right = round(CUTS[i + 1])
        crop = image.crop((left, 0, right, image.height))
        name = f'{ord(char):04X}.png'
        crop.save(OUT / name)
        forms.append({
            'char': char,
            'script': 'seal',
            'source': 'shouling',
            'image': f'/seal/shouling/{name}',
            'position': i,
            'index': INDEXES[i],
            'width': crop.width,
            'height': crop.height,
        })
    record = {
        'format': 'tangut-script-forms/1',
        'built': date.today().isoformat(),
        'sources': [SOURCE_INFO],
        'forms': forms,
    }
    RECORD.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(forms)} forms → {RECORD.relative_to(ROOT)} and {OUT.relative_to(ROOT)}/')


if __name__ == '__main__':
    main()
