#!/usr/bin/env python3
"""Fetch the books in data/books/files.tsv, or check what is already on disk.

The scans are large and stay in cache/books/, which git does not carry. Each file records the route
it came by — a library's own PDF, a Commons upload, or an IPFS content address — and its md5, so a
re-fetch can be checked against the copy that was keyed from.

    uv run scripts/fetch_books.py --work nevsky-1960
    uv run scripts/fetch_books.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS = ROOT / "data" / "books"
CACHE = ROOT / "cache" / "books"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

GATEWAYS = (
    "https://ipfs.filebase.io/ipfs/",
    "https://ipfs.io/ipfs/",
    "https://dweb.link/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
)
CHUNK = 1 << 20


def rows() -> list[dict[str, str]]:
    lines = files_tsv().read_text(encoding="utf-8").splitlines()
    head = lines[0].split("\t")
    return [dict(zip(head, line.split("\t"))) for line in lines[1:] if line.strip()]


def files_tsv() -> Path:
    path = BOOKS / "files.tsv"
    if not path.exists():
        sys.exit(f"missing {path}")
    return path


def md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


def routes(row: dict[str, str]) -> list[str]:
    out: list[str] = []
    for route in (row["route"], row.get("alt", "")):
        if route.startswith("ipfs:"):
            out.extend(f"{base}{route.removeprefix('ipfs:')}" for base in GATEWAYS)
        elif route.startswith("libgen:") or route.startswith("https://"):
            out.append(route)
        elif route:
            sys.exit(f"unreadable route {route!r}")
    return out


def libgen_urls(md5sum: str) -> list[str]:
    """A libgen book's addresses, with the key that is minted on its ads page.

    The CDN answers prepared files; a book kept on another repository 500s there and is served by
    libgen.li itself, so both are tried.
    """
    page = f"https://libgen.li/ads.php?md5={md5sum}"
    html = subprocess.run(
        ["curl", "-sS", "-m", "60", "-A", UA, page], capture_output=True, text=True
    ).stdout
    found = re.search(r"get\.php\?md5=[a-f0-9]{32}&key=[A-Z0-9]+", html)
    if not found:
        raise LookupError(f"no download key on {page}")
    return [f"https://cdn2.booksdl.lc/{found.group(0)}", f"https://libgen.li/{found.group(0)}"]


def download(url: str, target: Path) -> bool:
    partial = target.with_suffix(target.suffix + ".part")
    done = subprocess.run(
        ["curl", "-sSL", "--fail", "-m", "1800", "-A", UA, "-o", str(partial), url],
        capture_output=True,
        text=True,
    )
    if done.returncode != 0 or not partial.exists():
        print(f"  {url.split('/')[2]}: {done.stderr.strip() or done.returncode}")
        partial.unlink(missing_ok=True)
        return False
    partial.replace(target)
    return True


def fetch(row: dict[str, str]) -> int:
    target = CACHE / row["path"]
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and md5(target) == row["md5"]:
        print(f"{row['path']}: already on disk, md5 matches")
        return 0
    urls: list[str] = []
    for route in routes(row):
        if route.startswith("libgen:"):
            print(f"{row['path']}: asking libgen for a key")
            try:
                urls.extend(libgen_urls(route.removeprefix("libgen:")))
            except Exception as error:  # noqa: BLE001
                print(f"  {error}")
        else:
            urls.append(route)
    for url in urls:
        print(f"{row['path']}: trying {'/'.join(url.split('/')[:3])}")
        if not download(url, target):
            continue
        got = md5(target)
        if got != row["md5"]:
            print(f"  md5 {got} does not match the recorded {row['md5']}; kept for a look")
            return 1
        print(f"  ok {target.stat().st_size} bytes")
        return 0
    print(f"{row['path']}: no route answered")
    return 1


def works() -> list[str]:
    return [
        line.split(":", 1)[1].strip()
        for line in (BOOKS / "source.yaml").read_text(encoding="utf-8").splitlines()
        if line.startswith("  - id: ")
    ]


def check() -> int:
    bad = 0
    known = set(works())
    for row in rows():
        target = CACHE / row["path"]
        if row["work_id"] not in known:
            print(f"{row['path']}: work {row['work_id']} is not in source.yaml")
            bad += 1
        elif row["status"] == "pending" and not target.exists():
            print(f"{row['path']}: still pending")
        elif not target.exists():
            print(f"{row['path']}: absent, status says acquired")
            bad += 1
        elif md5(target) != row["md5"]:
            print(f"{row['path']}: md5 differs from the recorded {row['md5']}")
            bad += 1
        else:
            print(f"{row['path']}: ok")
    return 1 if bad else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work", help="fetch only this work's files")
    parser.add_argument("--check", action="store_true", help="verify what is on disk")
    args = parser.parse_args()
    if args.check:
        return check()
    selected = [row for row in rows() if not args.work or row["work_id"] == args.work]
    if not selected:
        print(f"no row for {args.work}" if args.work else "nothing to fetch")
        return 1
    return max(fetch(row) for row in selected)


if __name__ == "__main__":
    raise SystemExit(main())
