-- Every drawing a reader made and every character they picked, kept so the record can be read back
-- later. The shapes and the fields follow `app/lib/record.js` and `scripts/handwriting/quiz.js`.
CREATE TABLE IF NOT EXISTS drawings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,           -- when the row was written, ISO 8601
  session TEXT,               -- a random id the browser keeps
  origin TEXT NOT NULL,       -- 'draw' on the site, 'quiz' from the local quiz
  answer TEXT,                -- the character that was asked for, null on the site
  kind TEXT,                  -- 'glyph' or 'lookalike', from a quiz
  picked TEXT,                -- the character the reader chose, if one came of the drawing
  place INTEGER,              -- where it stood in the candidate list, from 0
  strokes TEXT NOT NULL,      -- JSON: [[[x, y], …], …], normalised to the pad
  stroke_count INTEGER NOT NULL,
  times TEXT,                 -- JSON, milliseconds per point
  pressure TEXT,              -- JSON, per point
  pointer TEXT,               -- mouse, pen or touch
  writer TEXT,                -- what the writer called themselves
  device TEXT,                -- platform and browser
  width INTEGER,
  height INTEGER
);
CREATE INDEX IF NOT EXISTS drawings_at ON drawings (at);

CREATE TABLE IF NOT EXISTS picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  session TEXT,
  char TEXT NOT NULL,
  finder TEXT,                -- the page the character came from
  query TEXT,                 -- what the reader had typed or drawn
  place INTEGER,              -- its place in the candidate list, from 0
  locale TEXT
);
CREATE INDEX IF NOT EXISTS picks_at ON picks (at);
CREATE INDEX IF NOT EXISTS picks_char ON picks (char);
