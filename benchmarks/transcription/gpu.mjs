// Swaps in Vellum's sherpa-onnx build with onnxruntime-directml, the one the Windows app runs on the GPU
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

if (process.platform !== 'win32') process.exit(0)
const folder = 'node_modules/sherpa-onnx-win-x64'
if (existsSync(join(folder, 'DirectML.dll'))) process.exit(0)
const { version } = JSON.parse(readFileSync('node_modules/sherpa-onnx-node/package.json', 'utf8'))
const zip = 'sherpa-gpu-win-x64.zip'
execFileSync('gh', ['release', 'download', `sherpa-gpu-v${version}`, '--repo', 'TonyWu1995/Vellum', '-p', zip, '-D', folder, '--clobber'], {
  stdio: 'inherit'
})
execFileSync(join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-xf', zip], { cwd: folder, stdio: 'inherit' })
rmSync(join(folder, zip))
