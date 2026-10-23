// Regenerate the README screenshots in docs/.
// Usage: npm run screenshots   (starts its own preview server)
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

const PORT = 4174
const URL = `http://localhost:${PORT}/`
const TODAY = new Date('2026-10-23T12:00:00+01:00')

const server = spawn(`npx vite --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Dev server did not start')
}

async function shoot(browser, options, file) {
  const context = await browser.newContext({ ...options, reducedMotion: 'reduce', timezoneId: 'Europe/Lisbon' })
  const page = await context.newPage()
  await page.clock.setFixedTime(TODAY)
  await page.goto(URL)
  await page.locator('.sheet').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: file })
  await context.close()
  console.log('saved', file)
}

try {
  await waitForServer()
  mkdirSync('docs', { recursive: true })
  const browser = await chromium.launch()
  await shoot(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, 'docs/desktop.png')
  await shoot(browser, { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, 'docs/mobile.png')
  await browser.close()
} finally {
  server.kill()
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
}
