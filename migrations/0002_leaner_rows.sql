-- The reader sorts by id and never filters on a column, so the three indexes on the first migration
-- only cost a row written on every insert. A plain INTEGER PRIMARY KEY already gives ids that only
-- go up, and nothing here is ever deleted or updated, so the table is rebuilt without AUTOINCREMENT
-- and without the indexes. Both tables are small; the copy runs once.
DROP INDEX IF EXISTS drawings_at;
DROP INDEX IF EXISTS picks_at;
DROP INDEX IF EXISTS picks_char;

CREATE TABLE drawings_slim (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  session TEXT,
  origin TEXT NOT NULL,
  answer TEXT,
  kind TEXT,
  picked TEXT,
  place INTEGER,
  strokes TEXT NOT NULL,
  stroke_count INTEGER NOT NULL,
  times TEXT,
  pressure TEXT,
  pointer TEXT,
  writer TEXT,
  device TEXT,
  width INTEGER,
  height INTEGER
);
INSERT INTO drawings_slim (id, at, session, origin, answer, kind, picked, place, strokes, stroke_count, times, pressure, pointer, writer, device, width, height)
  SELECT id, at, session, origin, answer, kind, picked, place, strokes, stroke_count, times, pressure, pointer, writer, device, width, height FROM drawings;
DROP TABLE drawings;
ALTER TABLE drawings_slim RENAME TO drawings;

CREATE TABLE picks_slim (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  session TEXT,
  char TEXT NOT NULL,
  finder TEXT,
  query TEXT,
  place INTEGER,
  locale TEXT
);
INSERT INTO picks_slim (id, at, session, char, finder, query, place, locale)
  SELECT id, at, session, char, finder, query, place, locale FROM picks;
DROP TABLE picks;
ALTER TABLE picks_slim RENAME TO picks;
