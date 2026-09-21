const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const bundle = path.join(process.cwd(), 'project.tar.gz.b64')
if (!fs.existsSync(bundle)) {
  console.log('Foundation bundle already unpacked; bootstrap skipped.')
  process.exit(0)
}

const archive = path.join(os.tmpdir(), 'internal-task-management-foundation.tar.gz')
const base64 = fs.readFileSync(bundle, 'utf8').trim()
fs.writeFileSync(archive, Buffer.from(base64, 'base64'))
execFileSync('tar', ['-xzf', archive, '-C', process.cwd()], { stdio: 'inherit' })
console.log('Internal Task Management foundation unpacked successfully.')
