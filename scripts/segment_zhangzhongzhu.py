# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=12"]
# ///
"""Cut a 掌中珠 canvas into bands and suggest the column boundaries in each.

The transcription needs to know where one column ends and the next begins before
any character is keyed. The print rules the entry groups but not every column,
so the suggestion here is a starting point for a reader to confirm, not an
answer: the bands are found from the row profile and the columns from the
column profile, and both are printed with their pixel ranges so a disagreement
can be written down as a number.

Writes one PNG per band under cache/zhangzhongzhu/, with a ruler along the top
in full-resolution pixels, and prints a TSV of the bands and their suggested
columns.
"""
import argparse
import csv
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'cache' / 'zhangzhongzhu'
BASE = 'https://kokusho.nijl.ac.jp/api/iiif/100354804/v4/SAIG/SAIG-00219/SAIG-00219-{file}.tif'
WIDTH = 1800  # the working width the profiles are measured at


def canvas_image(canvas):
    """The native-size image fetch_zhangzhongzhu.py writes, fetched if it is missing."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f'{canvas:02d}-native-native.jpg'
    if not path.exists():
        url = f'{BASE.format(file=f"{canvas - 1:05d}")}/full/full/0/default.jpg'
        with urllib.request.urlopen(url) as response, open(path, 'wb') as out:
            out.write(response.read())
    return Image.open(path).convert('L')


def runs(profile, threshold, merge, shortest):
    found, start = [], None
    for index, value in enumerate(profile):
        if value > threshold:
            if start is None:
                start = index
        elif start is not None:
            found.append([start, index - 1])
            start = None
    if start is not None:
        found.append([start, len(profile) - 1])
    merged = []
    for run in found:
        if merged and run[0] - merged[-1][1] <= merge:
            merged[-1][1] = run[1]
        else:
            merged.append(run)
    return [(a, b) for a, b in merged if b - a + 1 >= shortest]


def profile(box, axis):
    """Per-row or per-column sums: grey levels for a grey image, ink pixels for a binary one."""
    width, height = box.size
    if axis == 'row':
        return list(box.resize((1, height), Image.BOX).get_flattened_data())
    return list(box.resize((width, 1), Image.BOX).get_flattened_data())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--canvas', type=int, default=40)
    parser.add_argument('--ink', type=int, default=110, help='grey level below which a pixel counts as ink')
    parser.add_argument('--column-merge', type=int, default=3, help='gap in working pixels joined into one column')
    parser.add_argument('--pages', action='store_true', help='also write one image per page, ruled every 200 px')
    options = parser.parse_args()

    image = canvas_image(options.canvas)
    full_width, full_height = image.size
    scale = WIDTH / full_width
    grey = image.resize((WIDTH, round(full_height * scale)), Image.BOX)
    work = grey.point(lambda p: 255 if p < options.ink else 0)

    # The two pages: bright runs across the grey photograph, the gutter between them.
    pages = runs(profile(grey, 'column'), 120, 4, 200)
    if len(pages) < 2:
        sys.exit('could not find two pages; the canvas may be a cover')
    pages = pages[:2]

    if options.pages:
        for side, (x0, x1) in zip('lr', pages):
            paper = runs(profile(grey.crop((x0, 0, x1, grey.size[1])), 'row'), 120, 10, 200)
            top, bottom = max(paper, key=lambda run: run[1] - run[0])
            left, right = int(x0 / scale), int(x1 / scale)
            crop = image.crop((left, int(top / scale), right, int(bottom / scale))).convert('RGB')
            ruler = ImageDraw.Draw(crop)
            for tick in range(0, crop.size[0], 200):
                ruler.line([(tick, 0), (tick, 16)], fill=(200, 0, 0), width=2)
                ruler.text((tick + 2, 18), str(left + tick), fill=(200, 0, 0))
            for tick in range(0, crop.size[1], 200):
                ruler.line([(0, tick), (16, tick)], fill=(200, 0, 0), width=2)
                ruler.text((18, tick + 2), str(int(top / scale) + tick), fill=(200, 0, 0))
            out = CACHE / f'{options.canvas:02d}-page-{side}.png'
            crop.save(out)
            print(f'page\t{side}\t{out.relative_to(ROOT)}', file=sys.stderr)

    writer = csv.writer(sys.stdout, delimiter='\t', lineterminator='\n')
    writer.writerow(['canvas', 'side', 'band', 'y0', 'y1', 'x0', 'x1', 'columns', 'image'])
    # The columns on their own, numbered in reading order: the bands read right to
    # left, so column 1 is the rightmost. A reader marking where an entry starts
    # writes down a number here rather than describing a place.
    columns_out = CACHE / f'{options.canvas:02d}-columns.tsv'
    column_writer = csv.writer(open(columns_out, 'w', encoding='utf-8', newline=''), delimiter='\t', lineterminator='\n')
    column_writer.writerow(['canvas', 'side', 'band', 'column', 'x0', 'x1', 'width'])
    for side, (x0, x1) in zip('lr', pages):
        # The paper, so that the black surround is not read as ink.
        paper = runs(profile(grey.crop((x0, 0, x1, grey.size[1])), 'row'), 120, 10, 200)
        if not paper:
            continue
        y0, y1 = max(paper, key=lambda run: run[1] - run[0])
        # Bands: rows of ink on the paper, joined across the gaps between characters.
        rows = runs(profile(work.crop((x0, y0, x1, y1)), 'row'), 12, 25, 50)
        for band, (band0, band1) in enumerate(rows, 1):
            top, bottom = y0 + band0, y0 + band1
            columns = runs(profile(work.crop((x0, top, x1, bottom)), 'column'), 1.5, options.column_merge, 8)
            # A band with one or two columns is a margin or a section rule, not an entry band.
            if len(columns) < 3:
                continue
            # Profile coordinates are working pixels; the crop and the ruler are not.
            left, right = int(x0 / scale), int(x1 / scale)
            crop = image.crop((left, int(top / scale), right, int(bottom / scale))).convert('RGB')
            ruler = ImageDraw.Draw(crop)
            # A ruler in full-resolution pixels, ticks every 100, so a reader can
            # name a boundary instead of describing it.
            for tick in range(0, crop.size[0], 100):
                ruler.line([(tick, 0), (tick, 12)], fill=(200, 0, 0), width=2)
                if tick % 500 == 0:
                    ruler.text((tick + 2, 14), str(left + tick), fill=(200, 0, 0))
            # Column positions are relative to the page, so add x0 before scaling.
            for number, (start, end) in enumerate(reversed(columns), start=1):
                x0_native, x1_native = int((x0 + start) / scale), int((x0 + end) / scale)
                ruler.line([(x0_native - left, 0), (x0_native - left, crop.size[1])],
                           fill=(0, 120, 200), width=1)
                ruler.text((x0_native - left + 3, 22), str(number), fill=(0, 90, 160))
                column_writer.writerow([options.canvas, side, band, number, x0_native, x1_native,
                                        x1_native - x0_native])
            out = CACHE / f'{options.canvas:02d}-{side}-{band}.png'
            crop.save(out)
            writer.writerow([options.canvas, side, band, int(top / scale), int(bottom / scale),
                             left, right, len(columns), out.relative_to(ROOT)])
    column_writer.close()


if __name__ == '__main__':
    main()
