// Listens for GitHub 'push' webhooks and triggers scripts/deploy.sh on pushes to main.
// Internal-only: bound to 127.0.0.1, reached via nginx at /webhook/deploy.
import http from 'http'
import crypto from 'crypto'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SECRET = process.env.WEBHOOK_SECRET
const PORT = process.env.WEBHOOK_PORT || 4001
const LOG_FILE = path.join(ROOT, 'server', 'data', 'deploy.log')

if (!SECRET) {
  console.error('WEBHOOK_SECRET is not set in .env — refusing to start')
  process.exit(1)
}

let deploying = false

function verifySignature(body, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function runDeploy() {
  if (deploying) {
    console.log('[webhook] deploy already in progress, skipping')
    return
  }
  deploying = true
  const stamp = new Date().toISOString()
  fs.appendFileSync(LOG_FILE, `\n[webhook] ${stamp} push received, starting deploy\n`)
  const child = spawn('bash', [path.join(ROOT, 'scripts', 'deploy.sh')], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (d) => fs.appendFileSync(LOG_FILE, d))
  child.stderr.on('data', (d) => fs.appendFileSync(LOG_FILE, d))
  child.on('close', (code) => {
    fs.appendFileSync(LOG_FILE, `[webhook] deploy exited with code ${code}\n`)
    deploying = false
  })
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook/deploy') {
    res.writeHead(404).end()
    return
  }

  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks)

    if (!verifySignature(body, req.headers['x-hub-signature-256'])) {
      res.writeHead(401).end('invalid signature')
      return
    }

    let payload
    try {
      payload = JSON.parse(body.toString('utf8'))
    } catch {
      res.writeHead(400).end('invalid json')
      return
    }

    const event = req.headers['x-github-event']
    if (event === 'ping') {
      res.writeHead(200).end('pong')
      return
    }
    if (event !== 'push') {
      res.writeHead(200).end('ignored (not a push event)')
      return
    }
    if (payload.ref !== 'refs/heads/main') {
      res.writeHead(200).end('ignored (not main)')
      return
    }

    res.writeHead(202).end('deploy triggered')
    runDeploy()
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Webhook listener on http://127.0.0.1:${PORT}/webhook/deploy`)
})
