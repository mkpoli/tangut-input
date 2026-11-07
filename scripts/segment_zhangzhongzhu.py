# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=12"]
# ///
"""Cut a 掌中珠 canvas into pages, bands and suggested columns.

The transcription needs to know where one column ends and the next begins before
any character is keyed. The print rules the page frame but not every column, so
what this writes is a starting point for a reader to confirm: bands found from
the row profile, columns from the column profile, both printed with native-pixel
ranges so a disagreement can be written down as a number.

For each canvas it writes page images with a ruler, one image per band with the
columns numbered in reading order (the bands read right to left, so column 1 is
at the right edge), and two tables: the bands, and the columns with their
native-pixel ranges. Images and tables go to cache/, which git ignores.
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


def pixels(image):
    """The pixel values, through whichever accessor the installed Pillow provides."""
    newer = getattr(image, 'get_flattened_data', None)
    return list(newer()) if newer else list(image.getdata())


def profile(box, axis):
    """Per-row or per-column means: grey levels for a grey image, ink for a binary one."""
    width, height = box.size
    if axis == 'row':
        return pixels(box.resize((1, height), Image.BOX))
    return pixels(box.resize((width, 1), Image.BOX))


def runs(values, threshold, merge, shortest):
    """Runs above a threshold, joined across small gaps and dropped when too short."""
    found, start = [], None
    for index, value in enumerate(values):
        if value > threshold:
            if start is None:
                start = index
        elif start is not None:
            found.append([start, index - 1])
            start = None
    if start is not None:
        found.append([start, len(values) - 1])
    merged = []
    for run in found:
        if merged and run[0] - merged[-1][1] <= merge:
            merged[-1][1] = run[1]
        else:
            merged.append(run)
    return [(a, b) for a, b in merged if b - a + 1 >= shortest]


def pages_of(grey):
    """The two pages of the spread. The gutter is dark, or darkest at the fold."""
    pages = runs(profile(grey, 'column'), 120, 4, 200)
    if len(pages) == 1 and pages[0][1] - pages[0][0] > 0.6 * WIDTH:
        start, end = pages[0]
        third = (end - start) // 3
        low, high = start + third, end - third
        folded = pixels(grey.crop((low, 0, high, grey.size[1])).resize((high - low, 1), Image.BOX))
        cut = low + min(range(len(folded)), key=lambda i: folded[i])
        pages = [(start, cut), (cut + 1, end)]
    return pages


def paper_of(grey, x0, x1):
    """The rows of the page itself, so the black surround is not read as ink."""
    rows = runs(profile(grey.crop((x0, 0, x1, grey.size[1])), 'row'), 120, 10, 200)
    if not rows:
        return None
    return max(rows, key=lambda run: run[1] - run[0])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--canvas', type=int, default=40)
    parser.add_argument('--ink', type=int, default=110, help='grey level below which a pixel counts as ink')
    parser.add_argument('--column-merge', type=int, default=3, help='gap in working pixels joined into one column')
    parser.add_argument('--pages', action='store_true', help='also write one image per page, ruled every 200 px')
    parser.add_argument('--grid', action='store_true', help='write page images with a labelled grid every 100 px')
    options = parser.parse_args()

    image = canvas_image(options.canvas)
    full_width, full_height = image.size
    scale = WIDTH / full_width
    grey = image.resize((WIDTH, round(full_height * scale)), Image.BOX)
    work = grey.point(lambda p: 255 if p < options.ink else 0)

    pages = pages_of(grey)[:2]
    if len(pages) < 2:
        sys.exit('could not find two pages; the canvas may be a cover')

    if options.grid:
        # A plain coordinate grid over the page: the bands are not ruled in this
        # print and the row profile does not find them reliably, so the reader
        # reads positions off the grid instead of trusting a detected box.
        for side, (x0, x1) in zip('lr', pages):
            paper = paper_of(grey, x0, x1)
            if not paper:
                continue
            top, bottom = paper
            left, right = int(x0 / scale), int(x1 / scale)
            crop = image.crop((left, int(top / scale), right, int(bottom / scale))).convert('RGB')
            grid = ImageDraw.Draw(crop)
            for tick in range(0, crop.size[0], 100):
                grid.line([(tick, 0), (tick, crop.size[1])], fill=(220, 120, 120), width=1)
                if tick % 500 == 0:
                    grid.text((tick + 2, 2), str(left + tick), fill=(180, 0, 0))
            for tick in range(0, crop.size[1], 100):
                grid.line([(0, tick), (crop.size[0], tick)], fill=(220, 120, 120), width=1)
                if tick % 500 == 0:
                    grid.text((2, tick + 2), str(int(top / scale) + tick), fill=(180, 0, 0))
            out = CACHE / f'{options.canvas:02d}-grid-{side}.png'
            crop.save(out)
            print(f'grid\t{side}\t{out.relative_to(ROOT)}', file=sys.stderr)

    if options.pages:
        for side, (x0, x1) in zip('lr', pages):
            paper = paper_of(grey, x0, x1)
            if not paper:
                continue
            top, bottom = paper
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
    columns_file = open(CACHE / f'{options.canvas:02d}-columns.tsv', 'w', encoding='utf-8', newline='')
    column_writer = csv.writer(columns_file, delimiter='\t', lineterminator='\n')
    column_writer.writerow(['canvas', 'side', 'band', 'column', 'x0', 'x1', 'width'])

    for side, (x0, x1) in zip('lr', pages):
        paper = paper_of(grey, x0, x1)
        if not paper:
            continue
        y0, y1 = paper
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
            # A ruler in native pixels, ticks every 100, so a boundary can be named.
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

    columns_file.close()


if __name__ == '__main__':
    main()
