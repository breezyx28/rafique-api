/**
 * Hits the endpoints that failed on production after deploy.
 * Usage: API_BASE=http://localhost:3001/api node scripts/smoke-test.js
 */
const BASE = process.env.API_BASE || 'http://localhost:3001/api'
const USERNAME = process.env.SMOKE_USER || 'admin'
const PASSWORD = process.env.SMOKE_PASSWORD || 'admin'

async function request(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, json }
}

function unwrap(json) {
  return json?.data ?? json
}

async function main() {
  const results = []
  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

  const health = await request('GET', '/health')
  results.push({
    name: 'GET /health',
    ok: health.status === 200 && unwrap(health.json)?.version === '0.1.1',
    status: health.status,
    detail: unwrap(health.json),
  })

  const login = await request('POST', '/auth/login', {
    body: { username: USERNAME, password: PASSWORD },
  })
  const token = unwrap(login.json)?.accessToken
  results.push({
    name: 'POST /auth/login',
    ok: login.status >= 200 && login.status < 300 && Boolean(token),
    status: login.status,
    detail: token ? 'token received' : login.json,
  })

  const cases = [
    ['GET /notifications/unread-count', 'GET', '/notifications/unread-count', (body) => body && typeof body.unread === 'number'],
    [
      'GET /dashboard/overview',
      'GET',
      `/dashboard/overview?from=${from}&to=${to}`,
      (body) => body?.period && body?.stats && Array.isArray(body.timeline),
    ],
    [
      'GET /orders?type=custom',
      'GET',
      '/orders?page=1&limit=20&type=custom',
      (body) => Array.isArray(body?.data) && body?.meta,
    ],
    ['GET /workshop/orders', 'GET', '/workshop/orders', (body) => Array.isArray(body)],
    ['GET /workshop/payroll', 'GET', '/workshop/payroll', (body) => body && Array.isArray(body.breakdown)],
    ['GET /users', 'GET', '/users', (body) => Array.isArray(body)],
  ]

  for (const [name, method, path, check] of cases) {
    const res = await request(method, path, { token })
    const body = unwrap(res.json)
    const ok = res.status >= 200 && res.status < 300 && check(body)
    results.push({
      name,
      ok,
      status: res.status,
      detail: ok ? 'ok' : res.json,
    })
  }

  const failed = results.filter((row) => !row.ok)
  for (const row of results) {
    const mark = row.ok ? 'PASS' : 'FAIL'
    console.log(`${mark}  ${row.name}  (${row.status})`)
    if (!row.ok) console.log('     ', JSON.stringify(row.detail))
  }

  if (failed.length) {
    console.error(`\n${failed.length} smoke test(s) failed against ${BASE}`)
    process.exit(1)
  }
  console.log(`\nAll ${results.length} smoke tests passed against ${BASE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
