# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==11.3.0"]
# ///
"""Cut the 壽陵 title's seal-script characters out of the 夏漢字典 plate.

Render the plate first, because the book is not in this repository:

    pdftoppm -f 8 -l 8 -r 300 -png '李范文（1997）『夏漢字典』.pdf' /tmp/xhzd-page
    uv run scripts/build_tangut_script_forms.py --page /tmp/xhzd-page-08.png

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

# The rendered page is 4517×6409 at 300 dpi. The grid sits at GRID, and each character in one of
# four columns and four rows.
PAGE = (4517, 6409)
GRID = (2057, 4326, 4114, 5869)
COLS = [(298, 565), (683, 928), (1020, 1278), (1366, 1603)]
ROWS = [(179, 515), (521, 878), (883, 1168), (1182, 1497)]
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
    left, top, _, _ = GRID
    OUT.mkdir(parents=True, exist_ok=True)
    forms = []
    for column, group in enumerate(ORDER):
        x0, x1 = COLS[3 - column]
        for row, zh in enumerate(group):
            y0, y1 = ROWS[row]
            crop = page.crop((left + x0, top + y0, left + x1, top + y1))
            crop = ImageOps.autocontrast(crop, cutoff=1)
            # Lift the paper to white and keep the line's soft edge.
            crop = crop.point(lambda value: 255 if value > 225 else value)
            # Pad the ink box so no stroke sits on the image edge.
            pad_x = max(8, round(crop.width * 0.12))
            pad_y = max(8, round(crop.height * 0.12))
            framed = Image.new('L', (crop.width + 2 * pad_x, crop.height + 2 * pad_y), 255)
            framed.paste(crop, (pad_x, pad_y))
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
