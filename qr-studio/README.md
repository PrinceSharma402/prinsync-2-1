# PrinSync 2.1 — QR Code & Barcode Generator

A small web application that creates QR codes (with an optional logo in the centre) and
barcodes, shows a preview, and lets you download the result as a PNG file.

* **Backend:** Python + FastAPI + Uvicorn (image banane ke liye `qrcode` + Pillow + `python-barcode`)
* **Frontend:** React + Vite (plain JavaScript and plain CSS, koi UI library nahi)
* **Database / login / Docker:** kuch bhi nahi. Sab kuch aapke apne computer par chalta hai.

---

## Table of contents

1. [Abstract](#1-abstract)
2. [Problem statement](#2-problem-statement)
3. [Objectives](#3-objectives)
4. [How the whole thing works (Hinglish flow)](#4-how-the-whole-thing-works-hinglish-flow)
5. [Technology stack — kaun kya karta hai](#5-technology-stack--kaun-kya-karta-hai)
6. [Module descriptions](#6-module-descriptions)
7. [Project structure](#7-project-structure)
8. [API documentation](#8-api-documentation)
9. [Installation and execution (Windows + VS Code)](#9-installation-and-execution-windows--vs-code)
10. [Test cases and test results](#10-test-cases-and-test-results)
11. [Known limitations](#11-known-limitations)
12. [Future scope](#12-future-scope)
13. [Viva questions with short answers](#13-viva-questions-with-short-answers)
14. [Demo script (2–3 minutes)](#14-demo-script-23-minutes)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Abstract

QR codes aur barcodes aaj har jagah use hote hain — shop billing, WiFi sharing, business
cards, college notice boards. Lekin online QR banane wali websites aksar ads se bhari hoti
hain, kuch features ke paise leti hain, aur ek badi problem ye hai ki hum apna data kisi
doosre ke server par bhej dete hain.

**PrinSync 2.1** ek simple self-hosted web application hai jo QR code aur barcode generate
karta hai. Ismein sabse important feature ye hai ki user apna **logo QR code ke centre
mein laga sakta hai** — aur wo logo asli image ke andar embed hota hai (CSS se upar nahi
rakha jaata), isliye download ki gayi PNG file me bhi logo aata hai.

Yeh project do hisso me bana hai:

* **Frontend (React):** ek single page jahan user data bharta hai, colours chunta hai,
  logo upload karta hai aur preview dekhta hai.
* **Backend (FastAPI):** ek REST API jo data leta hai, Python library se image banata hai
  aur PNG bytes wapas bhejta hai.

Dono aapas me sirf **HTTP requests** se baat karte hain, isliye frontend aur backend ko
alag-alag chalu kiya ja sakta hai.

---

## 2. Problem statement

1. Most free QR generator websites data ko apne server par bhej deti hain — privacy ka
   issue hota hai.
2. Logo QR code ke centre me lagane wala feature aksar paid hota hai, ya sirf CSS preview
   deta hai (download karne par logo gayab ho jaata hai).
3. Barcodes ke formats ke apne strict rules hote hain (EAN-13 me 12 digits, check digit
   ka calculation, etc.). Random text bhejne par galat ya unscannable barcode banta hai.
4. Students ko ek chhota, samajhne layak aur poora working example chahiye hota hai jisme
   frontend aur backend dono ka connection saaf dikhe.

PrinSync 2.1 inhi chaar problems ko solve karta hai — sab kuch local chalta hai, logo
asli image me embed hota hai, barcode inputs format ke rules ke hisaab se validate hote
hain, aur code itna simple rakha gaya hai ki ek BCA student use padhkar samjha sake.

---

## 3. Objectives

| # | Objective |
|---|-----------|
| 1 | React + Vite ka ek single-page frontend banana with plain CSS (koi UI library nahi). |
| 2 | FastAPI ka ek REST API banana jo 4 endpoints de. |
| 3 | 6 tarah ke QR codes support karna: Text, URL, Wi-Fi, Email, Phone, Contact (vCard). |
| 4 | QR ke foreground/background colour, size, border aur error-correction level control karna. |
| 5 | Logo upload karke usko Pillow se QR ke centre me embed karna. |
| 6 | Barcodes banana: Code 128, Code 39, EAN-13, EAN-8, UPC-A — format ke rules ke saath validation. |
| 7 | Preview dikhana, PNG download dena aur Blob URL properly free karna. |
| 8 | Poori tarah responsive layout (mobile, tablet, desktop). |
| 9 | Har galti par saaf, simple error message dikhana. |
| 10 | Code me comments aur Hinglish explanation dena taaki student samajh sake. |

---

## 4. How the whole thing works (Hinglish flow)

Ye sabse zaroori samajhne wali baat hai. Poore project ka safar bas itna hai:

```
User data bharta hai
   ↓
React us data ko FormData me daal ke POST request bhejta hai   (fetch API)
   ↓
FastAPI request leta hai aur pehle validation karta hai         (main.py)
   ↓
Python library image banati hai                                 (qr.py / barcodes.py)
   ↓
FastAPI us image ko PNG bytes ke roop me wapas bhejta hai       (Response)
   ↓
React us image ko Blob URL banakar <img> me dikhata hai         (preview)
   ↓
User "Download PNG" button dabata hai aur file save ho jaati hai
```

Thoda detail me:

1. **User data bharta hai** — jaise `Hello PrinSync` type karta hai, ya WiFi ka SSID aur
   password likhta hai, ya apna logo file chunta hai.
2. **React request bhejta hai** — `App.jsx` me `handleQrSubmit()` function chalta hai.
   Wo saara data ek `FormData` object me daalta hai (FormData use karte hain kyunki logo
   ek file hai, aur file bhejne ka standard tarika multipart/form-data hai). Phir
   `fetch('http://127.0.0.1:8000/generate-qr', ...)` se POST request jaati hai.
3. **FastAPI request leta hai** — `main.py` ka `generate_qr()` function chalta hai. Wo
   colour format, size, border aur logo file ko check karta hai. Kuch bhi galat ho to
   `400` status code ke saath `{"detail": "message"}` wapas jaata hai.
4. **Python library image banati hai** —
   * QR ke liye: `qr.py` pehle **payload** (QR ke andar dakhil hone wala asli text) banata
     hai. Phir `qrcode` library us payload ka QR banati hai, aur agar logo diya gaya hai to
     **Pillow** usko image ke centre me paste karti hai.
   * Barcode ke liye: `barcodes.py` pehle input validate karta hai (EAN me digits, check
     digit, etc.), phir `python-barcode` library image banati hai.
   * Dono cases me image **disk par save nahi hoti** — memory me `BytesIO` buffer banti
     hai aur uski bytes return hoti hain.
5. **FastAPI image wapas bhejta hai** — `Response(content=image_bytes, media_type="image/png")`.
   Saath me `Content-Disposition` header me ek meaningful filename (jaise
   `prinsync-qr-wifi-20261022-104500.png`) bhi jaata hai.
6. **React preview dikhata hai** — response ek image hai, JSON nahi. Isliye
   `await response.blob()` se usko Blob banate hain, phir `URL.createObjectURL(blob)` se
   ek temporary URL banate hain aur usko `<img src=...>` me lagate hain.
7. **User download karta hai** — Download button asal me ek `<a href={blobUrl} download={filename}>`
   link hai. Browser usko click karke file save kar deta hai — ye browser ka apna feature hai,
   koi "fake" download nahi.
8. **Blob URL free karna** — har naya result aane par purana Blob URL
   `URL.revokeObjectURL()` se free kar diya jaata hai, warna browser memory me kachra
   jama hota rehta hai.

**Frontend aur backend alag-alag port par chalte hain:**

| Part | Address |
|------|---------|
| React dev server | `http://localhost:5173` |
| FastAPI server | `http://127.0.0.1:8000` |

Dono alag *origin* hain (port alag hai), isliye browser by default cross-origin request
block kar deta hai. Isko allow karne ke liye backend me **CORS** set kiya gaya hai
(`main.py` me `ALLOWED_ORIGINS`). Ye frontend-backend communication ka sabse important
setting hai.

---

## 5. Technology stack — kaun kya karta hai

### Backend

| Dependency | Kaam |
|------------|-----|
| **FastAPI** | Web framework. Routes banata hai, aane wale data ko check karta hai, `/docs` par automatic API documentation deta hai. |
| **Uvicorn** | ASGI server. FastAPI app ko actually chalu karta hai (bina iske `main.py` sirf ek file hai, chalega nahi). |
| **python-multipart** | FastAPI ko `multipart/form-data` padhne ki permission deta hai. File upload ke liye zaroori hai — iske bina logo upload `500` error dega. |
| **qrcode** | Data ko QR ke "modules" (chhote black/white squares) me todta hai aur image banata hai. Error correction level bhi yehi handle karta hai. |
| **Pillow (PIL)** | Image handling. Do kaam: (a) `qrcode` aur `python-barcode` ko actual image banane ke liye chahiye, (b) logo ko QR ke centre me paste karna aur PNG save karna. |
| **python-barcode** | Code 128, Code 39, EAN-13, EAN-8, UPC-A ke barcode patterns banata hai. |

`segno` library **use nahi ki gayi** — kyunki `qrcode` + Pillow se saara kaam ho jaata hai,
aur kam dependencies rakhna beginner ke liye behtar hai.

### Frontend

| Dependency | Kaam |
|------------|-----|
| **React** | UI ko chhote chhote parts (components) me likhne deta hai. Yahan `App.jsx` me poori UI hai. |
| **ReactDOM** | React ke "virtual" UI ko asli browser ke DOM me render karta hai. |
| **Vite** | Dev server (fast refresh ke saath) aur production build tool. |
| **@vitejs/plugin-react** | Vite ko JSX samjhata hai (JSX = HTML jaisa syntax JavaScript ke andar). |

CSS plain hai — `index.css` (global reset + theme variables) aur `App.css` (page ka layout).
Koi Tailwind, koi Bootstrap, koi animation library nahi.

---

## 6. Module descriptions

### Backend

#### `backend/main.py` — API ka darwaza

* FastAPI app banata hai aur CORS set karta hai.
* Char endpoints define karta hai: `/`, `/health`, `/generate-qr`, `/generate-barcode`.
* Aane wale data ko validate karta hai (`check_color`, `check_range`, `read_logo_bytes`).
* `qr.py` aur `barcodes.py` ko call karke PNG bytes leta hai.
* `png_response()` helper se image ko sahi `Content-Type` aur filename ke saath bhejta hai.

#### `backend/qr.py` — QR ka saara logic

Teen hisse hain:

1. **Payload builders** — `_payload_text`, `_payload_url`, `_payload_wifi`, `_payload_email`,
   `_payload_phone`, `_payload_contact`. Ye "user ka data" ko "QR me dakhil hone wale sahi
   text" me badalte hain. `build_payload()` in sab ko choose karta hai.
   * Wi-Fi QR ke liye standard format use hota hai:
     `WIFI:T:WPA;S:MyWiFi;P:mypassword;;` — ye wahi format hai jise Android aur iPhone ki
     camera app samajhti hai, isliye scan karne par phone seedha "WiFi se connect karo?"
     puchhta hai. Isme `\ ; , : "` jaise characters ko escape karna padta hai (`_escape_wifi`),
     warna SSID galat padha jaayega.
   * Email ke liye `mailto:` URI (subject/body URL-encoded).
   * Phone ke liye `tel:` URI.
   * Contact ke liye **vCard 3.0** text (`BEGIN:VCARD ... END:VCARD`), jisme line endings
     CRLF (`\r\n`) hone chahiye — ye standard ka rule hai.
2. **`add_logo()`** — Pillow se logo ko centre me embed karta hai (neeche detail me).
3. **`make_qr_png()`** — `qrcode` se QR banata hai, logo lagaata hai, PNG bytes return karta hai.

#### `backend/barcodes.py` — barcode ka saara logic

> **File ka naam note karein:** prompt me `barcode.py` likha tha, lekin humne file ka naam
> **`barcodes.py`** rakha hai. Wajah: `python-barcode` package ko `import barcode` likh kar
> import karte hain. Agar humari file ka naam bhi `barcode.py` hota, to Python `import barcode`
> par hamari hi file import kar leta aur conflict ban jaata. Isliye naam `barcodes.py` hai —
> kaam bilkul wahi hai.

* `FORMATS` dictionary me har format ke rules hain (kitne digits, min/max length).
* `calculate_check_digit()` — EAN/UPC ka last digit (check digit) nikalta hai. Rule: right se
  ginte hue digits ko 3, 1, 3, 1 ... se multiply karo, sab jodo, phir `(10 - total % 10) % 10`.
* `validate_input()` — format ke hisaab se input check karta hai aur saaf kiya hua data return
  karta hai. Galti par `ValueError` raise karta hai (jo `main.py` me `400` error ban jaata hai).
* `make_barcode_png()` — `python-barcode` ke `ImageWriter` se PNG bytes banata hai.

#### `backend/requirements.txt`

Saari Python dependencies, version ke saath, aur har ek ke aage comment ki wo kis kaam ki hai.

### Frontend

#### `frontend/src/App.jsx`

Poori application ka dimaag — ek hi component me (chhote `Field` aur `Alert` helpers ke saath):

* **State** (`useState`): `mode` (QR ya Barcode), `qrForm`, `barcodeForm`, `logoFile`,
  `logoPreview`, `result`, `error`, `note`, `loading`, `backendStatus`.
* **`useEffect` #1** — page khulte hi `GET /health` call karke check karta hai ki backend chalu
  hai ya nahi (header me green/red dot dikhta hai).
* **`useEffect` #2** — logo file chunte hi uska preview URL banata hai, aur logo badalne/hataane
  par purana URL revoke karta hai.
* **`useEffect` #3** — naya result aane par purane result ka Blob URL revoke karta hai.
* **`sendRequest()`** — sabse important function. POST request bhejta hai, error JSON padhta hai,
  aur safal hone par image ko Blob → Object URL me badal ke state me rakhta hai.
* **`handleQrSubmit()` / `handleBarcodeSubmit()`** — pehle form validate karte hain (turant
  feedback ke liye), phir `FormData` banakar request bhejte hain.
* **`checkColors()`** — WCAG contrast formula se check karta hai ki foreground aur background
  ka farq kaafi hai ya nahi. Kam contrast par warning dikhata hai.

#### `frontend/src/App.css` aur `frontend/src/index.css`

* `index.css` — `:root` me theme variables (`--accent: #1e5aa8`, `--border: #e2dfd8`, etc.),
  basic reset, focus outline.
* `App.css` — header, tabs, do-column layout (form + preview), cards, inputs, buttons, alerts,
  spinner, footer. Media queries 900px aur 560px par layout ko ek column kar deti hain.

#### `frontend/src/main.jsx`

React app ko start karta hai — `root` div dhoondh ke `<App />` render karta hai.

---

## 7. Project structure

```
qr-studio/
├── backend/
│   ├── main.py              # FastAPI app + endpoints + validation
│   ├── qr.py                # QR payload, QR image, logo embedding (Pillow)
│   ├── barcodes.py          # barcode validation + image (python-barcode)
│   ├── requirements.txt     # Python dependencies
│   └── .venv/               # virtual environment (aap banayenge, git me nahi jaata)
└── frontend/
    ├── package.json         # npm dependencies + scripts
    ├── vite.config.js       # Vite config (port 5173)
    ├── index.html           # HTML entry point
    └── src/
        ├── main.jsx         # React start
        ├── App.jsx          # poori UI + backend connection
        ├── App.css          # component/page styling
        └── index.css        # global styles + theme variables
```

Frontend me ek extra file hai jo prompt ki list me nahi thi: **`vite.config.js`**. Ye zaroori
hai kyunki isme dev server ka port (`5173`) set kiya gaya hai, aur yahi port backend ke
`ALLOWED_ORIGINS` se match karta hai.

---

## 8. API documentation

Backend chalu hone ke baad interactive documentation yahan milegi: **http://127.0.0.1:8000/docs**

### `GET /`

Basic API information (browser me `http://127.0.0.1:8000` kholne par yahi dikhta hai).

```json
{
  "name": "PrinSync 2.1 API",
  "version": "2.1",
  "description": "QR code and barcode generator API.",
  "docs": "/docs",
  "endpoints": ["GET  /", "GET  /health", "POST /generate-qr", "POST /generate-barcode"]
}
```

### `GET /health`

Frontend isi se check karta hai ki backend chalu hai ya nahi.

```json
{ "status": "ok", "service": "prinsync-api", "version": "2.1", "time": "2026-10-22T13:18:08" }
```

### `POST /generate-qr`

**Request:** `multipart/form-data` (kyunki logo ek file hai).

| Field | Type | Default | Matlab |
|-------|------|---------|--------|
| `data_type` | text | `text` | `text`, `url`, `wifi`, `email`, `phone`, `contact` |
| `text` | text | — | `text` type ke liye (max 1000 characters) |
| `url` | text | — | `url` type ke liye. `https://` na ho to apne aap lag jaata hai |
| `wifi_ssid` | text | — | Wi-Fi network ka naam |
| `wifi_password` | text | — | Wi-Fi password (`nopass` par khali chhod sakte hain) |
| `wifi_encryption` | text | `WPA` | `WPA`, `WEP` ya `nopass` |
| `wifi_hidden` | bool | `false` | Hidden network hai ya nahi |
| `email_to` | text | — | Email address |
| `email_subject` | text | — | Optional |
| `email_body` | text | — | Optional |
| `phone` | text | — | Phone number |
| `contact_first_name` | text | — | vCard |
| `contact_last_name` | text | — | vCard |
| `contact_phone` | text | — | vCard |
| `contact_email` | text | — | vCard |
| `contact_organization` | text | — | vCard (optional) |
| `foreground` | text | `#000000` | QR modules ka colour (hex) |
| `background` | text | `#FFFFFF` | Background colour (hex) |
| `size` | int | `400` | 128 se 1024 pixels ke beech |
| `border` | int | `4` | 0 se 8 modules ka safed margin |
| `error_level` | text | `M` | `L`, `M`, `Q`, `H`. Logo ho to hamesha `H` kiya jaata hai |
| `logo` | file | — | Optional. PNG ya JPEG, 2 MB se chhoti |

**Response (200):** PNG image bytes.

| Header | Value |
|--------|-------|
| `Content-Type` | `image/png` |
| `Content-Disposition` | `inline; filename="prinsync-qr-wifi-20261022-104500.png"` |
| `X-Prinsync-Note` | Optional. Jaise "Check digit added" ya "Error correction set to H". Frontend ise info alert me dikhata hai. |

**Response (400):** `{"detail": "Please enter a website URL."}` — validation error.
**Response (500):** `{"detail": "Could not generate the QR image: ..."}` — unexpected problem.

### `POST /generate-barcode`

**Request:** `multipart/form-data`.

| Field | Type | Default | Matlab |
|-------|------|---------|--------|
| `data` | text | *(required)* | Barcode me dakhil hone wali value |
| `barcode_format` | text | `code128` | `code128`, `code39`, `ean13`, `ean8`, `upca` |
| `foreground` | text | `#000000` | Bars ka colour |
| `background` | text | `#FFFFFF` | Background colour |
| `show_text` | bool | `true` | Barcode ke neeche value likhni hai ya nahi |
| `bar_height` | float | `15.0` | 5 se 30 mm ke beech |

**Response (200):** PNG image, `Content-Disposition` me jaise
`prinsync-barcode-ean13-20261022-104500.png`, aur zaroorat padne par `X-Prinsync-Note`.

**Format ke rules (backend hi enforce karta hai):**

| Format | Input |
|--------|-------|
| Code 128 | 1–48 characters, sirf ASCII (English letters, digits, symbols). Devanagari/emoji nahi. |
| Code 39 | 1–40 characters. Allowed: `A–Z 0–9 - . $ / + %` aur space. Small letters apne aap capital ho jaate hain. |
| EAN-13 | 12 digits (check digit khud add hota hai) **ya** 13 digits (check digit verify hota hai). |
| EAN-8 | 7 digits ya 8 digits. |
| UPC-A | 11 digits ya 12 digits. |

### CORS — production me kya badalna hai

`main.py` me:

```python
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

Ye sirf **local development** ke liye hai (Vite ka default port 5173). Jab aap website ko
asli server par deploy karein, to yahan apna asli domain daalein, jaise:

```python
ALLOWED_ORIGINS = ["https://prinsync.example.com"]
```

Aur frontend me backend ka address badalne ke liye `frontend/.env` file banayein:

```
VITE_API_BASE=https://api.prinsync.example.com
```

(`App.jsx` me `const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'`
likha hai, isliye ye value apne aap uth li jaati hai.)

---

## 9. Installation and execution (Windows + VS Code)

Zaroori software jo pehle se hona chahiye:

* **Python 3.10 ya usse naya** → install karte waqt **"Add Python to PATH"** tick karna zaroori hai
* **Node.js 18 ya usse naya** (npm iske saath aa jaata hai)
* **VS Code**

Aage ke commands me **ek baar `-` (hyphen) hi likhna hai**, aur har command ke saath likha hai
ki wo **kis folder se** chalani hai.

### Step 1 — project folder kholna

VS Code me `File → Open Folder` se apna project ka main folder khol lein (jisme `qr-studio`
folder hai). Phir VS Code me **terminal kholne ke liye** `Ctrl + `` ` (backtick) dabayein.

### Step 2 — backend ka virtual environment banana

Windows me `venv` activate karne ka command thoda alag hota hai, isliye dhyan se:

```powershell
cd qr-studio\backend
py -m venv .venv
```

(`py` command kaam na kare to `python -m venv .venv` likhein.)

Ab venv ko activate karein:

```powershell
.\.venv\Scripts\Activate.ps1
```

Safal hone par terminal ke shuru me `(.venv)` dikhega, jaise:

```
(.venv) PS C:\...\qr-studio\backend>
```

> **Agar PowerShell error de** — `... running scripts is disabled on this system` — to sirf
> is terminal ke liye policy badal dein aur dobara activate karein:
>
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> .\.venv\Scripts\Activate.ps1
> ```

### Step 3 — Python dependencies install karna

`qr-studio\backend` folder se hi, venv activated rehte hue:

```powershell
pip install -r requirements.txt
```

Ye 6 packages install karega: `fastapi`, `uvicorn`, `python-multipart`, `qrcode`, `pillow`,
`python-barcode`.

### Step 4 — backend chalu karna (Terminal 1)

`qr-studio\backend` folder se:

```powershell
uvicorn main:app --reload
```

Output aisa aayega:

```
Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

* `main` = `main.py` file, `app` = us file ke andar ka FastAPI object
* `--reload` = code badalne par server apne aap restart ho jaata hai

Ab browser me ye do links check karein:

* **http://127.0.0.1:8000** → API information dikhegi
* **http://127.0.0.1:8000/docs** → interactive documentation, jahan se aap API ko test kar sakte hain

**Is terminal ko band mat karein.** Backend isi me chal raha hai.

### Step 5 — frontend ki dependencies install karna (Terminal 2)

VS Code me **naya terminal** kholein (`Ctrl + Shift + `` `), aur:

```powershell
cd ..\frontend
npm install
```

### Step 6 — frontend chalu karna (Terminal 2)

`qr-studio\frontend` folder se:

```powershell
npm run dev
```

Vite output dega:

```
  VITE v5.4.11  ready in 300 ms

  ➜  Local:   http://localhost:5173/
```

Browser apne aap khul jaayega (`open: true` set hai). Na khule to
**http://localhost:5173** manually khol lein.

### Step 7 — frontend aur backend ka connection test karna

1. Page ke top-right corner me **"Backend connected"** likha hoga aur ek **hara dot** dikhega.
   * Hara dot = backend chal raha hai, connection theek hai.
   * Laal dot / "Backend not reachable" = backend band hai. Terminal 1 check karein.
2. Type dropdown me `Text` chuna hua hoga. Textarea me kuch likhein, jaise `Hello PrinSync`.
3. **"Generate QR code"** dabayein. Preview box me QR code aana chahiye.
4. **"Download PNG"** dabayein — `prinsync-qr-text-...png` file download hogi.
5. Ab apne phone ki camera se us QR ko scan karke check karein ki wo sahi text dikha raha hai.

Bas! Project chal raha hai.

### Summary table — kaunsa command kis folder se

| Terminal | Folder | Command |
|----------|--------|---------|
| 1 (backend) | `qr-studio\backend` | `.\.venv\Scripts\Activate.ps1` phir `uvicorn main:app --reload` |
| 2 (frontend) | `qr-studio\frontend` | `npm run dev` |

### Production build (optional)

Frontend ka optimized version banana ho to `qr-studio\frontend` se:

```powershell
npm run build
```

Isse `frontend\dist\` folder banega, jise kisi bhi static hosting par daal sakte hain.
(Backend alag server par chalega — tab `ALLOWED_ORIGINS` aur `VITE_API_BASE` update karna
na bhulein.)

---

## 10. Test cases and test results

Testing do tarah se ki gayi.

### A. Automated API tests (84 assertions, sab pass)

Ek test script se live backend par requests bheji gayi, aur **har generated QR/barcode ko
wapas decode karke check kiya gaya** (`zxing-cpp` decoder se — ye wahi library hai jo asli
barcode scanner apps use karti hain). Matlab ye test sirf "status 200 aaya" nahi dekhta —
wo actually padh kar batata hai ki image ke andar sahi data hai ya nahi.

Kuch important assertions:

| Kya test hua | Kaise verify hua |
|--------------|------------------|
| Text / URL / Wi-Fi / Email / Phone / Contact QR | QR ko decode karke andar ka text match kiya |
| Wi-Fi QR ka format | Decoded payload `WIFI:T:WPA;S:...;P:...;;` format me hai |
| Colours (foreground/background) | Decode + pixels check |
| Logo QR | Decode hua, aur logo 2%–10% area cover karta hai, centre me hai (8px ke andar), aspect ratio maintain hai |
| Logo hataane par | Banaya gaya QR, bina-logo QR se bilkul same (pixel-by-pixel) |
| Size aur border | Image ke actual pixels check kiye |
| Barcode: Code 128, Code 39, EAN-13, EAN-8, UPC-A | Har ek ko decode karke value match ki |
| EAN/UPC check digit | Galat check digit par sahi error message |
| Galat input (khali, galat length, galat characters, Devanagari, invalid hex colour, 3MB logo, fake image file) | 400 status + saaf message |

**Result: 84 passed, 0 failed.**

### B. Frontend integration tests (43 assertions, sab pass)

`App.jsx` ko jsdom (browser jaisa environment) me mount karke asli backend se baat karayi gayi,
aur UI ka behaviour check kiya gaya.

**Result: 43 passed, 0 failed** — including:

* Header, heading, tabs, page load par koi error nahi
* `GET /health` → header me "Backend connected"
* Text QR generate karne par preview `<img>` ka src `blob:` URL hai
* Download link ka `download` attribute `prinsync-qr-text-YYYYMMDD-HHMMSS.png` format me hai
* Kam contrast colours par warning, theek colours par warning gayab
* Wi-Fi type chunne par fields badalte hain; khali SSID par request se **pehle** error
* Logo upload karne par preview + "Remove logo" button; error correction `H` ho jaata hai aur
  select disable ho jaata hai; backend ka note dikhta hai
* Logo hataane par preview gayab aur select phir enable
* `.txt` file chunne par "Logo must be a PNG or JPEG image."
* Tab badalne par preview clear
* Barcode (Code 128) generate + download filename
* EAN-13 me 3 digits par "EAN-13 needs 12 digits..."
* EAN-13 me 12 digits par image + "Check digit ... added" note
* Reset se preview, download link aur input saaf; Blob URLs revoke hue
* Backend band hone par friendly message: "Cannot reach the backend at ..."

### C. Build test

`npm run build` safal — 32 modules transform hue, `dist/` me production assets bane.

### D. Manual testing checklist

Ye cheezein **dohraani chahiye** apne computer par, kyunki inme aapka phone/eyes chahiye:

| # | Kaam | Kaise check karein | Expected |
|---|------|--------------------|----------|
| 1 | Basic QR | Text me `Hello` likh ke Generate | QR dikhe, phone se scan karne par `Hello` padha jaaye |
| 2 | URL QR | URL type, `example.com` | Scan karne par browser khule |
| 3 | Wi-Fi QR | Wi-Fi type, SSID + password | Scan karne par phone "Connect to network" puchhe |
| 4 | Email QR | Email type, `test@example.com` | Scan karne par mail app khule, "To" bhara ho |
| 5 | Phone QR | Phone type, `+91 98765 43210` | Scan karne par dialer khule |
| 6 | Contact QR | Contact type, naam + phone | Scan karne par "Add contact" ka option aaye |
| 7 | Colours | Foreground `#1e5aa8`, background `#ffffff` | Neele QR bane, scan ho jaaye |
| 8 | Poora contrast | Foreground `#dddddd` | Warning dikhe |
| 9 | Size slider | 200 px se 800 px | Preview ka size badle |
| 10 | Border slider | 0 aur phir 8 | 0 par QR kinare se chipka lage |
| 11 | Error correction | M se H | QR thoda dense ho jaaye |
| 12 | Logo upload | PNG ya JPEG chuno | Logo ka preview + "Remove logo" dikhe |
| 13 | Logo ke saath QR | Logo rakh ke Generate | QR ke centre me logo, aur "Error correction was set to H" note |
| 14 | Logo wala download | Download PNG phir file kholo | Logo image ke andar dikhe (na ki sirf screen par) |
| 15 | Logo hatana | "Remove logo" dabayein, phir Generate | Simple QR bane, bina logo |
| 16 | Galat logo | `.txt` ya `.pdf` file chuno | "Logo must be a PNG or JPEG image." |
| 17 | Bada logo | 2 MB se badi image | "Logo must be smaller than 2 MB." (ya backend se similar message) |
| 18 | Code 128 | `PRINSYNC-2026` | Barcode bane aur scan ho |
| 19 | Code 39 | `abc-123` | Barcode bane, value `ABC-123` ho |
| 20 | EAN-13 | `400638133393` (12 digits) | Barcode + "Check digit ... added" note |
| 21 | EAN-13 galat | `123` | "EAN-13 needs 12 digits..." error |
| 22 | EAN-13 galat check digit | `4006381333939` | "Invalid check digit..." error |
| 23 | Barcode download | Download PNG | File `prinsync-barcode-...png` ke naam se save ho |
| 24 | Barcode colours | Bar colour badlein | Barcode us colour me bane |
| 25 | Reset | Reset dabayein | Form aur preview dono saaf |
| 26 | Clear preview | Clear preview dabayein | Sirf preview hatay, form waise hi rahe |
| 27 | Backend band | Backend band karke Generate | "Cannot reach the backend at ..." message |
| 28 | Mobile view | F12 → device toolbar → 375px width | Layout ek column me aa jaaye, kuch bhi bahar na nikle |
| 29 | Tablet view | 768px width | Layout theek dikhe, buttons click ho sakein |

**Important honesty note:** logo wale QR code ke scan hone ki 100% guarantee nahi di ja sakti.
Isliye app me bhi likha hai: *"Always test the final code with a phone camera before printing."*
Har phone ka camera aur har scanner software thoda alag hota hai.

---

## 11. Known limitations

1. **Logo scan reliability** — Logo QR ke kuch modules dhak deta hai. Humne logo ko QR ki chhoti
   side ka ~22% hi rakha hai aur error correction `H` (30%) lagaya hai, lekin phir bhi kuch purane
   ya kamzor scanner logo wale QR ko nahi padh paate. Isliye final QR ko phone se test karna
   zaroori hai.
2. **Download sirf PNG me hai.** SVG ya PDF export nahi hai. Isliye app me sirf "Download PNG"
   button dikhaya gaya hai — koi aisa button nahi jo kaam na kare.
3. **Barcode me text/logo embed nahi hota.** `python-barcode` value neeche likh sakti hai
   (`show_text`), lekin barcode ke saath koi extra design nahi jod sakte.
4. **Code 39 ka checksum off hai.** `python-barcode` by default Code 39 me ek extra checksum
   character jod deti hai, jisse scan karne par typed text se ek character alag aata hai.
   College project me confusion se bachne ke liye humne `add_checksum=False` rakha hai — matlab
   jo type kiya wahi barcode me hai. Agar aapko strict Code 39 standard chahiye to
   `barcodes.py` me `extra_options["add_checksum"] = True` kar dein.
5. **UPC-A EAN-13 ki tarah encode hota hai.** Technically UPC-A, EAN-13 ka ek special case hai
   (aage `0` lagakar). Isliye kuch scanners value ko 12 digits ki jagah 13 digits (leading `0`
   ke saath) dikhate hain — ye normal hai, galti nahi.
6. **Size slider 200–800 px hai** (backend 128–1024 tak allow karta hai). Frontend me slider ki
   range jaan-boojh kar chhoti rakhi gayi hai taaki practical size hi bane.
7. **Ek time par ek hi logo.** Multiple logos ya logo ke saath text nahi jod sakte.
8. **History save nahi hoti.** Database nahi hai, isliye page refresh hone par purane codes
   chale jaate hain. Ye jaan-boojh kar rakha gaya hai — project ko simple rakhne ke liye.
9. **Colour warning ek hint hai, block nahi.** User poori tarah ulta (light foreground, dark
   background) colour bhi choose kar sakta hai — hum sirf warning dikhate hain, rok nahi dete,
   kyunki kuch scanners inverted QR bhi padh lete hain.
10. **Internet ki zaroorat nahi hai** generation ke liye, lekin Google Fonts jaisi koi cheez use
    nahi ki gayi hai — isliye page offline bhi sahi chalta hai.

---

## 12. Future scope

1. **SVG aur PDF download** — SVG vector hota hai, isliye printing me quality kabhi kam nahi hoti.
2. **Bulk generation** — CSV upload karke ek saath 100 QR codes banana (roll numbers ke liye
   kaafi useful).
3. **Scan history** — browser ke `localStorage` me last 10 codes save karna (database ke bina).
4. **QR design options** — rounded modules, dots style, aur ek chhota caption label.
5. **Frame/template** — QR ke neeche "Scan me" jaise text ke saath ready-made layout.
6. **Live scan check** — browser me hi camera se generate kiya hua QR turant test karna.
7. **Barcode ke formats badhana** — ITF-14, GS1-128, Code 93.
8. **Logo crop/position** — user khud tay kare ki logo centre me ho ya neeche.
9. **Deployment** — frontend ko Vercel/Netlify par aur backend ko Render/Railway par daalna,
   phir `ALLOWED_ORIGINS` aur `VITE_API_BASE` update karna.
10. **Dark mode** — abhi light theme hai; theme variables pehle se `index.css` me hain, isliye
    dark mode jodna aasan hai.

---

## 13. Viva questions with short answers

**Q1. Aapka project kya karta hai?**
Ye ek web application hai jo QR codes (logo ke saath bhi) aur barcodes generate karta hai,
preview dikhata hai aur PNG me download karne deta hai.

**Q2. Frontend aur backend me kaise baat hoti hai?**
HTTP requests se. React `fetch()` se POST request bhejta hai, FastAPI usko process karke
PNG image wapas bhejta hai. Dono alag port par chalte hain, isliye backend me CORS enable
kiya gaya hai.

**Q3. CORS kya hai aur kyun chahiye?**
CORS = Cross-Origin Resource Sharing. Browser ka security rule hai: agar page
`localhost:5173` se khula hai to wo by default `127.0.0.1:8000` se data nahi maang sakta.
`CORSMiddleware` me allowed origins likhne se browser ko permission mil jaati hai.

**Q4. Logo QR ke centre me kaise aata hai?**
Pillow library se, **backend par**. Har QR code me error correction hoti hai, matlab thoda
hissa kharab hone par bhi QR padha ja sakta hai. Hum us bharose ke hisse ke centre me logo
paste kar dete hain aur error correction `H` (30%) set kar dete hain.

**Q5. Logo CSS se kyun nahi lagaya?**
Agar CSS se lagate to sirf screen par logo dikhta, download ki gayi PNG file me nahi aata.
Isliye hum image ke andar (pixels me) logo embed karte hain.

**Q6. Pillow ka kya kaam hai?**
Teen kaam: (1) `qrcode` aur `python-barcode` ko image banane ke liye chahiye, (2) logo ko
resize karke QR ke centre me paste karna, (3) image ko PNG me save karna.

**Q7. Image file disk par save hoti hai?**
Nahi. Image memory me `BytesIO` buffer me banti hai, uski bytes nikal kar bhej di jaati hain,
aur buffer apne aap free ho jaata hai. Isse disk cleanup ka jhanjhat nahi hota aur speed bhi
theek rehti hai.

**Q8. PNG download kaise hota hai?**
Backend `Response(content=bytes, media_type="image/png")` bhejta hai. React usko
`response.blob()` se Blob banata hai aur `URL.createObjectURL()` se ek temporary URL banata
hai. Download button asal me `<a href={tempUrl} download="filename.png">` link hai — browser
ka apna download feature use hota hai.

**Q9. `URL.revokeObjectURL()` kyun call karte hain?**
`createObjectURL()` browser ki memory me ek URL banata hai jo tab tak free nahi hota jab tak
aap khud revoke na karein. Har naye result par purana revoke karte hain, warna memory leak
hota hai.

**Q10. Wi-Fi QR ka format kya hai?**
`WIFI:T:WPA;S:MyWiFi;P:mypassword;;`. `T` = security type, `S` = SSID, `P` = password.
Ye standard format hai jise Android aur iPhone ki camera app pehchanti hai.

**Q11. Error correction level kya hai?**
QR me kuch extra data isliye hota hai ki kuch hissa kharab ya dhaka hone par bhi QR padha ja
sake. Levels: `L` = 7%, `M` = 15%, `Q` = 25%, `H` = 30%. Level badhane se QR dense (aur
thoda bada) ho jaata hai.

**Q12. Barcode me check digit kya hota hai?**
EAN-13, EAN-8 aur UPC-A ka last digit ek "check digit" hota hai jo baaki digits se
calculate hota hai. Isse scanner turant pakad leta hai ki number galat type hua ya nahi.
Rule: right se digits ko 3, 1, 3, 1 ... se multiply karo, jodo, phir `(10 - total % 10) % 10`.

**Q13. EAN-13 me aap 12 digits kyun maangte hain?**
Kyunki 13th digit check digit hai. User 12 digits de to hum check digit khud nikal
ke jod dete hain, aur 13 digits de to verify karte hain ki sahi hai ya nahi.

**Q14. `barcode.py` ki jagah `barcodes.py` kyun?**
`python-barcode` package ko `import barcode` se import karte hain. Humari file ka naam bhi
`barcode.py` hota to Python hamari hi file import kar leta (naam clash), isliye `barcodes.py`
rakha.

**Q15. Database kyun nahi use kiya?**
Is project me data store karne ki zaroorat hi nahi hai — har request par image banti hai aur
turant bhej di jaati hai. Database jodne se project bina zaroorat complex ho jaata.

**Q16. `uvicorn` aur `fastapi` me kya farq hai?**
FastAPI framework hai (routes, validation, docs deta hai), lekin khud server nahi chala sakta.
Uvicorn ASGI server hai jo FastAPI app ko actually chalu karta hai.

**Q17. Multipart/form-data kyun use kiya?**
Kyunki logo ek file hai. JSON me file bhejna aasan nahi hota; `multipart/form-data` file aur
normal fields dono ko ek hi request me bhejne ka standard tarika hai.

**Q18. `useEffect` ka kya kaam hai is project me?**
Teen kaam: backend health check karna, logo ka preview URL banana/hatana, aur naya result
aane par purana Blob URL revoke karna.

**Q19. Project ko responsive kaise banaya?**
CSS Grid/Flexbox se, aur do media queries se — 900px se neeche layout ek column ho jaata hai,
aur 560px se neeche padding aur buttons chhote/poore-chaurai ho jaate hain.

**Q20. Ye project kitna secure hai?**
Koi login, koi user data, koi database nahi — isliye attack surface bhi na hone ke barabar hai.
Phir bhi humne upload ki gayi file ka type, size aur asli image hone ki jaanch ki hai, aur
saare lengths/colours validate kiye hain.

---

## 14. Demo script (2–3 minutes)

**Shuru karne se pehle:** backend (Terminal 1) aur frontend (Terminal 2) chalu ho, aur
browser me `http://localhost:5173` khula ho.

| Time | Aap kya karein | Aap kya bolein |
|------|----------------|----------------|
| 0:00 | Page dikhayein | "Ye PrinSync 2.1 hai — ek QR code aur barcode generator. Frontend React me hai, backend FastAPI me. Ye mera apna local server hai, koi third-party website nahi." |
| 0:15 | Top-right ka hara dot dikhayein | "Ye hara dot batata hai ki frontend backend se connect hai. Ye connection `/health` endpoint se check hota hai." |
| 0:25 | Encryption dropdown dikhayein | "QR code 6 tarah ka bana sakte hain — text, URL, WiFi, email, phone aur contact card." |
| 0:35 | Text me `BCA Project 2026` likh ke **Generate** dabayein | "Data React se FastAPI ko gaya, wahan `qrcode` library ne image banayi, aur wahi image wapas aa kar yahan dikh rahi hai." |
| 0:50 | **Download PNG** dabayein, file khol kar dikhayein | "Download asli PNG file hai, koi screenshot nahi." |
| 1:00 | Type ko **Wi-Fi network** karein, SSID `MyHomeWiFi`, password `secret123`, Generate | "Wi-Fi QR ka format alag hota hai — `WIFI:T:WPA;S:...;P:...`. Yehi format phone ki camera samajhti hai, isliye scan karne par seedha 'Connect' ka option aata hai." |
| 1:15 | Foreground `#1e5aa8` karein | "Colours badal sakte hain. Agar colours bahut close ho jaayein to app khud warning dikha deta hai, kyunki aise QR scan nahi hote." |
| 1:30 | Logo file upload karein (PNG) | "Ab iska sabse important feature — centre logo. Logo upload karte hi error correction apne aap `H` ho jaata hai, kyunki logo QR ka kuch hissa dhak deta hai." |
| 1:45 | Generate, phir Download, file khol kar zoom karein | "Dhyan dein — logo sirf screen par nahi hai, wo image ke andar embed hai, Pillow library ne backend par paste kiya hai. Isliye download ki gayi file me bhi logo hai." |
| 2:00 | **Remove logo** → Generate | "Logo hataate hi phir se simple QR ban jaata hai." |
| 2:10 | **Barcode** tab → Format `EAN-13`, data `400638133393` (12 digits) → Generate | "Barcode me har format ke apne rules hain. EAN-13 me 13वाँ digit check digit hota hai, jo aur 12 digits se calculate hota hai — isliye app ne khud wo digit add kar diya aur note me bata diya." |
| 2:25 | Data me sirf `123` karke Generate | "Agar galat length daalein to app saaf error dikhata hai — server par request bhejne se pehle hi." |
| 2:35 | **Reset** dabayein | "Reset se poora form aur preview saaf ho jaata hai." |
| 2:40 | F12 → device toolbar → 375px | "Layout poori tarah responsive hai — mobile par bhi sahi chalta hai." |
| 2:50 | Finish | "To poora flow ye hai: user data bharta hai → React request bhejta hai → FastAPI validate karta hai → Python library image banati hai → FastAPI PNG wapas bhejta hai → React preview dikhata hai → user download karta hai." |

---

## 15. Troubleshooting

| Problem | Wajah | Hal |
|---------|-------|-----|
| `'uvicorn' is not recognized` | venv activate nahi hua | `.\.venv\Scripts\Activate.ps1` chalaayein (terminal me `(.venv)` dikhna chahiye) |
| `Activate.ps1 cannot be loaded ... running scripts is disabled` | PowerShell ki execution policy | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |
| `ModuleNotFoundError: No module named 'fastapi'` | Dependencies install nahi hui, ya galat Python use ho raha hai | venv activate karke `pip install -r requirements.txt` |
| Frontend par "Backend not reachable" | Backend band hai, ya doosre port par hai | Terminal 1 me `uvicorn main:app --reload` chalaayein |
| CORS error browser console me | Frontend ka port `ALLOWED_ORIGINS` se match nahi kar raha | `main.py` me apna port/domain jodein aur server restart karein |
| `npm run dev` par port busy | 5173 pehle se kisi ne use kiya hua hai | Vite khud doosra port (5174) de dega — lekin tab `ALLOWED_ORIGINS` me wo port add karna hoga |
| Logo upload par error | File PNG/JPEG nahi hai, ya 2 MB se badi hai | Sahi format ki chhoti image use karein |
| Logo wala QR scan nahi ho raha | Kamzor scanner ya bahut chhota print | QR size badhayein, ya logo hata kar simple QR use karein |
| EAN-13 par "Invalid check digit" | Aakhri digit galat hai | Sirf pehle 12 digits daalein — app check digit khud add kar dega |

---

## Verified status

Is project par jo cheezein actually run karke check ki gayi hain:

* Backend API test suite: **84 assertions, 0 failed** (har QR/barcode ko decode karke verify kiya gaya)
* Frontend integration test suite: **43 assertions, 0 failed** (jsdom + live backend)
* `npm run build`: **safal**
* CORS preflight (`OPTIONS /generate-qr`) from `http://localhost:5173`: **200, sahi headers**

Jo cheezein automate nahi ki ja sakti (jaise phone se scan karna, mobile layout aankhon se
dekhna) wo Section 10-D ki manual checklist me di gayi hain — kripya unhe khud verify karein.

### Developer test files (submission se pehle delete kar sakte hain)

In dono files ki app ko chalane ke liye zaroorat **nahi** hai — ye sirf testing ke liye likhi gayi
thi. Agar aapko submission me sirf app chahiye, to inhe delete kar dein:

* `frontend/_qa_frontend_test.mjs` — frontend integration test (43 assertions).
  Chalane ke liye: `npm install --no-save jsdom` phir `node _qa_frontend_test.mjs`
  (backend pehle chalu hona chahiye).
* `_qa/qa_api_tests.py` (project folder ke bahar) — backend API test (84 assertions).
  `zxing-cpp` chahiye: `pip install zxing-cpp`, phir `python qa_api_tests.py`.

---

**PrinSync 2.1** — BCA mini project. Codes locally bante hain, data kahin upload nahi hota.
