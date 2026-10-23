// API tests: node --test server/
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from './server.mjs'

let server
let base

before(async () => {
  server = createServer({ dbPath: ':memory:' })
  await new Promise((r) => server.listen(0, r))
  base = `http://localhost:${server.address().port}`
})
after(() => new Promise((r) => server.close(r)))

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

const tx = { id: 't1', type: 'expense', amount: 12.5, description: 'Coffee', categoryId: 'eating', date: '2026-10-23' }

test('starts empty and unseeded', async () => {
  const { status, data } = await call('GET', '/api/state')
  assert.equal(status, 200)
  assert.deepEqual(data, { seeded: false, transactions: [], budgets: {} })
})

test('replaces the whole state and marks it seeded', async () => {
  const { data } = await call('PUT', '/api/state', { transactions: [tx], budgets: { eating: 150 } })
  assert.equal(data.seeded, true)
  assert.equal(data.transactions.length, 1)
  assert.deepEqual(data.budgets, { eating: 150 })
})

test('creates, updates and deletes a transaction', async () => {
  const created = await call('POST', '/api/transactions', { ...tx, id: 't2', description: '  Lunch  ' })
  assert.equal(created.status, 201)
  assert.equal(created.data.description, 'Lunch')

  const dup = await call('POST', '/api/transactions', { ...tx, id: 't2' })
  assert.equal(dup.status, 409)

  const updated = await call('PUT', '/api/transactions/t2', { ...tx, amount: 20 })
  assert.equal(updated.status, 200)
  assert.equal(updated.data.amount, 20)

  assert.equal((await call('DELETE', '/api/transactions/t2')).status, 204)
  assert.equal((await call('DELETE', '/api/transactions/t2')).status, 404)
})

test('updates a budget', async () => {
  const { status, data } = await call('PUT', '/api/budgets/eating', { amount: 400 })
  assert.equal(status, 200)
  assert.equal(data.amount, 400)
  const state = await call('GET', '/api/state')
  assert.equal(state.data.budgets.eating, 400)
})

test('rejects invalid input', async () => {
  assert.equal((await call('POST', '/api/transactions', { ...tx, id: 'x1', amount: -5 })).status, 400)
  assert.equal((await call('POST', '/api/transactions', { ...tx, id: 'x2', date: 'tomorrow' })).status, 400)
  assert.equal((await call('POST', '/api/transactions', { ...tx, id: 'x3', description: '' })).status, 400)
  assert.equal((await call('PUT', '/api/budgets/eating', { amount: 'lots' })).status, 400)
  assert.equal((await call('PUT', '/api/state', { nope: true })).status, 400)
  assert.equal((await call('GET', '/api/unknown')).status, 404)
})

test('a failed state replace leaves the data untouched', async () => {
  const before = await call('GET', '/api/state')
  const bad = await call('PUT', '/api/state', { transactions: [tx, { ...tx, id: 'bad', amount: 0 }], budgets: {} })
  assert.equal(bad.status, 400)
  const afterState = await call('GET', '/api/state')
  assert.deepEqual(afterState.data, before.data)
})
