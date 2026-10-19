import type { ConfigChange } from '../../src/lib/api/management/config'

type Request = { method: string; path: string; body: string; contentType: string }
const requests: Request[] = []

class RecordingXMLHttpRequest {
  onloadend: (() => void) | null = null
  status = 200
  statusText = 'OK'
  responseText = '{}'
  method = ''
  url = ''
  headers: Record<string, string> = {}

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key.toLowerCase()] = value
  }

  getAllResponseHeaders() {
    return 'Content-Type: application/json\r\n'
  }

  send(value: unknown) {
    const body = value == null ? '' : String(value)
    requests.push({
      method: this.method,
      path: new URL(this.url).pathname,
      body,
      contentType: this.headers['content-type'] ?? '',
    })
    // Home rejects every non-DELETE config write whose body is not valid JSON.
    try {
      if (this.method !== 'DELETE') JSON.parse(body)
    } catch {
      this.status = 400
    }
    this.responseText = this.status === 200 ? '{"status":"ok"}' : '{"error":"invalid_json"}'
    queueMicrotask(() => this.onloadend?.())
  }
}

// Axios detects XHR at import time. The parent runs this fixture in a fresh
// process so the real adapter is used without altering other tests' globals.
Object.defineProperty(globalThis, 'XMLHttpRequest', { value: RecordingXMLHttpRequest })
const { applyConfigChange } = await import('../../src/lib/api/management/config')
const changes: ConfigChange[] = await Bun.stdin.json()
const results = []
for (const change of changes) {
  const start = requests.length
  let error: string | null = null
  try {
    await applyConfigChange(
      { baseUrl: 'http://config.test', managementKey: 'synthetic-test-key' },
      change,
    )
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }
  results.push({ error, requests: requests.slice(start) })
}
process.stdout.write(JSON.stringify(results))
