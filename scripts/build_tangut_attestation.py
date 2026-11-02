# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==13.0.0"]
# ///
"""Build `app/data/tangut-attestation.json.gz` and the facsimile crops under `app/public/facsimile/`.

Two kinds of source are merged:

- the Glyph Atlas record of chapter 2 of the Tangut Bodhicaryāvatāra, with the edition's English
  translation, the link to ぶんぽ's reading of each line, and one box per character on the
  edition's facsimile;
- the Wikisource category of Tangut Buddhist texts, whose pages carry the running text only. The
  category snapshot is pinned by revision in `data/wikisource/pages.json`; this script reads that
  file, never the network.

For every character the output keeps the places that attest it. A character missing from it has no
attestation yet, and the page says so. Each facsimile box is cut from its strip as a small greyscale
WebP. A Wikisource place links to its page instead.

Set GLYPH_ATLAS to the Glyph Atlas checkout when it is not ~/projects/Philology/glyph-atlas. The
strips come from its `work/tangut/facsimile/`, which `scripts/build_tangut_facsimile.py` there
regenerates. Refresh the Wikisource snapshot with `python3 scripts/fetch_tangut_wikisource.py`.
"""
import gzip
import hashlib
import json
import os
import re
import urllib.parse
from datetime import date
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/data/tangut-attestation.json.gz'
CROPS = ROOT / 'app/public/facsimile/solonin-2024'
ATLAS = Path(os.environ.get('GLYPH_ATLAS', '~/projects/Philology/glyph-atlas')).expanduser()
TEXTS = ATLAS / 'data/tangut'
STRIPS = ATLAS / 'work/tangut/facsimile'
WIKISOURCE = ROOT / 'data/wikisource/pages.json'
TANGUT = re.compile(r'^[\U00017000-\U00018AFF\U00018D00-\U00018DFF]$')
CROP_HEIGHT = 128

# The edition, its rights, and the reading series the line links point to, as Glyph Atlas records them.
SOLONIN = {
    'id': 'solonin-2024',
    'kind': 'facsimile',
    'title': 'Śāntideva’s Bodhicaryāvatāra in Tangut Translation, chapter 2',
    'shortTitle': 'Bodhicaryāvatāra, chapter 2',
    'author': 'Kirill Solonin and Shintaro Arakawa',
    'year': 2024,
    'publisher': 'ILCAA, Tokyo University of Foreign Studies',
    'url': 'https://hdl.handle.net/10108/0002000647',
    'licence': 'CC BY 4.0',
    'manuscript': 'IOM RAS Tangut collection no. 781',
    'facsimile': '/facsimile/solonin-2024/{line}-{position}.webp',
    'facsimileCredit': 'Facsimile from the edition (CC BY 4.0), which reproduces photographs by the Institute of Ethnology, CASS. Boxes cut by Glyph Atlas; the page edge cuts the right side of line 2.1.1.',
    'reading': 'ぶんぽ, 西夏語公開自主ゼミ (note.com, 2024-12-30 to 2025-09-15)',
    'readingUrl': 'https://note.com/bunpo10381227',
}

# The five texts in the category, by the page id of each root page. The ids and revisions are pinned
# in the snapshot; a missing root stops the build instead of silently dropping a text.
WIKISOURCE_TEXTS = [
    {'pageid': 260270, 'slug': 'dragon-king', 'shortTitle': 'Dragon King’s question'},
    {'pageid': 260272, 'slug': 'high-king', 'shortTitle': 'High King Avalokitesvara Sutra'},
    {'pageid': 287138, 'slug': 'diamond', 'shortTitle': 'Diamond Sutra'},
    {'pageid': 287230, 'slug': 'twenty-five-questions', 'shortTitle': 'Twenty-five Questions'},
    {'pageid': 287253, 'slug': 'dharani', 'shortTitle': 'Great Compassion Dharani'},
]

# The punctuation and editorial marks kept beside the Tangut characters. Everything else in a
# template body (Latin transliteration, refs, tags) is not part of the transcription.
KEPT = set('，。、：；！？「」『』《》〈〉（）()[]〔〕…—·　 “”‘’□')


def table(name):
    path = TEXTS / f'bodhicaryavatara-ch2.{name}.tsv'
    rows = [row for row in path.read_text(encoding='utf-8').splitlines() if row and not row.startswith('#')]
    header = rows[0].split('\t')
    return [dict(zip(header, row.split('\t'))) for row in rows[1:]]


def crop(box, strips, path):
    """Cut one character box from its facsimile strip, scaled to a common height, in greyscale.

    An existing crop is kept, so a rebuild does not re-encode the 280 images. Delete the directory
    to re-cut them after the strips change.
    """
    if path.exists():
        return True
    page = box['image'].rsplit(':', 1)[1]
    source = STRIPS / f'facsimile-{page}.png'
    if not source.exists():
        return False
    if page not in strips:
        strips[page] = Image.open(source).convert('L')
    x, y, w, h = (int(box[key]) for key in ('x', 'y', 'w', 'h'))
    piece = strips[page].crop((x, y, x + w, y + h))
    scale = CROP_HEIGHT / h
    piece = piece.resize((max(1, round(w * scale)), CROP_HEIGHT), Image.Resampling.LANCZOS)
    piece.save(path, 'WEBP', quality=72, method=6)
    return True


def build_solonin(rows):
    lines = table('lines')
    boxes = {(row['line_id'], int(row['position'])): row for row in table('facsimile-characters')}
    CROPS.mkdir(parents=True, exist_ok=True)
    strips = {}

    out = {}
    cropped = 0
    for row in lines:
        line_id = row['line_id']
        suffix = line_id.split(':', 1)[1]
        out[line_id] = {
            'text': row['tangut'],
            'english': row['english'],
            'page': int(row['page']),
            'read': row['reading'] == 'read',
            'url': row['reading_url'],
            'label': suffix,
            'section': 'Chapter 2',
        }
        for position, char in enumerate(row['tangut'], 1):
            if not TANGUT.match(char):
                continue
            rows.setdefault(char, {}).setdefault(SOLONIN['id'], []).append([line_id, position])
            box = boxes.get((line_id, position))
            if box and crop(box, strips, CROPS / f'{suffix}-{position}.webp'):
                cropped += 1
    return SOLONIN, out, cropped


def top_templates(text):
    """Yield (start, end, name, inner) for each template at the top level of `text`."""
    i = 0
    while True:
        start = text.find('{{', i)
        if start < 0:
            return
        depth = 0
        j = start
        while j < len(text) - 1:
            if text.startswith('{{', j):
                depth += 1
                j += 2
            elif text.startswith('}}', j):
                depth -= 1
                j += 2
                if depth == 0:
                    break
            else:
                j += 1
        else:
            return
        inner = text[start + 2:j - 2]
        yield start, j, inner.split('|', 1)[0].strip(), inner
        i = j


def remove_template(text, name):
    out = []
    i = 0
    for start, end, found, _ in top_templates(text):
        if start < i:
            continue
        out.append(text[i:start])
        if found != name:
            out.append(text[start:end])
        i = end
    out.append(text[i:])
    return ''.join(out)


def remove_links(text):
    """Drop every `[[...]]`, including file captions and category tags."""
    out = []
    i = 0
    while True:
        start = text.find('[[', i)
        if start < 0:
            out.append(text[i:])
            return ''.join(out)
        out.append(text[i:start])
        depth = 0
        j = start
        while j < len(text) - 1:
            if text.startswith('[[', j):
                depth += 1
                j += 2
            elif text.startswith(']]', j):
                depth -= 1
                j += 2
                if depth == 0:
                    break
            else:
                j += 1
        i = j


def header_of(content):
    for _, _, name, inner in top_templates(content):
        if name == 'header':
            return inner
    return ''


def header_field(header, name):
    match = re.search(r'(?ms)^\s*\|\s*' + re.escape(name) + r'\s*=\s*(.*?)(?=^\s*\|\s*[A-Za-z]+\s*=|\Z)', header)
    return match.group(1).strip() if match else ''


def plain(text):
    """Wikitext reduced to readable text, for a header note."""
    text = re.sub(r'<ref\b[^>]*>.*?</ref>', '', text, flags=re.S)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = re.sub(r'\[https?://\S+\s+([^\]]+)\]', r'\1', text)
    text = re.sub(r'\[\[([^]|]*\|)?([^]]+)\]\]', r'\2', text)
    text = remove_template(text, 'Tangut')
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace("'''", '').replace("''", '')
    return re.sub(r'\s+', ' ', text).strip()


def header_title(header):
    """The Tangut and English titles in a header's title field."""
    value = header_field(header, 'title')
    tangut = ''
    for _, _, name, inner in top_templates(value):
        if name == 'Tangut':
            tangut = clean_tangut(inner.split('|', 1)[1] if '|' in inner else '')
            break
    english = re.search(r"''(.*?)''", value, re.S)
    if english:
        title = plain(english.group(1))
    else:
        title = plain(value)
    return tangut, title


def clean_tangut(text):
    """Keep the Tangut characters, punctuation and editorial marks, and one space for a run of space."""
    text = re.sub(r'<ref\b[^>]*>.*?</ref>', '', text, flags=re.S)
    text = re.sub(r'<ref\b[^>]*/>', '', text, flags=re.S)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = re.sub(r'\[\[[^\]]*\]\]', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    kept = ''.join(char for char in text if TANGUT.match(char) or char in KEPT)
    return re.sub(r'[ \t\r\n]+', ' ', kept).strip()


def section_from_comment(note):
    note = note.strip()
    match = re.match(r'(Question\s+\d+)', note, re.I)
    if match:
        return 'Question ' + match.group(1).split()[-1]
    if re.match(r'Chapter\s+\d+', note, re.I):
        return ''
    if re.match(r'(Preface|Sutra|Colophon|Vow|Wishing|Initial section|Mantra|Invitation|Yunhe|Votive)', note, re.I):
        return re.split(r'\s+\(', note, 1)[0].strip()
    return None


def page_lines(content):
    """The Tangut templates of a page, with the section comment that introduced each one."""
    content = remove_template(content, 'header')
    content = remove_links(content)
    events = []
    section = ''
    i = 0
    while i < len(content):
        comment = content.find('<!--', i)
        template = content.find('{{', i)
        if comment < 0 and template < 0:
            break
        if comment >= 0 and (template < 0 or comment < template):
            end = content.find('-->', comment + 4)
            if end < 0:
                break
            found = section_from_comment(content[comment + 4:end])
            if found is not None:
                section = found
            i = end + 3
            continue
        end = None
        depth = 0
        j = template
        while j < len(content) - 1:
            if content.startswith('{{', j):
                depth += 1
                j += 2
            elif content.startswith('}}', j):
                depth -= 1
                j += 2
                if depth == 0:
                    end = j
                    break
            else:
                j += 1
        if end is None:
            break
        inner = content[template + 2:end - 2]
        name = inner.split('|', 1)[0].strip()
        if name == 'Tangut':
            text = clean_tangut(inner.split('|', 1)[1] if '|' in inner else '')
            if text:
                events.append((section, text))
        i = end
    return events


def is_heading(text):
    return bool(re.fullmatch(r'《[^《》]*》', text))


def page_url(title):
    return 'https://wikisource.org/wiki/' + urllib.parse.quote(title.replace(' ', '_'), safe='/')


def build_wikisource(rows):
    snapshot = json.loads(WIKISOURCE.read_text(encoding='utf-8'))
    pages = snapshot['pages']
    by_id = {page['pageid']: title for title, page in pages.items()}
    sources = []
    lines = {}

    for entry in WIKISOURCE_TEXTS:
        root_title = by_id.get(entry['pageid'])
        if root_title is None:
            raise SystemExit(f'Wikisource snapshot lacks page id {entry["pageid"]}')
        root = pages[root_title]
        header = header_of(root['content'])
        title_tangut, title = header_title(header)
        source_id = f'wikisource-{entry["slug"]}'
        subpages = sorted(
            (found for found in snapshot['titles'] if found.startswith(root_title + '/')),
            key=lambda found: int(found.rsplit('/', 1)[1]) if found.rsplit('/', 1)[1].isdigit() else 0,
        )
        page_records = [{'title': root_title, 'url': page_url(root_title), 'revision': root['revision']}]
        page_records += [{'title': found, 'url': page_url(found), 'revision': pages[found]['revision']} for found in subpages]
        sources.append({
            'id': source_id,
            'kind': 'transcription',
            'title': title,
            'shortTitle': entry['shortTitle'],
            'titleTangut': title_tangut,
            'author': 'Wikisource contributors',
            'publisher': 'Wikisource',
            'url': page_url(root_title),
            'licence': 'CC BY-SA 4.0',
            'licenceUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
            'retrieved': snapshot['retrieved'],
            'revision': root['revision'],
            'note': plain(header_field(header, 'notes')),
            'pages': page_records,
        })

        def add_page(page_title, label_prefix, chapter=None):
            page = pages[page_title]
            number = 0
            for section, text in page_lines(page['content']):
                if is_heading(text):
                    continue
                number += 1
                if section.startswith('Question ') and text.startswith('《') and text.endswith('𘃪。'):
                    label = 'End title'
                    section = 'End title'
                    key = 'end'
                elif section.startswith('Question '):
                    label = section
                    key = 'q' + section.split()[-1]
                else:
                    label = f'{label_prefix}{number}' if label_prefix else str(number)
                    key = label.replace(' ', '-').lower()
                line_id = f'{source_id}:{key}'
                record = {
                    'text': text,
                    'label': label,
                    'url': page_url(page_title),
                    'revision': page['revision'],
                }
                if section:
                    record['section'] = section
                if chapter:
                    record['chapter'] = chapter
                    record.setdefault('section', f'Chapter {chapter}')
                lines[line_id] = record
                for position, char in enumerate(text, 1):
                    if TANGUT.match(char):
                        rows.setdefault(char, {}).setdefault(source_id, []).append([line_id, position])

        if subpages:
            add_page(root_title, 'front ')
            for page_title in subpages:
                suffix = page_title.rsplit('/', 1)[1]
                chapter = int(suffix) if suffix.isdigit() else None
                add_page(page_title, f'{chapter}.' if chapter is not None else '', chapter)
        else:
            prefix = 'front ' if entry['slug'] == 'diamond' else '' if entry['slug'] == 'twenty-five-questions' else 'line '
            add_page(root_title, prefix)
    return sources, lines


def main():
    rows = {}
    sources = []
    lines = {}

    source, found, cropped = build_solonin(rows)
    sources.append(source)
    lines.update(found)

    more_sources, more_lines = build_wikisource(rows)
    sources.extend(more_sources)
    lines.update(more_lines)

    characters = [char for line in lines.values() for char in line['text'] if TANGUT.match(char)]
    corpus_text = ' '.join(line['text'] for line in lines.values())
    document = {
        'built': date.today().isoformat(),
        'corpus': {
            'lines': len(lines),
            'characters': len(characters),
            'distinct': len(rows),
            'sources': len(sources),
            'sha256': hashlib.sha256(corpus_text.encode()).hexdigest(),
        },
        'sources': sources,
        'lines': lines,
        'rows': rows,
    }
    raw = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.GzipFile(OUT, 'wb', mtime=0) as out:
        out.write(raw)
    print(f'{len(rows)} characters in {len(lines)} lines from {len(sources)} sources, {cropped} crops, '
          f'{len(raw)} bytes raw, {OUT.stat().st_size} gzipped -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
