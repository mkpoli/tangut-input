// Written by hand from `benchmark/history.json`; the dataset page reads it to show the climb.
export const history = [
  {
    "version": "0.1",
    "change": "Position only: chamfer distance between the drawing's ink and each glyph's skeleton; no direction term, no stroke count",
    "top1": 0.208,
    "top5": 0.443,
    "top24": 0.604,
    "mrr": 0.315,
    "measured": true
  },
  {
    "version": "0.2",
    "change": "Direction weight 2, stroke weight 0.35, re-rank the first 150 by 4×4 block direction at 0.5 — the settings the earlier sweep chose on 80 drawings",
    "top1": 0.321,
    "top5": 0.575,
    "top24": 0.755,
    "mrr": 0.44,
    "measured": true
  },
  {
    "version": "0.3",
    "change": "Direction weight 1: position counts for more than the way the pen ran",
    "top1": 0.34,
    "top5": 0.604,
    "top24": 0.764,
    "mrr": 0.459,
    "measured": true
  }
]
