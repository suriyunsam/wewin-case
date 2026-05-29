# Security Policy — ระบบติดตามสถานะคดีปกครองโครงการเราชนะ

## Supported Versions

| Version | Supported |
|---|---|
| 1.0.x | ✅ ได้รับการดูแล |

---

## Reporting a Vulnerability (แจ้งช่องโหว่)

หากพบช่องโหว่ด้านความปลอดภัยในระบบนี้ กรุณา **อย่า** เปิดเผยต่อสาธารณะโดยตรง

**ช่องทางการแจ้ง:**
- ติดต่อกองกฎหมาย สำนักงานเศรษฐกิจการคลัง โดยตรงผ่านช่องทางราชการ
- หรือสร้าง [GitHub Security Advisory](https://github.com/suriyunsam/wewin-case/security/advisories/new) แบบ private

**ข้อมูลที่ควรแนบมา:**
1. คำอธิบายช่องโหว่และผลกระทบที่อาจเกิดขึ้น
2. ขั้นตอนการทำซ้ำ (Steps to reproduce)
3. เวอร์ชันที่ได้รับผลกระทบ
4. หลักฐาน (screenshot, log) ถ้ามี

**กำหนดการตอบกลับ:**
- รับทราบภายใน **5 วันทำการ**
- อัปเดตสถานะภายใน **15 วันทำการ**
- แก้ไขช่องโหว่ระดับ Critical ภายใน **30 วัน**

---

## Security Measures in Place

ระบบนี้ใช้มาตรการดังต่อไปนี้:

- **Helmet.js** — HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- **JWT** — Stateless authentication, token expiry 4 hours
- **Rate Limiting** — ป้องกัน brute-force: 10 attempts / 15 min on login
- **CORS** — Allowlist-based origin control
- **Input Validation** — Password type/length check before comparison
- **XSS Prevention** — ใช้ DOM `textContent` API ทุกจุด
- **Sensitive file blocking** — `server.js`, `package.json`, `.env` ถูกบล็อก
- **Error sanitization** — ไม่ส่ง stack trace หรือข้อมูลภายในกลับไปที่ client

---

*Last updated: 2026 — กองกฎหมาย สำนักงานเศรษฐกิจการคลัง*
