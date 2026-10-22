import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { JSDOM } from 'jsdom'

const here = path.dirname(fileURLToPath(import.meta.url))
const bundlePath = path.join(here, '_qa_tmp_bundle.mjs')

let passed = 0
const failed = []

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log('PASS  ' + name)
  } else {
    failed.push(name + '  -> ' + detail)
    console.log('FAIL  ' + name + '  -> ' + detail)
  }
}

await esbuild.build({
  entryPoints: [path.join(here, 'src', 'App.jsx')],
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  outfile: bundlePath,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  loader: { '.css': 'empty' },
  define: { 'import.meta.env.VITE_API_BASE': '"http://127.0.0.1:8000"' },
  logLevel: 'silent',
})

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})

const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.HTMLInputElement = window.HTMLInputElement
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement
globalThis.HTMLSelectElement = window.HTMLSelectElement
globalThis.HTMLButtonElement = window.HTMLButtonElement
globalThis.Event = window.Event
globalThis.Node = window.Node
globalThis.IS_REACT_ACT_ENVIRONMENT = true
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    configurable: true,
    writable: true,
  })
} catch (problem) {
}

const createdUrls = []
const revokedUrls = []
let urlCounter = 0
globalThis.URL.createObjectURL = () => {
  const url = 'blob:http://localhost:5173/qa-' + (urlCounter += 1)
  createdUrls.push(url)
  return url
}
globalThis.URL.revokeObjectURL = (url) => {
  revokedUrls.push(url)
}

const React = (await import('react')).default
const { act } = await import('react')
const clientModule = await import('react-dom/client')
const createRoot = clientModule.createRoot || (clientModule.default && clientModule.default.createRoot)
const { default: App } = await import(new URL('./_qa_tmp_bundle.mjs', import.meta.url).href)

const container = document.getElementById('root')
let root

async function settle(ms = 500) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

function setNativeValue(element, value) {
  const prototype =
    element.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : element.tagName === 'SELECT'
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set
  setter.call(element, value)
  element.dispatchEvent(new window.Event('input', { bubbles: true }))
  element.dispatchEvent(new window.Event('change', { bubbles: true }))
}

function byLabelText(text) {
  const labels = [...container.querySelectorAll('label.field')]
  const match = labels.find((label) => {
    const span = label.querySelector('.label')
    return span && span.textContent.trim() === text
  })
  return match ? match.querySelector('input, textarea, select') : null
}

function buttonWithText(text) {
  return [...container.querySelectorAll('button')].find((button) =>
    button.textContent.trim().indexOf(text) === 0,
  )
}

function submitForm() {
  const form = container.querySelector('form')
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
}

function alertWithClass(kind) {
  return container.querySelector('.alert-' + kind)
}

function previewImage() {
  return container.querySelector('img.preview-img')
}

function downloadLink() {
  return container.querySelector('a.btn[download]')
}

function fillLabel(text, value) {
  const element = byLabelText(text)
  if (!element) throw new Error('Field not found: ' + text)
  setNativeValue(element, value)
  return element
}

console.log('='.repeat(70))
console.log('FRONTEND (jsdom) INTEGRATION TEST - live backend at 127.0.0.1:8000')
console.log('='.repeat(70))

await act(async () => {
  root = createRoot(container)
  root.render(React.createElement(App))
})
await settle(700)

console.log()
console.log('--- A. Initial render ---')
check(
  'header shows project name',
  container.querySelector('.brand-name').textContent === 'PrinSync 2.1',
  container.querySelector('.brand-name').textContent,
)
check(
  'page heading is present',
  container.querySelector('.page-title').textContent === 'QR Code & Barcode Generator',
  container.querySelector('.page-title').textContent,
)
const tabs = [...container.querySelectorAll('button[role="tab"]')]
check(
  'QR and Barcode tabs are rendered',
  tabs.length === 2 && tabs[0].textContent === 'QR Code' && tabs[1].textContent === 'Barcode',
  tabs.map((tab) => tab.textContent).join(' | '),
)
check('QR tab is selected by default', tabs[0].getAttribute('aria-selected') === 'true')
check(
  'backend health check reports "connected"',
  Boolean(container.querySelector('.api-status-online')),
  container.querySelector('.api-status').textContent,
)
check('no error shown on load', !alertWithClass('error'))

console.log()
console.log('--- B. Text QR generation + download link ---')
await act(async () => {
  setNativeValue(byLabelText('Text'), 'Hello PrinSync 2.1')
})
await act(async () => {
  submitForm()
})
await settle(1500)

const textImage = previewImage()
check('text QR: preview <img> appears', Boolean(textImage), String(textImage))
check(
  'text QR: preview src is a blob URL',
  Boolean(textImage) && textImage.getAttribute('src').startsWith('blob:'),
  textImage ? textImage.getAttribute('src') : '(no image)',
)
const textLink = downloadLink()
check('text QR: download link exists', Boolean(textLink))
check(
  'text QR: download filename is meaningful',
  Boolean(textLink) && /^prinsync-qr-text-\d{8}-\d{6}\.png$/.test(textLink.getAttribute('download')),
  textLink ? textLink.getAttribute('download') : '(no link)',
)
check(
  'text QR: download href equals preview src',
  Boolean(textLink) && textLink.getAttribute('href') === textImage.getAttribute('src'),
)
check('text QR: no error alert', !alertWithClass('error'))

console.log()
console.log('--- C. Colour contrast warning ---')
await act(async () => {
  setNativeValue(byLabelText('Foreground colour'), '#dddddd')
})
await settle(100)
check(
  'low-contrast colours show a warning',
  Boolean(alertWithClass('warning')),
  alertWithClass('warning') ? alertWithClass('warning').textContent : '(no warning)',
)
await act(async () => {
  setNativeValue(byLabelText('Foreground colour'), '#1e5aa8')
})
await settle(100)
check('warning disappears with good contrast', !alertWithClass('warning'))

console.log()
console.log('--- D. Wi-Fi QR ---')
await act(async () => {
  setNativeValue(byLabelText('What do you want to encode?'), 'wifi')
})
await settle(100)
check('Wi-Fi fields appear after switching type', Boolean(byLabelText('Network name (SSID)')))
await act(async () => {
  setNativeValue(byLabelText('Network name (SSID)'), '')
})
await act(async () => {
  submitForm()
})
await settle(200)
check(
  'Wi-Fi with empty SSID is rejected before any request',
  Boolean(alertWithClass('error')),
  alertWithClass('error') ? alertWithClass('error').textContent : '(no error)',
)
await act(async () => {
  setNativeValue(byLabelText('Network name (SSID)'), 'MyHomeWiFi')
  setNativeValue(byLabelText('Password'), 'secret123')
})
await act(async () => {
  submitForm()
})
await settle(1500)
check('Wi-Fi QR: preview image appears', Boolean(previewImage()))
check(
  'Wi-Fi QR: filename mentions the type',
  Boolean(downloadLink()) &&
    downloadLink().getAttribute('download').startsWith('prinsync-qr-wifi-'),
  downloadLink() ? downloadLink().getAttribute('download') : '(no link)',
)

console.log()
console.log('--- E. Logo upload, generation and removal ---')
const logoBytes = fs.readFileSync(path.resolve(here, '..', '..', '_qa', 'logo_test.png'))
const logoFile = new globalThis.File([logoBytes], 'logo_test.png', { type: 'image/png' })
const logoInput = container.querySelector('input[type="file"]')
Object.defineProperty(logoInput, 'files', { value: [logoFile], configurable: true })
await act(async () => {
  logoInput.dispatchEvent(new window.Event('change', { bubbles: true }))
})
await settle(200)
check('logo preview image is shown', Boolean(container.querySelector('.logo-preview img')))
check('logo file name is shown', Boolean(container.querySelector('.logo-name')))
const removeButton = buttonWithText('Remove logo')
check('"Remove logo" button is shown', Boolean(removeButton))
const errorSelect = byLabelText('Error correction')
check('error correction is forced to H', errorSelect.value === 'H', errorSelect.value)
check('error correction select is disabled while a logo is set', errorSelect.disabled === true)

await act(async () => {
  submitForm()
})
await settle(1500)
check('QR with logo: preview image appears', Boolean(previewImage()))
check(
  'QR with logo: backend note about error correction is shown',
  Boolean(alertWithClass('info')) &&
    /error correction/i.test(alertWithClass('info').textContent),
  alertWithClass('info') ? alertWithClass('info').textContent : '(no note)',
)

await act(async () => {
  removeButton.click()
})
await settle(200)
check('logo preview disappears after removal', !container.querySelector('.logo-preview'))
check('error correction select is enabled again', byLabelText('Error correction').disabled === false)

console.log()
console.log('--- F. Invalid logo file rejected in the browser ---')
const badFile = new globalThis.File(['not an image'], 'notes.txt', { type: 'text/plain' })
Object.defineProperty(logoInput, 'files', { value: [badFile], configurable: true })
await act(async () => {
  logoInput.dispatchEvent(new window.Event('change', { bubbles: true }))
})
await settle(200)
check(
  'non-image logo shows a clear error',
  Boolean(alertWithClass('error')) && /PNG or JPEG/i.test(alertWithClass('error').textContent),
  alertWithClass('error') ? alertWithClass('error').textContent : '(no error)',
)
check('no logo preview after invalid file', !container.querySelector('.logo-preview'))

console.log()
console.log('--- G. Barcode tab ---')
await act(async () => {
  tabs[1].click()
})
await settle(200)
check('barcode tab becomes selected', tabs[1].getAttribute('aria-selected') === 'true')
check('preview is cleared when switching tabs', !previewImage())
check('barcode format select exists', Boolean(byLabelText('Format')))

await act(async () => {
  setNativeValue(byLabelText('Data'), 'PRINSYNC-2026')
})
await act(async () => {
  submitForm()
})
await settle(1500)
check('code128 barcode: preview image appears', Boolean(previewImage()))
check(
  'code128 barcode: filename is meaningful',
  Boolean(downloadLink()) &&
    downloadLink().getAttribute('download').startsWith('prinsync-barcode-code128-'),
  downloadLink() ? downloadLink().getAttribute('download') : '(no link)',
)

console.log()
console.log('--- H. Barcode format validation ---')
await act(async () => {
  setNativeValue(byLabelText('Format'), 'ean13')
  setNativeValue(byLabelText('Data'), '123')
})
await act(async () => {
  submitForm()
})
await settle(200)
check(
  'EAN-13 with 3 digits is rejected with a clear message',
  Boolean(alertWithClass('error')) && /EAN-13 needs 12 digits/.test(alertWithClass('error').textContent),
  alertWithClass('error') ? alertWithClass('error').textContent : '(no error)',
)

await act(async () => {
  setNativeValue(byLabelText('Data'), '400638133393')
})
await act(async () => {
  submitForm()
})
await settle(1500)
check('EAN-13 with 12 digits generates an image', Boolean(previewImage()))
check(
  'EAN-13 check-digit note is shown',
  Boolean(alertWithClass('info')) && /check digit/i.test(alertWithClass('info').textContent),
  alertWithClass('info') ? alertWithClass('info').textContent : '(no note)',
)

console.log()
console.log('--- I. Reset and Blob URL cleanup ---')
const resetButton = buttonWithText('Reset')
await act(async () => {
  resetButton.click()
})
await settle(200)
check('reset clears the preview', !previewImage())
check('reset clears the download link', !downloadLink())
check(
  'reset clears the data field',
  byLabelText('Data').value === '',
  byLabelText('Data').value,
)
check('blob URLs were revoked at least once', revokedUrls.length > 0, 'revoked=' + revokedUrls.length)
check(
  'every created blob URL was eventually revoked or still in use',
  revokedUrls.length >= createdUrls.length - 1,
  'created=' + createdUrls.length + ' revoked=' + revokedUrls.length,
)

console.log()
console.log('--- J. Backend-down error message ---')
const realFetch = globalThis.fetch
globalThis.fetch = () => Promise.reject(new TypeError('Failed to fetch'))
await act(async () => {
  setNativeValue(byLabelText('Data'), 'TEST-1')
})
await act(async () => {
  submitForm()
})
await settle(400)
check(
  'a TypeError from fetch shows the friendly backend message',
  Boolean(alertWithClass('error')) && /Cannot reach the backend/.test(alertWithClass('error').textContent),
  alertWithClass('error') ? alertWithClass('error').textContent : '(no error)',
)
globalThis.fetch = realFetch

await act(async () => {
  root.unmount()
})
dom.window.close()
fs.rmSync(bundlePath, { force: true })

console.log()
console.log('='.repeat(70))
console.log('RESULT: ' + passed + ' passed, ' + failed.length + ' failed')
if (failed.length) {
  console.log()
  failed.forEach((line) => console.log('  ' + line))
}
console.log('='.repeat(70))
process.exit(failed.length ? 1 : 0)
