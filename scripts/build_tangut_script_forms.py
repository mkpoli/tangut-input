# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==11.3.0"]
# ///
"""Cut the 壽陵 title's seal-script characters out of the 夏漢字典 plate.

Render the plate first, because the book is not in this repository:

    pdftoppm -f 8 -l 8 -r 300 -png '李范文（1997）『夏漢字典』.pdf' /tmp/xhzd-page
    uv run scripts/build_tangut_script_forms.py --page /tmp/xhzd-page-0008.png

The plate is four columns, right to left, four characters top to bottom, in the order of its
Chinese translation: 大白高國 / 護城聖德 / 至懿皇帝 / 壽陵誌文. Each crop goes to
app/public/seal/shouling/ and the record to app/data/tangut-script-forms.json.
"""
import argparse
import json
from datetime import date
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/public/seal/shouling'
RECORD = ROOT / 'app/data/tangut-script-forms.json'

# The rendered page is 4517×6409 at 300 dpi. Each box below is the ink bounds of one character,
# measured on that render; the cutter pads every side equally so no stroke is cut and the
# character sits in the middle of its crop.
PAGE = (4517, 6409)
BOXES = {
    '大': (3417, 4546, 3692, 4835), '白': (3413, 4896, 3671, 5168),
    '高': (3409, 5191, 3666, 5475), '國': (3413, 5515, 3666, 5817),
    '護': (3063, 4538, 3333, 4844), '城': (3063, 4896, 3321, 5168),
    '聖': (3067, 5199, 3329, 5463), '德': (3067, 5528, 3346, 5821),
    '至': (2730, 4538, 3001, 4839), '懿': (2739, 4888, 2996, 5172),
    '皇': (2734, 5199, 2992, 5467), '帝': (2743, 5515, 2992, 5834),
    '壽': (2345, 4529, 2625, 4852), '陵': (2350, 4896, 2633, 5177),
    '誌': (2363, 5208, 2625, 5484), '銘': (2371, 5502, 2625, 5834),
}
# Columns right to left; in each, characters top to bottom.
ORDER = [
    ['大', '白', '高', '國'],
    ['護', '城', '聖', '德'],
    ['至', '懿', '皇', '帝'],
    ['壽', '陵', '誌', '銘'],
]
CHARS = {
    '大': '𘜶', '白': '𗴂', '高': '𗹭', '國': '𗂧', '護': '𗓑', '城': '𗍁', '聖': '𗼈', '德': '𗣼',
    '至': '𗫡', '懿': '𗤓', '皇': '𘓺', '帝': '𘋨', '壽': '𘗽', '陵': '𗳇', '誌': '𘋼', '銘': '𘝞',
}
SOURCE = {
    'id': 'shouling',
    'title': '篆額復原圖',
    'titleZh': '大白高國護城聖德至懿皇帝壽陵誌文',
    'author': '李范文',
    'book': '夏漢字典',
    'edition': '1997, front plate; 2008 edition p. 90',
    'licence': 'No licence stated',
    'note': 'The plate arranges the sixteen characters under the Chinese translation 大白高國 / 護城聖德 / 至懿皇帝 / 壽陵誌文. The forms are a modern tracing of the broken 碑額, not the stone itself.',
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--page', required=True, type=Path, help='the plate rendered at 300 dpi')
    args = parser.parse_args()
    page = Image.open(args.page).convert('L')
    if page.size != PAGE:
        raise SystemExit(f'{args.page}: expected {PAGE[0]}×{PAGE[1]}, found {page.size[0]}×{page.size[1]}')
    OUT.mkdir(parents=True, exist_ok=True)
    forms = []
    for group in ORDER:
        for zh in group:
            crop = page.crop(BOXES[zh])
            crop = ImageOps.autocontrast(crop, cutoff=1)
            # Lift the paper to white and keep the line's soft edge.
            crop = crop.point(lambda value: 255 if value > 225 else value)
            # Pad the ink box equally on every side so the character sits centred.
            pad = max(8, round(max(crop.width, crop.height) * 0.12))
            framed = Image.new('L', (crop.width + 2 * pad, crop.height + 2 * pad), 255)
            framed.paste(crop, (pad, pad))
            crop = framed
            char = CHARS[zh]
            name = f'{ord(char):04X}.png'
            crop.save(OUT / name)
            forms.append({
                'char': char,
                'script': 'seal',
                'source': 'shouling',
                'image': f'/seal/shouling/{name}',
                'position': len(forms),
                'width': crop.width,
                'height': crop.height,
            })
    record = {'format': 'tangut-script-forms/1', 'built': date.today().isoformat(), 'sources': [SOURCE], 'forms': forms}
    RECORD.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(forms)} forms → {RECORD.relative_to(ROOT)} and {OUT.relative_to(ROOT)}/')


if __name__ == '__main__':
    main()
