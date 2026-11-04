#!/usr/bin/env python3
"""Fetch the books in data/books/files.tsv, or check what is already on disk.

The scans are large and stay in cache/books/, which git does not carry. Each file records the route
it came by — a library's own PDF, a Commons upload, or a content address — and its md5, so a
re-fetch is verified against the copy that was keyed from and a bad answer is thrown away.

    uv run scripts/fetch_books.py --work nevsky-1960
    uv run scripts/fetch_books.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import re
import shutil
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
COLUMNS = ("path", "work_id", "md5", "bytes", "pages", "px", "route", "alt", "status")
STATUSES = {"acquired", "pending"}
PROBLEMS: list[str] = []


class Bad(Exception):
    """A row or a file that cannot be used as recorded."""


def md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


def works() -> dict[str, dict[str, str]]:
    """source.yaml as work id → its fields, read far enough for the checks below."""
    path = BOOKS / "source.yaml"
    if not path.exists():
        sys.exit(f"missing {path}")
    out: dict[str, dict[str, str]] = {}
    current: dict[str, str] | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("  - id: "):
            current = {"id": line.split(":", 1)[1].strip()}
            out[current["id"]] = current
        elif current is not None and line.startswith("    ") and ":" in line:
            key, value = line.strip().split(":", 1)
            if key in {"status", "title"}:
                current[key] = value.strip()
    return out


def rows() -> list[dict[str, str]]:
    path = BOOKS / "files.tsv"
    if not path.exists():
        sys.exit(f"missing {path}")
    lines = path.read_text(encoding="utf-8").splitlines()
    head = lines[0].split("\t")
    absent = set(COLUMNS) - set(head)
    if absent:
        sys.exit(f"files.tsv has no {', '.join(sorted(absent))} column")
    out = []
    for number, line in enumerate(lines[1:], start=2):
        if not line.strip():
            continue
        fields = line.split("\t")
        if len(fields) != len(head):
            PROBLEMS.append(f"files.tsv:{number}: {len(fields)} fields where the header has {len(head)}")
            continue
        out.append(dict(zip(head, fields)))
    return out


def target_of(row: dict[str, str]) -> Path:
    """The cache path a row names, refused when it leaves cache/books/."""
    if not row["path"]:
        raise Bad(f"{row['work_id']}: empty path")
    if Path(row["path"]).is_absolute():
        raise Bad(f"{row['path']}: absolute path, files.tsv paths are relative to cache/books")
    target = (CACHE / row["path"]).resolve()
    if CACHE.resolve() not in target.parents:
        raise Bad(f"{row['path']}: escapes cache/books")
    return target


def route_urls(route: str) -> list[str]:
    if not route:
        return []
    if route.startswith("ipfs:"):
        return [f"{base}{route.removeprefix('ipfs:')}" for base in GATEWAYS]
    if route.startswith("libgen:"):
        return [route]
    if route.startswith(("https://", "http://")):
        return [route]
    raise Bad(f"unreadable route {route!r}")


def libgen_urls(md5sum: str) -> list[str]:
    """A libgen book's addresses, with the key that is minted on its ads page.

    The CDN answers prepared files; a book kept on another repository 500s there and is served by
    libgen.li itself, so both are tried.
    """
    page = f"https://libgen.li/ads.php?md5={md5sum}"
    done = subprocess.run(
        ["curl", "-sS", "-m", "60", "-A", UA, page], capture_output=True, text=True
    )
    if done.returncode != 0:
        raise Bad(f"libgen did not answer: {done.stderr.strip()}")
    found = re.search(r"get\.php\?md5=[a-f0-9]{32}&key=[A-Z0-9]+", done.stdout)
    if not found:
        raise Bad(f"no download key on {page}")
    return [f"https://cdn2.booksdl.lc/{found.group(0)}", f"https://libgen.li/{found.group(0)}"]


def download(url: str, target: Path, expected: str) -> str | None:
    """Fetch url to target, keeping it only when it hashes to expected. Returns why it did not."""
    partial = target.with_suffix(target.suffix + ".part")
    done = subprocess.run(
        ["curl", "-sSL", "--fail", "-m", "1800", "-A", UA, "-o", str(partial), url],
        capture_output=True,
        text=True,
    )
    if done.returncode != 0 or not partial.exists():
        partial.unlink(missing_ok=True)
        return done.stderr.strip() or f"curl exited {done.returncode}"
    got = md5(partial)
    if got != expected:
        kept = target.with_suffix(target.suffix + ".bad")
        partial.replace(kept)
        return f"md5 {got}, expected {expected}; kept as {kept.name}"
    partial.replace(target)
    return None


def fetch(row: dict[str, str]) -> int:
    try:
        target = target_of(row)
    except Bad as error:
        print(error)
        return 1
    if target.exists() and md5(target) == row["md5"]:
        print(f"{row['path']}: already on disk, md5 matches")
        return 0
    urls: list[str] = []
    for route in (row["route"], row.get("alt", "")):
        try:
            urls.extend(libgen_urls(route.removeprefix("libgen:")) if route.startswith("libgen:") else route_urls(route))
        except Bad as error:
            print(f"{row['path']}: {error}")
    if not urls:
        print(f"{row['path']}: no usable route")
        return 1
    target.parent.mkdir(parents=True, exist_ok=True)
    for url in urls:
        print(f"{row['path']}: trying {'/'.join(url.split('/')[:3])}")
        why = download(url, target, row["md5"])
        if why is None:
            print(f"  ok {target.stat().st_size} bytes")
            return 0
        print(f"  {why}")
    print(f"{row['path']}: no route gave the recorded file")
    return 1


def check(only: str | None) -> int:
    bad = 0
    known = works()
    seen: set[str] = set()
    for row in rows():
        if only is not None and row["work_id"] != only:
            continue
        try:
            target = target_of(row)
        except Bad as error:
            print(error)
            bad += 1
            continue
        if row["path"] in seen:
            print(f"{row['path']}: listed twice")
            bad += 1
        seen.add(row["path"])
        work = known.get(row["work_id"])
        if work is None:
            print(f"{row['path']}: work {row['work_id']} is not in source.yaml")
            bad += 1
        elif row["status"] != work.get("status"):
            print(f"{row['path']}: status {row['status']} here, {work.get('status')} in source.yaml")
            bad += 1
        if row["status"] not in STATUSES:
            print(f"{row['path']}: status {row['status']!r} is not one of {sorted(STATUSES)}")
            bad += 1
        if row["status"] == "pending" and not target.exists():
            print(f"{row['path']}: still pending")
        elif not target.exists():
            print(f"{row['path']}: absent, status says acquired")
            bad += 1
        elif not target.is_file():
            print(f"{row['path']}: not a file")
            bad += 1
        elif md5(target) != row["md5"]:
            print(f"{row['path']}: md5 differs from the recorded {row['md5']}")
            bad += 1
        else:
            print(f"{row['path']}: ok")
        left = target.with_suffix(target.suffix + ".part")
        if left.exists():
            print(f"{row['path']}: a .part file is left behind")
            bad += 1
        for route in (row["route"], row.get("alt", "")):
            try:
                route_urls(route)
            except Bad as error:
                print(f"{row['path']}: {error}")
                bad += 1
    keyed = {row["work_id"] for row in rows()}
    for work in sorted(set(known) - keyed):
        print(f"source.yaml has {work}, files.tsv has no file for it")
        bad += 1
    return 1 if bad else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work", help="only this work")
    parser.add_argument("--check", action="store_true", help="verify what is on disk")
    args = parser.parse_args()
    if not shutil.which("curl"):
        sys.exit("curl is not installed")
    selected = [row for row in rows() if args.work is None or row["work_id"] == args.work]
    if PROBLEMS:
        print("\n".join(PROBLEMS))
        return 1
    if args.work is not None and not selected:
        print(f"no row for {args.work}")
        return 1
    if args.check:
        return check(args.work)
    return max(fetch(row) for row in selected)


if __name__ == "__main__":
    raise SystemExit(main())
