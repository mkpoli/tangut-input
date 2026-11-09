"""Build the 文海 record and its fanqie chains from The Digital Wenhai.

The source is Mathieu Beaudouin's *The Digital Wenhai*, version 1.2: the normalised 文海 in
Unicode, its fanqie groups, the initial and rhyme chains the groups imply, the direct links between
their members, and the crossings and unresolved sets checked by hand. The release is pinned by
version DOI and checked by SHA-256, so a later version cannot slip in unnoticed.

    uv run scripts/build_tangut_wenhai.py [--dir RELEASE] [--out FILE]

`--dir` reads a local copy of the release instead of downloading it. The output keeps the fields
the site shows: each head's position, character, 同音 class, chain identifiers, tone rhyme and
rhyme-system context, whether it states its fanqie or inherits it, and Beaudouin's reconstruction;
every chain with its members, anchor and evidence; the direct links, grouped by chain; the two
crossing tables; and the six unresolved sets.
"""

import argparse
import csv
import datetime
import gzip
import hashlib
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/data/tangut-wenhai.json.gz'
RECORD = 23956653
VERSION_DOI = '10.5281/zenodo.23956653'
CONCEPT_DOI = '10.5281/zenodo.22256047'
URL = f'https://zenodo.org/records/{RECORD}/files/'

# The release's eight CSVs, with the digest of each in version 1.2: the count and name a chain is
# published under depend on exactly these rows.
FILES = {
    '01_wenhai.csv': ('b38c990456cfe4327c082792161b49009cac5836915949f77427d25fb76ece66', 241288),
    '02b_fanqie_groups.csv': ('917fbbb53dcc141cad6146b7ce9684d47752b878e63998b354795f5886c70751', 90035),
    '02c_fanqie_chains.csv': ('cf8a45143e9f81eab596e96b9caf1dfc1e69f5c32fa78736c121e90015f8afd1', 55744),
    '02d_fanqie_members.csv': ('5826831cf77c18c8e47e18d2bc7893195ff8da90abee07a8ac9c51dd3ddcfbc5', 121068),
    '02e_fanqie_links.csv': ('1223e441650ef9edd8dbcee8d730807af07c562247a7d7b81d8264b90d29119a', 477383),
    '02f_fanqie_initial_cross.csv': ('1ef0a0d80028ddf93a8094512d90d5263d63122dc5a853fe7ae3d87c99c1e79f', 4198),
    '02g_fanqie_rhyme_cross.csv': ('4c10e4cf593b212285feffc809e8238c809401f2999dc6035c9b78edb11fb5d6', 7217),
    '02h_fanqie_unresolved.csv': ('d6e760b569d21f802e7699fc8ff57f814fc72cbba6c8843c457c233632812256', 970),
}

# The counts the release states. The build refuses data that does not reproduce them.
EXPECTED = {
    'heads': 3085,
    'initial': 173,
    'rhyme': 321,
    'initialCross': 8,
    'rhymeCross': 13,
    'unresolved': 6,
}

SOURCE = {
    'name': 'The Digital Wenhai',
    'subtitle': 'A Unicode-Compliant Dataset of the Backbone of Tangut Linguistics and Philology',
    'author': 'Mathieu Beaudouin',
    'orcid': '0000-0002-9267-7734',
    'affiliation': 'University of Cambridge',
    'version': '1.2: Phonology',
    'published': '2026-11-04',
    'record': RECORD,
    'doi': CONCEPT_DOI,
    'versionDoi': VERSION_DOI,
    'url': f'https://zenodo.org/records/{RECORD}',
    'licence': 'CC BY 4.0',
    'licenceUrl': 'https://creativecommons.org/licenses/by/4.0/',
    'citation': ('Beaudouin, Mathieu. 2026. The Digital Wenhai: A Unicode-Compliant Dataset of the '
                 'Backbone of Tangut Linguistics and Philology. Version 1.2: Phonology. Zenodo. '
                 f'https://doi.org/{CONCEPT_DOI}'),
}


def position_key(position: str) -> str:
    """A 文海 position without the variant suffix: the key a governed position is filed under."""
    return position.rstrip('abc*')


def node_char(node: str) -> str:
    """The character a graph node names: a reading-specific node keeps its suffix in the node."""
    return node[0]


def read_rows(raw: bytes) -> list[dict[str, str]]:
    """A release CSV as rows; a byte-order mark is left to the reader's dialect."""
    return list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))


def parse_members(text: str) -> list[str]:
    return text.split()


def build(heads: list[dict[str, str]], groups: list[dict[str, str]], chains: list[dict[str, str]],
          links: list[dict[str, str]], initial_cross: list[dict[str, str]],
          rhyme_cross: list[dict[str, str]], unresolved: list[dict[str, str]],
          member_rows: list[dict[str, str]]) -> dict:
    """The document the site reads, from the release's tables."""
    # Which statement governs each position: a fanqie is written once and inherited by the
    # positions that follow it.
    governed: dict[str, dict[str, str]] = {}
    for group in groups:
        for position in parse_members(group['Governed positions']):
            governed.setdefault(position_key(position), group)

    records = []
    for row in heads:
        group = governed.get(position_key(row['WenhaiPos']))
        record = {
            'pos': row['WenhaiPos'],
            'char': row['Tangut'],
            'ty': row['InitialTY'] or None,
            'initial': row['InitialClassID'] or None,
            'rhyme': row['RhymeClassID'] or None,
            'tr': row['ToneRhyme'] or None,
            'grade': row['Grade'] or None,
            'cycle': row['Cycle'] or None,
            'she': row['She'] or None,
            'subcycle': row['Subcycle'] or None,
            'fanqie': group['Fanqie'] if group else None,
            'stated': bool(row['Fanqie'].strip()),
            'via': group['FanqieBase'] if group else None,
            'mb': row['MB'] or None,
        }
        records.append(record)

    # Each chain's tone rhymes come from its head members; the release's cross tables name the
    # junctions at which the classes meet, and are kept beside the chain.
    junctions = {row['ClassID']: row.get('Chain junction(s)', '') for row in [*initial_cross, *rhyme_cross]}
    rhyme_evidence = {row['ClassID']: row.get('Evidence', '') for row in rhyme_cross}
    rhyme_crossing = {row['ClassID']: row for row in rhyme_cross}
    # The long member table repeats the chains' membership; it is the release's own join key.
    recorded: dict[tuple[str, str], list[str]] = {}
    for row in member_rows:
        recorded.setdefault((row['Graph'], row['ClassID']), []).append(row['Member'])
    cross_ids = {row['ClassID'] for row in initial_cross} | {row['ClassID'] for row in rhyme_cross}
    # A chain's members are graph nodes, which is the head's character where it has a reading of
    # its own (a suffixed node for the two characters read two ways).
    tone_by_node = {record['char']: record['tr'] for record in records if record['tr']}

    initial, rhyme = [], []
    for row in chains:
        members = parse_members(row['Members'])
        chain = {
            'id': row['ClassID'],
            'size': int(row['Size']),
            'anchor': row['Anchor'],
            'members': members,
            'evidence': row['Upper-speller TY evidence'] if row['Graph'] == 'Initial' else rhyme_evidence.get(row['ClassID']),
            'junctions': junctions.get(row['ClassID']) or None,
            'cross': row['ClassID'] in cross_ids,
        }
        if row['Graph'] == 'Initial':
            chain['ty'] = row['TY']
            chain['uppers'] = parse_members(row['UpperSpellers'])
            initial.append(chain)
        else:
            level, other = set(), set()
            for member in members:
                tone_rhyme = tone_by_node.get(member)
                if not tone_rhyme:
                    continue
                (level if tone_rhyme.startswith('1.') else other).add(tone_rhyme)
            # A lower speller need not be a head, and then the release records no tone rhyme for
            # it. The crossing table states the full distribution for the chains it checks.
            partial = any(member not in tone_by_node for member in members)
            published = rhyme_crossing.get(row['ClassID'])
            if published:
                level = {code.strip() for code in published['Level ToneRhymes'].split(',') if code.strip()}
                other = {code.strip() for code in published['Other ToneRhymes'].split(',') if code.strip()}
                partial = False
            chain['level'] = sorted(level)
            chain['other'] = sorted(other)
            chain['partial'] = partial
            rhyme.append(chain)

    # The member table must reproduce the chains it is filed under.
    for graph, list_ in (('Initial', initial), ('Rhyme', rhyme)):
        for chain in list_:
            rows = recorded.get((graph, chain['id']), [])
            if sorted(rows) != sorted(chain['members']):
                raise SystemExit(f"{chain['id']}: 02c and 02d do not agree on its members")
    unknown = set(recorded) - {('Initial', chain['id']) for chain in initial} - {('Rhyme', chain['id']) for chain in rhyme}
    if unknown:
        raise SystemExit(f'02d names chains 02c does not publish: {sorted(unknown)[:3]}')

    # The direct edges, per chain: a chain is a connected component, and its links show what holds
    # it together. `co-governed` marks a set the statement governs; the others name a speller.
    direct: dict[str, dict[str, list]] = {'initial': {}, 'rhyme': {}}
    for row in links:
        # The edges of an unresolved set carry no chain ID; the set's own members record them.
        if not row['ClassID']:
            continue
        graph = row['Graph'].lower()
        direct[graph].setdefault(row['ClassID'], []).append([
            row['Node'], row['LinkedTo'], row['Relation'], row['FanqieBase'], row['GovernedBase'],
        ])

    return {
        'built': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'source': {**SOURCE, 'files': [
            {'name': name, 'sha256': digest, 'bytes': size}
            for name, (digest, size) in FILES.items()
        ]},
        'stats': {
            'heads': len(records),
            'characters': len({record['char'] for record in records}),
            'initial': len(initial),
            'rhyme': len(rhyme),
            'initialCross': len(initial_cross),
            'rhymeCross': len(rhyme_cross),
            'unresolved': len(unresolved),
        },
        'heads': records,
        'initial': initial,
        'rhyme': rhyme,
        'links': direct,
        'cross': {
            'initial': [row['ClassID'] for row in initial_cross],
            'rhyme': [row['ClassID'] for row in rhyme_cross],
        },
        'unresolved': [
            {
                'graph': row['Graph'],
                'base': row['FanqieBase'],
                'fanqie': row['Fanqie'],
                'members': parse_members(row['Members']),
                'status': row['Status'],
            }
            for row in unresolved
        ],
    }


def check(document: dict) -> None:
    """Refuse a release whose own figures, or the site's reading of them, do not add up."""
    stats = document['stats']
    for key, expected in EXPECTED.items():
        if stats[key] != expected:
            raise SystemExit(f'{key}: {stats[key]} rows, the release states {expected}')
    chains = {chain['id']: chain for chain in [*document['initial'], *document['rhyme']]}
    for chain in chains.values():
        if chain['size'] != len(chain['members']):
            raise SystemExit(f"{chain['id']}: size {chain['size']}, {len(chain['members'])} members")
        ordered = sorted(chain['members'], key=lambda node: (ord(node[0]), node))
        if chain['anchor'] != ordered[0]:
            raise SystemExit(f"{chain['id']}: anchor {chain['anchor']}, first member {ordered[0]}")
    for record in document['heads']:
        for field, graph in (('initial', 'initial'), ('rhyme', 'rhyme')):
            if record[field] and record[field] not in chains:
                raise SystemExit(f"{record['pos']}: {field} chain {record[field]} is not published")
    crossings = {chain['id'] for chain in document['rhyme'] if len(chain['level']) > 1}
    if crossings != set(document['cross']['rhyme']):
        raise SystemExit(f'rhyme crossings: calculated {len(crossings)}, published '
                         f"{len(document['cross']['rhyme'])}")


def download(name: str) -> bytes:
    raw = urllib.request.urlopen(URL + name, timeout=60).read()
    digest, size = FILES[name]
    if len(raw) != size or hashlib.sha256(raw).hexdigest() != digest:
        raise SystemExit(f'{name}: not the file this builder was written for '
                         f'(sha256 {hashlib.sha256(raw).hexdigest()}, {len(raw)} bytes)')
    return raw


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dir', type=Path, help='a copy of the release, instead of downloading it')
    parser.add_argument('--out', type=Path, default=OUT)
    options = parser.parse_args()
    raw = {name: (options.dir / name).read_bytes() if options.dir else download(name) for name in FILES}
    document = build(
        read_rows(raw['01_wenhai.csv']),
        read_rows(raw['02b_fanqie_groups.csv']),
        read_rows(raw['02c_fanqie_chains.csv']),
        read_rows(raw['02e_fanqie_links.csv']),
        read_rows(raw['02f_fanqie_initial_cross.csv']),
        read_rows(raw['02g_fanqie_rhyme_cross.csv']),
        read_rows(raw['02h_fanqie_unresolved.csv']),
        read_rows(raw['02d_fanqie_members.csv']),
    )
    check(document)
    header = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.GzipFile(options.out, 'wb', mtime=0) as out:
        out.write(header)
    print(f"{document['stats']['heads']} heads, {document['stats']['initial']} initial and "
          f"{document['stats']['rhyme']} rhyme chains -> {options.out.relative_to(ROOT)} "
          f'({options.out.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
