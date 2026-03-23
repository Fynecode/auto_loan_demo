import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { platform } from 'node:os'

export function renderContractHtml(template: string, data: Record<string, unknown>) {
  let output = template

  for (const [key, value] of Object.entries(data)) {
    const safeValue = escapeHtml(value ?? '')
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g')
    output = output.replace(pattern, safeValue)
  }

  return output
}

export async function convertHtmlToPdf(html: string) {

  const executablePath = resolveChromiumPath()

  if (!executablePath) {
    throw new Error('Missing Chromium executable. Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH.')
  }

  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: ['load', 'networkidle0'] })
    await page.evaluate(async () => {
      const images = Array.from(document.images || [])
      if (!images.length) return
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve()
          return new Promise<void>((resolve) => {
            const done = () => resolve()
            img.addEventListener('load', done, { once: true })
            img.addEventListener('error', done, { once: true })
          })
        })
      )
    })
    await page.emulateMediaType('print')
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true
    })
    return pdfBuffer
  } finally {
    await browser.close()
  }
}

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resolveChromiumPath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const candidates: string[] = []
  const os = platform()

  if (os === 'win32') {
    const userProfile = process.env.USERPROFILE || ''
    candidates.push(
      'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C:\\\\Program Files\\\\Chromium\\\\Application\\\\chrome.exe',
      `${userProfile}\\\\AppData\\\\Local\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe`,
      `${userProfile}\\\\AppData\\\\Local\\\\Chromium\\\\Application\\\\chrome.exe`
    )
  } else if (os === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    )
  } else {
    candidates.push(
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable'
    )
  }

  return candidates.find((candidate) => existsSync(candidate)) || ''
}
