// Written from `benchmark/history.json`; the dataset page reads it to show the climb.
export const history = [
  {
    "version": "0.1.0",
    "change": "Position only: chamfer distance between the drawing's ink and each glyph's skeleton; no direction term, no stroke count",
    "top1": 0.208,
    "top5": 0.443,
    "top24": 0.604,
    "mrr": 0.315,
    "measured": true
  },
  {
    "version": "0.2.0",
    "change": "Direction weight 2, stroke weight 0.35, re-rank the first 150 by 4×4 block direction at 0.5 — the settings the earlier sweep chose on 80 drawings",
    "top1": 0.321,
    "top5": 0.575,
    "top24": 0.755,
    "mrr": 0.44,
    "measured": true
  },
  {
    "version": "0.3.0",
    "change": "Direction weight 1: position counts for more than the way the pen ran",
    "top1": 0.34,
    "top5": 0.604,
    "top24": 0.764,
    "mrr": 0.459,
    "measured": true
  },
  {
    "version": "0.3.1",
    "change": "Same matcher, a larger reviewed corpus behind the figures: 296 drawings, 283 verdicts",
    "top1": 0.344,
    "top5": 0.609,
    "top24": 0.758,
    "mrr": 0.461,
    "measured": true
  }
]
