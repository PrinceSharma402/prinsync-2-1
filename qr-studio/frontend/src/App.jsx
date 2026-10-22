import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'

const QR_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'url', label: 'Website URL' },
  { value: 'wifi', label: 'Wi-Fi network' },
  { value: 'email', label: 'Email address' },
  { value: 'phone', label: 'Phone number' },
  { value: 'contact', label: 'Contact card (vCard)' },
]

const BARCODE_FORMATS = [
  {
    value: 'code128',
    label: 'Code 128',
    hint: 'English letters, digits and symbols. Up to 48 characters.',
  },
  {
    value: 'code39',
    label: 'Code 39',
    hint: 'A-Z, 0-9 and - . $ / + % and space. Letters are converted to capitals.',
  },
  {
    value: 'ean13',
    label: 'EAN-13',
    hint: '12 digits (the 13th check digit is added automatically) or all 13 digits.',
    digits: 12,
  },
  {
    value: 'ean8',
    label: 'EAN-8',
    hint: '7 digits (the 8th check digit is added automatically) or all 8 digits.',
    digits: 7,
  },
  {
    value: 'upca',
    label: 'UPC-A',
    hint: '11 digits (the 12th check digit is added automatically) or all 12 digits.',
    digits: 11,
  },
]

const EMPTY_QR_FORM = {
  dataType: 'text',
  text: '',
  url: '',
  wifiSsid: '',
  wifiPassword: '',
  wifiEncryption: 'WPA',
  wifiHidden: false,
  emailTo: '',
  emailSubject: '',
  emailBody: '',
  phone: '',
  contactFirstName: '',
  contactLastName: '',
  contactPhone: '',
  contactEmail: '',
  contactOrganization: '',
  foreground: '#000000',
  background: '#ffffff',
  size: 400,
  border: 4,
  errorLevel: 'M',
}

const EMPTY_BARCODE_FORM = {
  data: '',
  barcodeFormat: 'code128',
  foreground: '#000000',
  background: '#ffffff',
  showText: true,
  barHeight: 15,
}

function hexToRgb(hexColor) {
  const value = hexColor.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

function brightness(hexColor) {
  const { r, g, b } = hexToRgb(hexColor)
  const channels = [r, g, b].map((channel) => {
    const ratio = channel / 255
    return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(foreground, background) {
  const first = brightness(foreground)
  const second = brightness(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

function checkColors(foreground, background) {
  if (brightness(foreground) > brightness(background)) {
    return 'The foreground colour is lighter than the background. Most scanners expect dark modules on a light background, so this code may not scan.'
  }
  if (contrastRatio(foreground, background) < 3) {
    return 'These two colours are too close to each other. Increase the difference (dark foreground, light background) for a more reliable scan.'
  }
  return ''
}

function makeFileName(prefix) {
  const now = new Date()
  const pad = (number) => String(number).padStart(2, '0')
  const stamp =
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    '-' +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  return 'prinsync-' + prefix + '-' + stamp + '.png'
}

function validateQrForm(form) {
  if (form.dataType === 'text' && !form.text.trim()) {
    return 'Please enter the text you want to convert into a QR code.'
  }
  if (form.dataType === 'url') {
    const url = form.url.trim()
    if (!url) return 'Please enter a website URL.'
    if (/\s/.test(url)) return 'A URL cannot contain spaces.'
    if (!/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)?[^\s/]+\.[^\s/]+/.test(url)) {
      return 'This does not look like a valid website address (example: example.com).'
    }
  }
  if (form.dataType === 'wifi') {
    if (!form.wifiSsid.trim()) return 'Wi-Fi network name (SSID) is required.'
    if (form.wifiEncryption !== 'nopass' && !form.wifiPassword) {
      return 'Wi-Fi password is required. Choose "Open network" if the network has no password.'
    }
  }
  if (form.dataType === 'email') {
    if (!form.emailTo.trim()) return 'Email address is required.'
    if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(form.emailTo.trim())) {
      return 'Please enter a valid email address, for example name@example.com.'
    }
  }
  if (form.dataType === 'phone' && !form.phone.trim()) {
    return 'Phone number is required.'
  }
  if (form.dataType === 'contact') {
    const filled =
      form.contactFirstName.trim() ||
      form.contactLastName.trim() ||
      form.contactPhone.trim() ||
      form.contactEmail.trim()
    if (!filled) return 'Please fill at least a name, phone number or email for the contact card.'
  }
  return ''
}

function validateBarcodeForm(form) {
  const data = form.data.trim()
  if (!data) return 'Please enter the data you want to encode in the barcode.'

  const format = BARCODE_FORMATS.find((item) => item.value === form.barcodeFormat)
  if (format && format.digits) {
    const length = data.length
    const onlyDigits = /^[0-9]+$/.test(data)
    const rightLength = length === format.digits || length === format.digits + 1
    if (!onlyDigits || !rightLength) {
      return (
        format.label + ' needs ' + format.digits + ' digits (' + (format.digits + 1) +
        ' if you already have the check digit). You entered ' + length + ' character(s).'
      )
    }
  }
  return ''
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  )
}

function Alert({ kind, children }) {
  return <p className={'alert alert-' + kind}>{children}</p>
}

export default function App() {
  const [mode, setMode] = useState('qr')
  const [qrForm, setQrForm] = useState(EMPTY_QR_FORM)
  const [barcodeForm, setBarcodeForm] = useState(EMPTY_BARCODE_FORM)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [result, setResult] = useState(null)
  const [resultSize, setResultSize] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState('checking')
  const logoInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetch(API_BASE + '/health')
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setBackendStatus(data.status === 'ok' ? 'online' : 'offline')
      })
      .catch(() => {
        if (!cancelled) setBackendStatus('offline')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview('')
      return undefined
    }
    const previewUrl = URL.createObjectURL(logoFile)
    setLogoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [logoFile])

  useEffect(() => {
    if (!result) return undefined
    return () => URL.revokeObjectURL(result.url)
  }, [result])

  function updateQrField(field, value) {
    setQrForm((previous) => ({ ...previous, [field]: value }))
  }

  function updateBarcodeField(field, value) {
    setBarcodeForm((previous) => ({ ...previous, [field]: value }))
  }

  async function sendRequest(path, formData, filePrefix) {
    setLoading(true)
    setError('')
    setNote('')
    setResultSize(null)
    try {
      const response = await fetch(API_BASE + path, { method: 'POST', body: formData })

      if (!response.ok) {
        let message = 'Request failed (HTTP ' + response.status + ').'
        try {
          const data = await response.json()
          if (data && data.detail) message = data.detail
        } catch {
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      setResult({
        url: URL.createObjectURL(blob),
        filename: makeFileName(filePrefix),
      })
      setNote(response.headers.get('X-Prinsync-Note') || '')
    } catch (problem) {
      setResult(null)
      if (problem instanceof TypeError) {
        setError(
          'Cannot reach the backend at ' + API_BASE +
            '. Start the FastAPI server (uvicorn main:app --reload) and try again.',
        )
      } else {
        setError(problem.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleQrSubmit(event) {
    event.preventDefault()
    const problem = validateQrForm(qrForm)
    if (problem) {
      setError(problem)
      setNote('')
      return
    }

    const formData = new FormData()
    formData.append('data_type', qrForm.dataType)
    formData.append('text', qrForm.text)
    formData.append('url', qrForm.url)
    formData.append('wifi_ssid', qrForm.wifiSsid)
    formData.append('wifi_password', qrForm.wifiPassword)
    formData.append('wifi_encryption', qrForm.wifiEncryption)
    formData.append('wifi_hidden', qrForm.wifiHidden ? 'true' : 'false')
    formData.append('email_to', qrForm.emailTo)
    formData.append('email_subject', qrForm.emailSubject)
    formData.append('email_body', qrForm.emailBody)
    formData.append('phone', qrForm.phone)
    formData.append('contact_first_name', qrForm.contactFirstName)
    formData.append('contact_last_name', qrForm.contactLastName)
    formData.append('contact_phone', qrForm.contactPhone)
    formData.append('contact_email', qrForm.contactEmail)
    formData.append('contact_organization', qrForm.contactOrganization)
    formData.append('foreground', qrForm.foreground)
    formData.append('background', qrForm.background)
    formData.append('size', String(qrForm.size))
    formData.append('border', String(qrForm.border))
    formData.append('error_level', logoFile ? 'H' : qrForm.errorLevel)
    if (logoFile) {
      formData.append('logo', logoFile)
    }

    await sendRequest('/generate-qr', formData, 'qr-' + qrForm.dataType)
  }

  async function handleBarcodeSubmit(event) {
    event.preventDefault()
    const problem = validateBarcodeForm(barcodeForm)
    if (problem) {
      setError(problem)
      setNote('')
      return
    }

    const formData = new FormData()
    formData.append('data', barcodeForm.data)
    formData.append('barcode_format', barcodeForm.barcodeFormat)
    formData.append('foreground', barcodeForm.foreground)
    formData.append('background', barcodeForm.background)
    formData.append('show_text', barcodeForm.showText ? 'true' : 'false')
    formData.append('bar_height', String(barcodeForm.barHeight))

    await sendRequest('/generate-barcode', formData, 'barcode-' + barcodeForm.barcodeFormat)
  }

  function handleLogoChange(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setError('Logo must be a PNG or JPEG image.')
      event.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be smaller than 2 MB.')
      event.target.value = ''
      return
    }

    setError('')
    setLogoFile(file)
  }

  function removeLogo() {
    setLogoFile(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  function resetQrForm() {
    setQrForm(EMPTY_QR_FORM)
    setLogoFile(null)
    if (logoInputRef.current) logoInputRef.current.value = ''
    clearResult()
  }

  function resetBarcodeForm() {
    setBarcodeForm(EMPTY_BARCODE_FORM)
    clearResult()
  }

  function clearResult() {
    setResult(null)
    setResultSize(null)
    setError('')
    setNote('')
  }

  function switchMode(nextMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    clearResult()
  }

  const activeForm = mode === 'qr' ? qrForm : barcodeForm
  const colorWarning = checkColors(activeForm.foreground, activeForm.background)
  const selectedBarcodeFormat = BARCODE_FORMATS.find(
    (item) => item.value === barcodeForm.barcodeFormat,
  )

  const statusText =
    backendStatus === 'online'
      ? 'Backend connected'
      : backendStatus === 'offline'
        ? 'Backend not reachable'
        : 'Checking backend...'

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              QR
            </span>
            <span className="brand-name">PrinSync 2.1</span>
          </div>
          <div className="header-right">
            <span className={'api-status api-status-' + backendStatus}>
              <span className="status-dot" aria-hidden="true" />
              {statusText}
            </span>
            <a
              className="header-link"
              href={API_BASE + '/docs'}
              target="_blank"
              rel="noreferrer"
            >
              API docs
            </a>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="page-head">
          <h1 className="page-title">QR Code &amp; Barcode Generator</h1>
          <p className="page-sub">
            Enter your details, generate the code and download it as a PNG. The image is created
            by the FastAPI server running on your own computer, so nothing is uploaded anywhere.
          </p>
        </div>

        <div className="tabs" role="tablist" aria-label="Generator type">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'qr'}
            className={mode === 'qr' ? 'tab tab-active' : 'tab'}
            onClick={() => switchMode('qr')}
          >
            QR Code
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'barcode'}
            className={mode === 'barcode' ? 'tab tab-active' : 'tab'}
            onClick={() => switchMode('barcode')}
          >
            Barcode
          </button>
        </div>

        <div className="layout">
          {mode === 'qr' ? (
            <form className="card" onSubmit={handleQrSubmit}>
              <h2 className="card-title">QR code details</h2>

              <Field label="What do you want to encode?">
                <select
                  className="input"
                  value={qrForm.dataType}
                  onChange={(event) => updateQrField('dataType', event.target.value)}
                >
                  {QR_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>

              {qrForm.dataType === 'text' ? (
                <Field label="Text" hint="Any text is stored inside the QR code exactly as typed.">
                  <textarea
                    className="input"
                    rows="3"
                    maxLength="1000"
                    placeholder="Hello, this is my first QR code"
                    value={qrForm.text}
                    onChange={(event) => updateQrField('text', event.target.value)}
                  />
                </Field>
              ) : null}

              {qrForm.dataType === 'url' ? (
                <Field
                  label="Website address"
                  hint="If you skip https://, it is added automatically."
                >
                  <input
                    className="input"
                    type="text"
                    placeholder="example.com"
                    value={qrForm.url}
                    onChange={(event) => updateQrField('url', event.target.value)}
                  />
                </Field>
              ) : null}

              {qrForm.dataType === 'wifi' ? (
                <>
                  <Field label="Network name (SSID)">
                    <input
                      className="input"
                      type="text"
                      placeholder="MyHomeWiFi"
                      value={qrForm.wifiSsid}
                      onChange={(event) => updateQrField('wifiSsid', event.target.value)}
                    />
                  </Field>
                  <Field
                    label="Password"
                    hint="Note: a Wi-Fi QR code is not a secret. Anyone who scans it can see the password."
                  >
                    <input
                      className="input"
                      type="text"
                      placeholder="Wi-Fi password"
                      value={qrForm.wifiPassword}
                      onChange={(event) => updateQrField('wifiPassword', event.target.value)}
                    />
                  </Field>
                  <Field label="Security type">
                    <select
                      className="input"
                      value={qrForm.wifiEncryption}
                      onChange={(event) => updateQrField('wifiEncryption', event.target.value)}
                    >
                      <option value="WPA">WPA / WPA2 / WPA3 (most routers)</option>
                      <option value="WEP">WEP (older routers)</option>
                      <option value="nopass">Open network (no password)</option>
                    </select>
                  </Field>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={qrForm.wifiHidden}
                      onChange={(event) => updateQrField('wifiHidden', event.target.checked)}
                    />
                    <span>This network is hidden</span>
                  </label>
                </>
              ) : null}

              {qrForm.dataType === 'email' ? (
                <>
                  <Field label="To (email address)">
                    <input
                      className="input"
                      type="text"
                      placeholder="teacher@example.com"
                      value={qrForm.emailTo}
                      onChange={(event) => updateQrField('emailTo', event.target.value)}
                    />
                  </Field>
                  <Field label="Subject" hint="Optional.">
                    <input
                      className="input"
                      type="text"
                      placeholder="Project report"
                      value={qrForm.emailSubject}
                      onChange={(event) => updateQrField('emailSubject', event.target.value)}
                    />
                  </Field>
                  <Field label="Message" hint="Optional. The mail app opens with this text ready.">
                    <textarea
                      className="input"
                      rows="3"
                      placeholder="Sir, please find my project report attached."
                      value={qrForm.emailBody}
                      onChange={(event) => updateQrField('emailBody', event.target.value)}
                    />
                  </Field>
                </>
              ) : null}

              {qrForm.dataType === 'phone' ? (
                <Field label="Phone number" hint="Scanning the code opens the dialer with this number.">
                  <input
                    className="input"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={qrForm.phone}
                    onChange={(event) => updateQrField('phone', event.target.value)}
                  />
                </Field>
              ) : null}

              {qrForm.dataType === 'contact' ? (
                <>
                  <div className="field-row">
                    <Field label="First name">
                      <input
                        className="input"
                        type="text"
                        value={qrForm.contactFirstName}
                        onChange={(event) => updateQrField('contactFirstName', event.target.value)}
                      />
                    </Field>
                    <Field label="Last name">
                      <input
                        className="input"
                        type="text"
                        value={qrForm.contactLastName}
                        onChange={(event) => updateQrField('contactLastName', event.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="field-row">
                    <Field label="Phone">
                      <input
                        className="input"
                        type="tel"
                        value={qrForm.contactPhone}
                        onChange={(event) => updateQrField('contactPhone', event.target.value)}
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        className="input"
                        type="text"
                        value={qrForm.contactEmail}
                        onChange={(event) => updateQrField('contactEmail', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Organisation" hint="Optional. Saved as a vCard, which phones can add to contacts.">
                    <input
                      className="input"
                      type="text"
                      placeholder="BCA Department"
                      value={qrForm.contactOrganization}
                      onChange={(event) =>
                        updateQrField('contactOrganization', event.target.value)
                      }
                    />
                  </Field>
                </>
              ) : null}

              <h3 className="section-title">Appearance</h3>

              <div className="field-row">
                <Field label="Foreground colour">
                  <input
                    className="color-input"
                    type="color"
                    value={qrForm.foreground}
                    onChange={(event) => updateQrField('foreground', event.target.value)}
                  />
                </Field>
                <Field label="Background colour">
                  <input
                    className="color-input"
                    type="color"
                    value={qrForm.background}
                    onChange={(event) => updateQrField('background', event.target.value)}
                  />
                </Field>
              </div>

              {colorWarning ? <Alert kind="warning">{colorWarning}</Alert> : null}

              <div className="field">
                <div className="field-line">
                  <span className="label">QR size</span>
                  <span className="value-tag">{qrForm.size} px</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="800"
                  step="20"
                  value={qrForm.size}
                  onChange={(event) => updateQrField('size', Number(event.target.value))}
                />
              </div>

              <div className="field">
                <div className="field-line">
                  <span className="label">Border</span>
                  <span className="value-tag">{qrForm.border} modules</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="1"
                  value={qrForm.border}
                  onChange={(event) => updateQrField('border', Number(event.target.value))}
                />
                <span className="hint">
                  The white margin around the code. Scanners need a small quiet area, so 4 is a
                  good value.
                </span>
              </div>

              <Field
                label="Error correction"
                hint={
                  logoFile
                    ? 'H (30%) is applied automatically because a centre logo is included.'
                    : 'M (15%) is fine for most codes. H (30%) tolerates more damage or a logo.'
                }
              >
                <select
                  className="input"
                  value={logoFile ? 'H' : qrForm.errorLevel}
                  disabled={Boolean(logoFile)}
                  onChange={(event) => updateQrField('errorLevel', event.target.value)}
                >
                  <option value="L">L - 7% (smallest code)</option>
                  <option value="M">M - 15% (default)</option>
                  <option value="Q">Q - 25%</option>
                  <option value="H">H - 30% (best for logos)</option>
                </select>
              </Field>

              <h3 className="section-title">Centre logo (optional)</h3>

              <div className="field">
                <input
                  ref={logoInputRef}
                  className="file-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleLogoChange}
                />
                <span className="hint">
                  PNG or JPEG, up to 2 MB. The backend (Pillow) places the logo in the centre of
                  the QR image and the downloaded PNG contains it. Always test the final code with
                  a phone camera before printing.
                </span>
              </div>

              {logoPreview ? (
                <div className="logo-preview">
                  <img src={logoPreview} alt="Selected logo" />
                  <div>
                    <p className="logo-name">{logoFile ? logoFile.name : 'logo'}</p>
                    <button type="button" className="btn btn-small" onClick={removeLogo}>
                      Remove logo
                    </button>
                  </div>
                </div>
              ) : null}

              {error ? <Alert kind="error">{error}</Alert> : null}
              {note ? <Alert kind="info">{note}</Alert> : null}

              <div className="actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Generating...' : 'Generate QR code'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetQrForm}
                  disabled={loading}
                >
                  Reset
                </button>
              </div>
            </form>
          ) : (
            <form className="card" onSubmit={handleBarcodeSubmit}>
              <h2 className="card-title">Barcode details</h2>

              <Field label="Format">
                <select
                  className="input"
                  value={barcodeForm.barcodeFormat}
                  onChange={(event) => updateBarcodeField('barcodeFormat', event.target.value)}
                >
                  {BARCODE_FORMATS.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Data"
                hint={selectedBarcodeFormat ? selectedBarcodeFormat.hint : ''}
              >
                <input
                  className="input"
                  type="text"
                  placeholder="PRINSYNC-2026"
                  value={barcodeForm.data}
                  onChange={(event) => updateBarcodeField('data', event.target.value)}
                />
              </Field>

              <h3 className="section-title">Appearance</h3>

              <div className="field-row">
                <Field label="Bar colour">
                  <input
                    className="color-input"
                    type="color"
                    value={barcodeForm.foreground}
                    onChange={(event) => updateBarcodeField('foreground', event.target.value)}
                  />
                </Field>
                <Field label="Background colour">
                  <input
                    className="color-input"
                    type="color"
                    value={barcodeForm.background}
                    onChange={(event) => updateBarcodeField('background', event.target.value)}
                  />
                </Field>
              </div>

              {colorWarning ? <Alert kind="warning">{colorWarning}</Alert> : null}

              <div className="field">
                <div className="field-line">
                  <span className="label">Bar height</span>
                  <span className="value-tag">{barcodeForm.barHeight} mm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={barcodeForm.barHeight}
                  onChange={(event) =>
                    updateBarcodeField('barHeight', Number(event.target.value))
                  }
                />
              </div>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={barcodeForm.showText}
                  onChange={(event) => updateBarcodeField('showText', event.target.checked)}
                />
                <span>Show the value below the barcode</span>
              </label>

              {error ? <Alert kind="error">{error}</Alert> : null}
              {note ? <Alert kind="info">{note}</Alert> : null}

              <div className="actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Generating...' : 'Generate barcode'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetBarcodeForm}
                  disabled={loading}
                >
                  Reset
                </button>
              </div>
            </form>
          )}

          <aside className="card preview-card">
            <h2 className="card-title">Preview</h2>

            <div className="preview-box">
              {loading ? (
                <p className="preview-empty">
                  <span className="spinner" aria-hidden="true" />
                  Generating...
                </p>
              ) : result ? (
                <img
                  className="preview-img"
                  src={result.url}
                  alt="Generated code"
                  onLoad={(event) =>
                    setResultSize({
                      width: event.target.naturalWidth,
                      height: event.target.naturalHeight,
                    })
                  }
                />
              ) : (
                <p className="preview-empty">Your generated code will appear here.</p>
              )}
            </div>

            {result ? (
              <p className="preview-meta">
                {resultSize
                  ? 'PNG - ' + resultSize.width + ' x ' + resultSize.height + ' px'
                  : 'PNG image'}
              </p>
            ) : null}

            <div className="preview-actions">
              {result ? (
                <a className="btn btn-primary btn-full" href={result.url} download={result.filename}>
                  Download PNG
                </a>
              ) : (
                <button type="button" className="btn btn-primary btn-full" disabled>
                  Download PNG
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={clearResult}
                disabled={!result}
              >
                Clear preview
              </button>
            </div>

            {result ? <p className="file-name">{result.filename}</p> : null}
            <p className="hint">
              Only PNG download is implemented, so that is the only button shown.
            </p>
          </aside>
        </div>
      </main>
    </div>
  )
}
