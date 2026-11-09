"""Synthesise handwriting from the glyph skeletons, and train a small recogniser on it.

The corpus holds 6,144 characters but only a few dozen drawings made by hand, so a model cannot be
trained on drawings. It is trained on strokes sampled from the skeletons the drawing pad already
uses, perturbed the way a hand perturbs them, and judged on the drawings made by hand, which it
never sees in training.

    uv run --with torch --with numpy scripts/handwriting/train.py --classes 1000 --samples 2 --epochs 3

Writes `model.pt` and, with `--onnx`, `model.onnx` beside the checkout's data directory.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import random
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SIZE = 32


def read_shapes(name: str) -> tuple[list[str], np.ndarray]:
    """The packed pen lines of one face, as a (characters, 32, 32) array of 0/1."""
    raw = gzip.decompress((ROOT / "app/data" / name).read_bytes())
    length = int.from_bytes(raw[:4], "little")
    header = json.loads(raw[4 : 4 + length])
    chars = header["chars"]
    packed = raw[4 + length :]
    count = len(chars)
    bits = np.unpackbits(np.frombuffer(packed, dtype=np.uint8), bitorder="little")
    masks = bits[: count * SIZE * SIZE].reshape(count, SIZE, SIZE).astype(np.float32)
    return chars, masks


def augment(mask: np.ndarray, rng: random.Random) -> np.ndarray:
    """A hand's version of a glyph: shifted, slanted, stretched, thickened, with a stroke dropped.

    Kept to whole-cell operations so the output stays a plausible drawing rather than a blurred
    photograph of one.
    """
    import numpy as np

    out = mask.copy()
    # Affine: small rotation, shear and scale around the centre.
    angle = rng.uniform(-0.18, 0.18)
    shear = rng.uniform(-0.15, 0.15)
    scale = rng.uniform(0.86, 1.12)
    cos, sin = math.cos(angle), math.sin(angle)
    matrix = np.array(
        [
            [cos * scale, (shear * cos - sin) * scale, 0.0],
            [sin * scale, (shear * sin + cos) * scale, 0.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float32,
    )
    centre = (SIZE - 1) / 2
    shifted = np.array([[1, 0, -centre], [0, 1, -centre], [0, 0, 1]], dtype=np.float32)
    back = np.array([[1, 0, centre], [0, 1, centre], [0, 0, 1]], dtype=np.float32)
    total = back @ matrix @ shifted
    grid = np.zeros_like(out)
    for y in range(SIZE):
        for x in range(SIZE):
            sx = total[0, 0] * x + total[0, 1] * y + total[0, 2]
            sy = total[1, 0] * x + total[1, 1] * y + total[1, 2]
            ix, iy = int(round(sx)), int(round(sy))
            if 0 <= ix < SIZE and 0 <= iy < SIZE:
                grid[y, x] = out[iy, ix]
    # A stroke left out, as a hand does at the end of a character.
    if rng.random() < 0.25:
        row = rng.randrange(SIZE)
        col = rng.randrange(SIZE)
        if rng.random() < 0.5:
            grid[row, :] *= 0.0
        else:
            grid[:, col] *= 0.0
    # A thicker pen.
    if rng.random() < 0.5:
        grown = grid.copy()
        grown[1:, :] = np.maximum(grown[1:, :], grid[:-1, :])
        grown[:-1, :] = np.maximum(grown[:-1, :], grid[1:, :])
        grown[:, 1:] = np.maximum(grown[:, 1:], grid[:, :-1])
        grown[:, :-1] = np.maximum(grown[:, :-1], grid[:, 1:])
        grid = grown
    if grid.sum() == 0:
        grid = out
    return grid


def to_input(mask: np.ndarray) -> np.ndarray:
    """The pad's 32-cell grid as a 64-pixel image the network can see details in."""
    from PIL import Image

    image = Image.fromarray((mask * 255).astype(np.uint8), mode="L").resize((64, 64), Image.BILINEAR)
    return np.asarray(image, dtype=np.float32)[None, :, :] / 255.0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--classes", type=int, default=1000, help="how many characters to train on")
    parser.add_argument("--stages", default="", help="comma-separated class counts, trained in order")
    parser.add_argument("--samples", type=int, default=2, help="synthetic drawings per character")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch", type=int, default=64)
    parser.add_argument("--embed", type=int, default=256, help="size of the embedding before the classes")
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--judge", action="store_true", help="score the drawings made by hand after training")
    parser.add_argument("--onnx", action="store_true")
    parser.add_argument("--out", default=str(ROOT / "model.pt"))
    options = parser.parse_args()

    import torch
    from torch import nn

    torch.manual_seed(7)
    random.seed(7)

    chars, masks = read_shapes("tangut-shapes.bin.gz")
    pool = [i for i, char in enumerate(chars) if 0x17000 <= ord(char) <= 0x187FF]
    random.shuffle(pool)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("device", device)

    class Recogniser(nn.Module):
        """A convolutional trunk and a cosine head: with thousands of classes and few drawings each,
        comparing directions learns where a plain linear layer saturates at chance."""

        def __init__(self, embedding: int, classes: int) -> None:
            super().__init__()
            self.trunk = nn.Sequential(
                nn.Conv2d(1, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(), nn.MaxPool2d(2),
                nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(), nn.MaxPool2d(2),
                nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.MaxPool2d(2),
                nn.Flatten(), nn.Linear(128 * 8 * 8, embedding), nn.ReLU(),
            )
            self.head = nn.Parameter(torch.randn(classes, embedding) * 0.05)
            self.scale = nn.Parameter(torch.tensor(12.0))

        def forward(self, x):
            z = self.trunk(x)
            z = z / z.norm(dim=1, keepdim=True).clamp(min=1e-6)
            w = self.head / self.head.norm(dim=1, keepdim=True).clamp(min=1e-6)
            return self.scale * (z @ w.t())

    stages = [int(part) for part in options.stages.split(",")] if options.stages else [options.classes]
    stages = [size for size in stages if size]
    seen: list[int] = []
    classes: list[str] = []
    model = Recogniser(options.embed, stages[0]).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=options.lr)
    loss_of = nn.CrossEntropyLoss()

    # A curriculum: the head starts narrow enough to fit, and grows by taking in more characters
    # with their rows freshly initialised. Starting at the full 6,136 left the head at chance.
    for stage, wanted in enumerate(stages):
        fresh = pool[len(seen) : len(seen) + wanted - len(seen)] if wanted > len(seen) else []
        new_indices = fresh
        keep = seen + new_indices
        if seen and wanted > len(seen):
            grown = torch.randn(len(keep), options.embed, device=device) * 0.05
            grown[: len(seen)] = model.head.detach()
            model.head = nn.Parameter(grown)
            model.head.to(device)
            optimizer = torch.optim.AdamW(model.parameters(), lr=options.lr)
        seen = keep
        classes = [chars[i] for i in keep]
        print(f"stage {stage + 1}: {len(classes)} characters")

        features, labels = [], []
        for label, index in enumerate(keep):
            for _ in range(options.samples):
                features.append(to_input(augment(masks[index], random)))
                labels.append(label)
        data = torch.from_numpy(np.stack(features))
        target = torch.tensor(labels, dtype=torch.long)

        for epoch in range(options.epochs):
            order = torch.randperm(len(data))
            total, right, running = 0, 0, 0.0
            for start in range(0, len(data), options.batch):
                batch = order[start : start + options.batch]
                x, y = data[batch].to(device), target[batch].to(device)
                optimizer.zero_grad()
                logits = model(x)
                loss = loss_of(logits, y)
                loss.backward()
                optimizer.step()
                running += float(loss.detach()) * len(batch)
                right += int((logits.argmax(1) == y).sum())
                total += len(batch)
            print(f"  epoch {epoch + 1}: loss {running / total:.3f}, seen top-1 {right / total:.3f}")

    torch.save({"classes": classes, "state": model.state_dict()}, options.out)
    print("wrote", options.out)

    if options.judge:
        judge(model, classes, device)


def judge(model, classes: list[str], device: str) -> None:
    """How the model does on the drawings made by hand, which it never trained on."""
    import torch

    annotations = json.loads((ROOT / "data/handwriting/annotations.json").read_text())["notes"]
    index_of = {char: i for i, char in enumerate(classes)}
    drawings = []
    for ident, note in annotations.items():
        if note.get("verdict") != "good":
            continue
        path = ROOT / "data/handwriting" / ident
        if not path.exists():
            continue
        record = json.loads(path.read_text())
        if record["char"] in index_of:
            drawings.append(record)

    if not drawings:
        print("no fair drawings among the trained characters")
        return

    model.eval()
    first = five = total = 0
    for record in drawings:
        mask = sketch(record["strokes"])
        if mask is None:
            continue
        x = torch.from_numpy(to_input(mask))[None].to(device)
        with torch.no_grad():
            ranking = model(x)[0].argsort(descending=True).tolist()
        at = ranking.index(index_of[record["char"]])
        total += 1
        first += at == 0
        five += at < 5
    print(f"hand drawings: {total} judged, first {first / total:.2f}, in five {five / total:.2f}")


def sketch(strokes, size: int = SIZE):
    """The pad's strokes drawn into the same square the masks are in."""
    import numpy as np

    grid = np.zeros((size, size), dtype=np.float32)
    points = [[(x, y) for x, y in stroke] for stroke in strokes]
    flat = [p for stroke in points for p in stroke]
    if not flat:
        return None
    xs = [p[0] for p in flat]
    ys = [p[1] for p in flat]
    span_x = max(max(xs) - min(xs), 1e-6)
    span_y = max(max(ys) - min(ys), 1e-6)
    scale = (size - 2) / max(span_x, span_y)
    ox = (size - span_x * scale) / 2
    oy = (size - span_y * scale) / 2
    for stroke in points:
        for i in range(1, len(stroke)):
            x0, y0 = stroke[i - 1]
            x1, y1 = stroke[i]
            steps = int(max(abs(x1 - x0), abs(y1 - y0)) * scale * 2) + 1
            for step in range(steps + 1):
                x = (x0 + (x1 - x0) * step / steps - min(xs)) * scale + ox
                y = (y0 + (y1 - y0) * step / steps - min(ys)) * scale + oy
                ix, iy = int(x), int(y)
                if 0 <= ix < size and 0 <= iy < size:
                    grid[iy, ix] = 1.0
    return grid


if __name__ == "__main__":
    main()
