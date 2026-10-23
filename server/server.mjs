// Selo API + static file server. No dependencies: Node's built-in http and SQLite.
// Env: PORT (default 3001), DB_PATH (default ./data/selo.db), STATIC_DIR (default ./dist)
import http from 'node:http'
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const MAX_BODY = 1_000_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^[\w-]{1,64}$/

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
      amount REAL NOT NULL CHECK (amount > 0),
      description TEXT NOT NULL,
      category_id TEXT NOT NULL,
      date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS transactions_date ON transactions (date);
    CREATE TABLE IF NOT EXISTS budgets (
      category_id TEXT PRIMARY KEY,
      amount REAL NOT NULL CHECK (amount >= 0)
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `)
  return db
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function validateTx(body, id) {
  const tx = {
    id: id ?? body?.id,
    type: body?.type,
    amount: Number(body?.amount),
    description: typeof body?.description === 'string' ? body.description.trim() : '',
    categoryId: body?.categoryId,
    date: body?.date,
  }
  if (typeof tx.id !== 'string' || !ID_RE.test(tx.id)) throw new HttpError(400, 'Invalid id')
  if (tx.type !== 'expense' && tx.type !== 'income') throw new HttpError(400, 'type must be expense or income')
  if (!Number.isFinite(tx.amount) || tx.amount <= 0 || tx.amount > 1_000_000)
    throw new HttpError(400, 'amount must be between 0 and 1,000,000')
  if (!tx.description || tx.description.length > 60) throw new HttpError(400, 'description must be 1–60 characters')
  if (typeof tx.categoryId !== 'string' || !ID_RE.test(tx.categoryId)) throw new HttpError(400, 'Invalid categoryId')
  if (typeof tx.date !== 'string' || !DATE_RE.test(tx.date)) throw new HttpError(400, 'date must be YYYY-MM-DD')
  tx.amount = Math.round(tx.amount * 100) / 100
  return tx
}

function validateBudget(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new HttpError(400, 'amount must be between 0 and 1,000,000')
  return Math.round(n * 100) / 100
}

export function createApi(db) {
  const q = {
    allTx: db.prepare('SELECT id, type, amount, description, category_id AS categoryId, date FROM transactions ORDER BY date DESC'),
    allBudgets: db.prepare('SELECT category_id AS categoryId, amount FROM budgets'),
    seeded: db.prepare("SELECT value FROM meta WHERE key = 'seeded'"),
    markSeeded: db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded', '1')"),
    insertTx: db.prepare(
      'INSERT INTO transactions (id, type, amount, description, category_id, date) VALUES (?, ?, ?, ?, ?, ?)',
    ),
    updateTx: db.prepare(
      'UPDATE transactions SET type = ?, amount = ?, description = ?, category_id = ?, date = ? WHERE id = ?',
    ),
    deleteTx: db.prepare('DELETE FROM transactions WHERE id = ?'),
    upsertBudget: db.prepare(
      'INSERT INTO budgets (category_id, amount) VALUES (?, ?) ON CONFLICT (category_id) DO UPDATE SET amount = excluded.amount',
    ),
  }

  const state = () => ({
    seeded: !!q.seeded.get(),
    transactions: q.allTx.all(),
    budgets: Object.fromEntries(q.allBudgets.all().map((b) => [b.categoryId, b.amount])),
  })

  const replaceAll = (body) => {
    if (!Array.isArray(body?.transactions) || typeof body?.budgets !== 'object' || body.budgets === null)
      throw new HttpError(400, 'Body must have transactions[] and budgets{}')
    const txs = body.transactions.map((t) => validateTx(t))
    const budgets = Object.entries(body.budgets).map(([id, amount]) => {
      if (!ID_RE.test(id)) throw new HttpError(400, 'Invalid budget category')
      return [id, validateBudget(amount)]
    })
    db.exec('BEGIN')
    try {
      db.exec('DELETE FROM transactions; DELETE FROM budgets;')
      for (const t of txs) q.insertTx.run(t.id, t.type, t.amount, t.description, t.categoryId, t.date)
      for (const [id, amount] of budgets) q.upsertBudget.run(id, amount)
      q.markSeeded.run()
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }

  return function handle(method, path, body) {
    if (method === 'GET' && path === '/api/health') return [200, { ok: true }]
    if (method === 'GET' && path === '/api/state') return [200, state()]
    if (method === 'PUT' && path === '/api/state') {
      replaceAll(body)
      return [200, state()]
    }
    if (method === 'POST' && path === '/api/transactions') {
      const t = validateTx(body)
      try {
        q.insertTx.run(t.id, t.type, t.amount, t.description, t.categoryId, t.date)
      } catch {
        throw new HttpError(409, 'A transaction with this id already exists')
      }
      return [201, t]
    }
    const txMatch = path.match(/^\/api\/transactions\/([\w-]{1,64})$/)
    if (txMatch && method === 'PUT') {
      const t = validateTx(body, txMatch[1])
      const r = q.updateTx.run(t.type, t.amount, t.description, t.categoryId, t.date, t.id)
      if (r.changes === 0) throw new HttpError(404, 'Transaction not found')
      return [200, t]
    }
    if (txMatch && method === 'DELETE') {
      const r = q.deleteTx.run(txMatch[1])
      if (r.changes === 0) throw new HttpError(404, 'Transaction not found')
      return [204, null]
    }
    const budgetMatch = path.match(/^\/api\/budgets\/([\w-]{1,64})$/)
    if (budgetMatch && method === 'PUT') {
      const amount = validateBudget(body?.amount)
      q.upsertBudget.run(budgetMatch[1], amount)
      return [200, { categoryId: budgetMatch[1], amount }]
    }
    throw new HttpError(path.startsWith('/api/') ? 404 : 405, 'Not found')
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

function serveStatic(staticDir, urlPath, res) {
  const root = resolve(staticDir)
  let file = normalize(join(root, decodeURIComponent(urlPath)))
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end()
    return
  }
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(root, 'index.html') // single-page app fallback
  }
  try {
    const data = readFileSync(file)
    const immutable = file.includes(`${sep}assets${sep}`)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found')
  }
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new HttpError(413, 'Body too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolveBody(undefined)
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new HttpError(400, 'Body must be valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

export function createServer({ dbPath = ':memory:', staticDir = 'dist' } = {}) {
  const db = openDb(dbPath)
  const handle = createApi(db)
  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end()
      return serveStatic(staticDir, pathname, res)
    }
    try {
      const body = ['POST', 'PUT'].includes(req.method ?? '') ? await readBody(req) : undefined
      const [status, payload] = handle(req.method, pathname, body)
      res.writeHead(status, payload === null ? {} : { 'Content-Type': 'application/json' })
      res.end(payload === null ? undefined : JSON.stringify(payload))
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      if (status === 500) console.error(e)
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: status === 500 ? 'Server error' : e.message }))
    }
  })
  server.on('close', () => db.close())
  return server
}

// Start when run directly: node server/server.mjs
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.env.PORT ?? 3001)
  const dbPath = process.env.DB_PATH ?? 'data/selo.db'
  const server = createServer({ dbPath, staticDir: process.env.STATIC_DIR ?? 'dist' })
  server.listen(port, () => console.log(`Selo running on http://localhost:${port} (database: ${dbPath})`))
  const stop = () => server.close(() => process.exit(0))
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}
