// Syntax check for a single JSX file: parses + transforms it with rolldown
// (the same engine vite build uses), with every import left external.
// Usage: node scripts-check.mjs src/pages/ProductsPage.jsx
import { rolldown } from 'rolldown'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts-check.mjs <file.jsx>')
  process.exit(2)
}

try {
  const bundle = await rolldown({ input: file, external: [/.*/] })
  const { output } = await bundle.generate({ format: 'esm' })
  console.log(`OK ${file} (${output[0].code.split('\n').length} lines)`)
} catch (err) {
  console.error(`FAIL ${file}`)
  console.error(err.message ?? String(err))
  process.exit(1)
}
