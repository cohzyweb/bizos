import puppeteer from 'puppeteer-core'

const OUT = 'C:/Users/HP/AppData/Local/Temp/opencode'
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})

async function shot(url, file, { width = 1440, height = 900, fullPage = true, wait = 2000, clipY = null, clipH = null } = {}) {
  const page = await browser.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 })
  } catch (e) {
    console.log(file, 'goto warning:', e.message)
  }
  await new Promise((r) => setTimeout(r, wait))
  const opts = clipY !== null
    ? { path: `${OUT}/${file}`, clip: { x: 0, y: clipY, width, height: clipH } }
    : { path: `${OUT}/${file}`, fullPage }
  await page.screenshot(opts)
  console.log(file, '| console errors:', errors.length ? errors.slice(0, 8).join(' || ') : 'none')
  await page.close()
}

await shot('file:///C:/Users/HP/Documents/bizos/design/code.html', 'design-original.png')
await shot('http://localhost:4173/', 'mine-desktop-full.png')
await shot('http://localhost:4173/', 'mine-desktop-hero.png', { fullPage: false })
await shot('http://localhost:4173/', 'mine-mobile-full.png', { width: 390, height: 844 })
await shot('http://localhost:5173/', 'devserver-what-user-sees.png', { fullPage: false })

await browser.close()
console.log('done')
