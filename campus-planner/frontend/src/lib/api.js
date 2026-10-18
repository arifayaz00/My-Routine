// Session lives in an httpOnly cookie set by the server, so no token is ever stored in JavaScript.
// Writes carry a custom header the server requires (CSRF defence for cookie sessions).
const HEADERS = { 'X-Requested-With': 'campus-planner' }

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = { ...HEADERS }
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`/api${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) window.dispatchEvent(new Event('cp-unauth'))
    const d = data.detail
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg).join(', ') : `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, file, fields = {}) => {
    const f = new FormData()
    f.append('file', file)
    Object.entries(fields).forEach(([k, v]) => f.append(k, v))
    return request(p, { method: 'POST', form: f })
  },
}

/** Download a file through fetch -> blob -> <a download> (keeps the cookie session). */
export async function download(path, filename) {
  const res = await fetch(`/api${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error('Download failed')
  saveBlob(await res.blob(), filename)
}
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString()
