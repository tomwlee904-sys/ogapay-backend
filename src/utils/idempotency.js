const store = new Map()
const TTL_MS = 24 * 60 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now - entry.timestamp > TTL_MS) store.delete(key)
  }
}, 60_000)

function checkIdempotency(key) {
  if (!key) return null
  const existing = store.get(key)
  if (existing && Date.now() - existing.timestamp < TTL_MS) {
    return existing.result
  }
  return null
}

function setIdempotency(key, result) {
  if (!key) return
  store.set(key, { result, timestamp: Date.now() })
}

module.exports = { checkIdempotency, setIdempotency }
