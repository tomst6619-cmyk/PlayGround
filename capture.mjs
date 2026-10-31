// Capture desktop and mobile screenshots of the deployed preview.
// Exit 75: temporary navigation / browser infrastructure failure.
// Exit 1:  script or rendering defect.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const fatal = (message, exitCode) => Object.assign(new Error(message), { exitCode })

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
if (!url || !output) {
  console.error('Set CAPTURE_URL and CAPTURE_DIR.')
  process.exit(1)
}

const runtime = process.env.PLAYWRIGHT_HOME || join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')

const configFile = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
const config = JSON.parse(readFileSync(configFile, 'utf8'))
if (process.platform === 'linux') {
  process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
}

mkdirSync(output, { recursive: true })

const views = [
  { name: 'desktop', width: 1440, height: 900, scale: 1 },
  { name: 'mobile', width: 390, height: 844, scale: 2 },
]

const TRANSIENT_HTTP = new Set([0, 408, 429, 500, 502, 503, 504])
const NAVIGATION_ERROR = /net::|ERR_|ECONN|ENOTFOUND|EAI_AGAIN|Timeout .* exceeded|Target closed|browser has been closed/i
const isTransient = (error) => {
  if (error.exitCode) return error.exitCode === 75
  return NAVIGATION_ERROR.test(`${error.name}: ${error.message}`)
}

let browser
try {
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 })
    .catch((error) => { throw fatal(`Browser launch failed: ${error.message}`, 75) })

  for (const view of views) {
    const started = Date.now()
    const page = await browser.newPage({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: view.scale,
    }).catch((error) => { throw fatal(`Could not open page: ${error.message}`, 75) })
    page.setDefaultTimeout(30000)

    const pageErrors = []
    const failedRequests = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 400) {
        let sameOrigin = false
        try { sameOrigin = new URL(response.url()).origin === new URL(url).origin } catch {}
        if (sameOrigin || response.status() >= 500) failedRequests.push(`HTTP ${response.status()}: ${response.url()}`)
      }
    })

    let response
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: 45000 })
    } catch (error) {
      throw fatal(`Navigation to ${url} failed: ${error.message}`, 75)
    }
    if (!response) throw fatal(`No response from ${url}`, 75)
    if (!response.ok()) {
      const code = TRANSIENT_HTTP.has(response.status()) ? 75 : 1
      throw fatal(`HTTP ${response.status()} loading ${url}`, code)
    }

    try {
      await page.waitForFunction(
        () => document.documentElement.getAttribute('data-rendered') === 'true',
        null,
        { timeout: 20000 },
      )
      await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 10000 })
      await page.waitForFunction(
        () => [...document.images].every((image) => image.complete),
        null,
        { timeout: 10000 },
      )
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(600)
    } catch (error) {
      // The document loaded, so a page that never renders is a defect, not infrastructure.
      throw fatal(`Page did not render (${view.name}): ${error.message}`, 1)
    }

    const rendered = await page.evaluate(() => {
      const heading = document.querySelector('h1')
      const header = document.querySelector('.site-header')
      const hero = document.querySelector('.hero')
      const visible = (element) => {
        if (!element) return false
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }
      return {
        heading: heading?.textContent?.trim() || '',
        headerVisible: visible(header),
        heroVisible: visible(hero),
        bodyText: (document.body.innerText || '').trim().length,
        width: document.documentElement.clientWidth,
      }
    })

    if (!rendered.heading || !rendered.headerVisible || !rendered.heroVisible || rendered.bodyText < 400) {
      throw fatal(`Rendering defect (${view.name}): ${JSON.stringify(rendered)}`, 1)
    }
    if (rendered.width > view.width + 1) {
      throw fatal(`Horizontal overflow (${view.name}): clientWidth ${rendered.width} > ${view.width}`, 1)
    }
    if (pageErrors.length) {
      throw fatal(`Page errors (${view.name}): ${pageErrors.join('; ')}`, 1)
    }
    if (failedRequests.length) {
      throw fatal(`Failed requests (${view.name}): ${failedRequests.join('; ')}`, 1)
    }

    const file = join(output, `final-${view.name}.png`)
    try {
      await page.screenshot({ path: file, fullPage: false, animations: 'disabled', timeout: 30000 })
    } catch (error) {
      throw fatal(`Screenshot failed (${view.name}): ${error.message}`, browser.isConnected() ? 1 : 75)
    }

    const bytes = statSync(file).size
    if (bytes < 20000) throw fatal(`Screenshot looks empty (${view.name}): ${bytes} bytes`, 1)
    console.log(`captured ${file} (${view.width}x${view.height}, ${bytes} bytes) in ${Date.now() - started}ms`)

    await page.close().catch((error) => { throw fatal(`Could not close page: ${error.message}`, 75) })
  }
} catch (error) {
  console.error(`capture failed: ${error.message}`)
  process.exitCode = isTransient(error) ? 75 : 1
} finally {
  if (browser) await browser.close().catch((error) => {
    console.error(`browser close failed: ${error.message}`)
    process.exitCode ||= 75
  })
}
