import { describe, test, expect } from 'bun:test'
import { createDrawingCapture } from '../src/core/drawing-capture.js'
import worker from '../app/worker.js'

const drawing = () => ({ origin: 'draw', strokes: [[[0.1, 0.2], [0.8, 0.9]]], width: 240, height: 240 })

describe('drawing snapshot capture', () => {
  test('clear preserves a rapid unlabeled attempt and owns its points', () => {
    const events = [], capture = createDrawingCapture(event => events.push(event))
    const ink = drawing()
    capture.update(ink)
    ink.strokes[0][0][0] = 1
    capture.clear()
    capture.clear()
    expect(events).toHaveLength(1)
    expect(events[0].strokes[0][0][0]).toBe(0.1)
    expect(events[0].picked).toBeUndefined()
  })

  test('a pick retains its label and suppresses the following clear/navigation capture', () => {
    const events = [], capture = createDrawingCapture(event => events.push(event))
    capture.update(drawing())
    expect(capture.capture({ picked: '𗀀', place: 2 })).toBe(true)
    capture.capture({ picked: '𗀀', place: 2 })
    capture.capture()
    capture.clear()
    expect(events).toHaveLength(1)
    expect(events[0].picked).toBe('𗀀')
    expect(events[0].place).toBe(2)
  })

  test('a pause captures completed strokes before any candidate is chosen', async () => {
    const events = [], capture = createDrawingCapture(event => events.push(event), 1)
    capture.update(drawing())
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(events).toHaveLength(1)
    capture.capture({ picked: '𗀀' })
    capture.clear()
    expect(events.map(event => event.picked)).toEqual([undefined, '𗀀'])
  })

  test('undo preserves the prior version and the remaining drawing', () => {
    const events = [], capture = createDrawingCapture(event => events.push(event))
    const ink = drawing()
    ink.strokes.push([[0.4, 0.5]])
    capture.update(ink)
    capture.capture()
    ink.strokes.pop()
    capture.update(ink)
    capture.clear()
    expect(events.map(event => event.strokes.length)).toEqual([2, 1])
  })
})

test('record endpoint stores unlabeled drawings alongside picked and quiz labels', async () => {
  const rows = []
  const DB = {
    prepare(sql) { return { bind(...values) { return { sql, values } } } },
    async batch(statements) { rows.push(...statements) },
  }
  const response = await worker.fetch(new Request('https://example.test/api/record', {
    method: 'POST', body: JSON.stringify([
      { type: 'drawing', ...drawing() },
      { type: 'drawing', ...drawing(), picked: '𗀀' },
      { type: 'drawing', ...drawing(), origin: 'quiz', answer: '𗀁' },
      { type: 'drawing', ...drawing(), origin: 'sketch', picked: '⿰木口' },
    ]),
  }), { DB })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ stored: 4 })
  expect(rows.map(row => row.values[5])).toEqual([null, '𗀀', null, '⿰木口'])
  expect(rows[2].values[3]).toBe('𗀁')
})
