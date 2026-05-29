# ระบบติดตามสถานะคดีปกครอง — โครงการเราชนะ

ระบบ Dashboard สำหรับติดตามสถานะคดีปกครองโครงการเราชนะ  
พัฒนาโดยกองกฎหมาย สำนักงานเศรษฐกิจการคลัง

---

## สถาปัตยกรรม

| ส่วน | เทคโนโลยี | หน้าที่ |
|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | แสดงผล Dashboard และตาราง |
| Backend | Node.js + Express | Proxy API, JWT Auth, Rate Limiting |
| แหล่งข้อมูล | Google Sheets API v4 | เก็บข้อมูลคดี |
| Deployment | Render.com | Host backend + static files |

---

## ความปลอดภัย

- **JWT Authentication** — ทุก request ต้องแนบ Bearer token อายุ 4 ชั่วโมง
- **Rate Limiting** — 100 req/15 min ทั่วไป, 10 req/15 min สำหรับ `/api/login`
- **Helmet.js** — Security headers (CSP, HSTS, X-Frame-Options ฯลฯ)
- **CORS** — อนุญาตเฉพาะ origin ที่กำหนด
- **XSS Prevention** — ใช้ `textContent` ทุกจุด ไม่ใช้ `innerHTML`
- **Payload limit** — JSON body จำกัด 10 KB
- **Static file protection** — บล็อก `server.js`, `package.json`, `.env` จาก public access

---

## Environment Variables

สร้างไฟล์ `.env` ที่ root ของโปรเจกต์:

```env
# Required — server จะหยุดทันทีหากขาดตัวใดตัวหนึ่ง
JWT_SECRET=<สตริงสุ่มยาวอย่างน้อย 64 ตัวอักษร>
ACCESS_PASSWORD=<รหัสผ่านสำหรับเข้าระบบ>
GOOGLE_SHEETS_API_KEY=<Google Sheets API Key>
SPREADSHEET_ID=<Spreadsheet ID จาก URL>
SHEET_RANGE=<ช่วง เช่น Sheet1!A1:G500>

# Optional
PORT=3000
```

---

## การติดตั้งและรัน (Local)

```bash
git clone https://github.com/suriyunsam/wewin-case.git
cd wewin-case
npm install
# สร้างและแก้ไข .env ก่อน
node server.js
```

เปิด browser ที่ `http://localhost:3000`

---

## API Endpoints

| Method | Path | Auth | คำอธิบาย |
|---|---|---|---|
| POST | `/api/login` | ไม่ต้อง | รับ JWT token ด้วย password |
| GET | `/api/casestatus` | Bearer JWT | ดึงข้อมูลคดีจาก Google Sheets |
| GET | `/api/health` | ไม่ต้อง | Health check สำหรับ load balancer |

---

## การ Deploy บน Render.com

1. Connect GitHub repository ใน Render Dashboard
2. Build command: `npm install`
3. Start command: `node server.js`
4. เพิ่ม Environment Variables ทุกตัวในหน้า Environment ของ Render

---

## โครงสร้างไฟล์

```
wewin-case/
├── server.js              # Express backend
├── index.html             # หน้าหลัก Dashboard
├── dashboard_logic.js     # Frontend JS logic
├── dashboard_styles.css   # Styles
├── package.json
├── README.md
└── SECURITY.md
```

---

*Version 1.0 — กองกฎหมาย สำนักงานเศรษฐกิจการคลัง*
