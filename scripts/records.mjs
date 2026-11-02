// Read back the record: what readers drew on the pad, and what characters they picked.
//
//   bun run records                     # the counts, the last ten drawings and the last twenty picks
//   bun run records --drawings 50 --picks 100
//   bun run records --sql "select finder, count(*) as n from picks group by finder order by n desc"
//
// The rows live in the D1 database the worker writes to, so this reads them with wrangler against
// the deployed copy. Nothing here is served to a visitor: the endpoint only takes writes.
import { execFileSync } from 'node:child_process'

const DATABASE = 'tangut-records'
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? fallback : args[i + 1]
}
const drawings = Number(option('drawings', 10))
const picks = Number(option('picks', 20))
const sql = option('sql')

/** @param {string} statement @returns {any[]} */
function query(statement) {
  const out = execFileSync('bunx', ['--no-install', 'wrangler', 'd1', 'execute', DATABASE, '--remote', '--json', '--command', statement], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const start = out.indexOf('[')
  if (start < 0) throw new Error(out.trim())
  const [page] = JSON.parse(out.slice(start))
  if (!page.success) throw new Error(JSON.stringify(page))
  return page.results
}

/** @param {any[]} rows */
function table(rows) {
  if (!rows.length) return '  (nothing yet)'
  const columns = Object.keys(rows[0])
  const width = Object.fromEntries(columns.map(c => [c, Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length))]))
  const line = (/** @type {any} */ row) => '  ' + columns.map(c => String(row[c] ?? '').padEnd(width[c])).join('  ')
  return [line(Object.fromEntries(columns.map(c => [c, c]))), '  ' + columns.map(c => '─'.repeat(width[c])).join('  '), ...rows.map(line)].join('\n')
}

if (sql) {
  console.log(table(query(sql)))
} else {
  const [counts] = query('select (select count(*) from drawings) as drawings, (select count(*) from picks) as picks, (select count(distinct session) from drawings) as sessions')
  console.log(`${counts.drawings} drawings and ${counts.picks} picks from ${counts.sessions} sessions\n`)
  console.log('last drawings')
  console.log(table(query(`select at, origin, answer, picked, place, stroke_count as strokes, pointer from drawings order by id desc limit ${drawings}`)))
  console.log('\nlast picks')
  console.log(table(query(`select at, char, finder, query, place, locale from picks order by id desc limit ${picks}`)))
}
