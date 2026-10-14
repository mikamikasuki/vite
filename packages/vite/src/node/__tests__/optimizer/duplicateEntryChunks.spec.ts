import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { optimizeDeps, resolveConfig } from '../..'

let root: string | undefined

afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true })
  root = undefined
})

test('maps optimized entry chunks when Rolldown disambiguates the file name', async () => {
  root = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), 'vite-optimizer-duplicate-entry-'),
  )

  const depDir = path.join(root, 'node_modules', 'duplicate-entry-fixture')
  fs.mkdirSync(path.join(depDir, 'dist', 'schema'), { recursive: true })
  fs.writeFileSync(
    path.join(depDir, 'package.json'),
    JSON.stringify({
      name: 'duplicate-entry-fixture',
      version: '1.0.0',
      type: 'module',
      exports: {
        './Schema': './dist/Schema.js',
        './schema': './dist/schema/index.js',
      },
    }),
  )
  fs.writeFileSync(
    path.join(depDir, 'dist', 'Schema.js'),
    'export const Schema = "schema"\n',
  )
  fs.writeFileSync(
    path.join(depDir, 'dist', 'schema', 'index.js'),
    'export { Model } from "./Model.js"\n',
  )
  fs.writeFileSync(
    path.join(depDir, 'dist', 'schema', 'Model.js'),
    'import { Schema } from "../Schema.js"\nexport const Model = { Schema }\n',
  )
  fs.writeFileSync(
    path.join(root, 'index.html'),
    '<script type="module" src="/main.js"></script>\n',
  )
  fs.writeFileSync(
    path.join(root, 'main.js'),
    'import { Schema } from "duplicate-entry-fixture/Schema"\n' +
      'import { Model } from "duplicate-entry-fixture/schema"\n' +
      'console.log(Schema, Model)\n',
  )

  const config = await resolveConfig(
    {
      configFile: false,
      root,
      cacheDir: '.vite',
      logLevel: 'silent',
      optimizeDeps: {
        force: true,
        include: [
          'duplicate-entry-fixture/Schema',
          'duplicate-entry-fixture/schema',
        ],
      },
    },
    'serve',
  )

  const metadata = await optimizeDeps(config, true)

  for (const id of [
    'duplicate-entry-fixture/Schema',
    'duplicate-entry-fixture/schema',
  ]) {
    const dep = metadata.optimized[id]
    expect(dep).toBeDefined()
    expect(fs.existsSync(dep!.file)).toBe(true)
  }
})
