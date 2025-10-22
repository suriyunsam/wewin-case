// server.js

// โหลดตัวแปรจากไฟล์ .env เมื่อรันบนเครื่อง Local
// เมื่อ Deploy บน Render/Heroku จะดึงจาก Environment Variables โดยตรง
require('dotenv').config(); 

const express = require('express');
const axios = require('axios');
const app = express();

// Render/Heroku จะกำหนด PORT ให้เอง
const port = process.env.PORT || 3000; 

// 1. CORS Middleware: อนุญาตให้ Frontend ของคุณเข้าถึง API นี้ได้
app.use((req, res, next) => {
    // ⚠️ **สำคัญ:** แทนที่ 'https://your-github-username.github.io' ด้วย Domain จริงของเว็บไซต์คุณ
    const allowedOrigins = [
        'http://localhost:8080', 
        'http://127.0.0.1', 
        'https://suriyunsam.github.io/' // Domain ของ GitHub Pages หรือ Custom Domain
    ]; 
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// 2. API Endpoint: สำหรับดึงข้อมูลสถานะคดี
app.get('/api/casestatus', async (req, res) => {
    
    // ดึงค่า API Key และ ID จาก Environment Variables
    const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const SHEET_RANGE = process.env.SHEET_RANGE;
    
    if (!API_KEY || !SPREADSHEET_ID || !SHEET_RANGE) {
        return res.status(500).json({ 
            error: "Server configuration missing. API Key or Spreadsheet info is not set in Environment Variables." 
        });
    }

    // สร้าง URL สำหรับเรียก Google Sheets API
    const encodedRange = encodeURIComponent(SHEET_RANGE);
    const GOOGLE_API_URL = 
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}?key=${API_KEY}`;

    try {
        // ใช้ axios เรียกข้อมูลจาก Google Sheets (ใช้ Key ที่ซ่อนอยู่)
        const response = await axios.get(GOOGLE_API_URL);
        
        // ส่งข้อมูลที่ได้รับกลับไปยัง Frontend
        res.json(response.data); 

    } catch (error) {
        console.error("Google Sheets API Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch data from Google Sheets API." });
    }
});

// 3. เริ่ม Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
