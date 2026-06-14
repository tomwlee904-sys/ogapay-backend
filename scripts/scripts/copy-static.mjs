import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(appDir, '..')
const distDir = path.join(appDir, 'dist')

fs.mkdirSync(distDir, { recursive: true })

const viteIndex = path.join(distDir, 'index.html')
if (fs.existsSync(viteIndex)) {
  const appOutDir = path.join(distDir, 'app')
  fs.mkdirSync(appOutDir, { recursive: true })
  fs.copyFileSync(viteIndex, path.join(appOutDir, 'index.html'))
}

fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(distDir, 'index.html'))

const sourceAssets = path.join(rootDir, 'assets')
const targetAssets = path.join(distDir, 'assets')
if (fs.existsSync(sourceAssets)) {
  fs.cpSync(sourceAssets, targetAssets, { recursive: true })
}
