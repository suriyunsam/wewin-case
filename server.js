// server.js

// โหลดตัวแปรจากไฟล์ .env เมื่อรันบนเครื่อง Local
// เมื่อ Deploy บน Render/Heroku จะดึงจาก Environment Variables โดยตรง
require('dotenv').config(); 

const express = require('express');
const axios = require('axios');
const cors = require('cors'); // ✅ เพิ่ม: Import cors package
const app = express();

// Render/Heroku จะกำหนด PORT ให้เอง
const port = process.env.PORT || 3000; 

// 0. Root Route: ใช้สำหรับทดสอบว่า Server ทำงานได้ (ตอบกลับเป็น JSON)
app.get('/', (req, res) => {
    res.json({ 
        status: 'WeWin Case Status API is running!', 
        message: 'Access the data at /api/casestatus endpoint.',
        data_endpoint: '/api/casestatus'
    });
});

// 1. CORS Middleware: ใช้ cors package เพื่อจัดการ Header และ Pre-flight Request 
const allowedOrigins = [
    'http://localhost:8080', 
    'http://127.0.0.1', 
    'https://suriyunsam.github.io' // 👈 โดเมน GitHub Pages ที่ปลอดภัยของคุณ
]; 

const corsOptions = {
    origin: (origin, callback) => {
        // อนุญาต origin ที่อยู่ในรายการ หรืออนุญาตถ้าไม่มี origin (เช่น Postman/Direct Access)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    methods: 'GET',
    allowedHeaders: ['Content-Type'],
    optionsSuccessStatus: 200 // สำหรับ Legacy Browsers
};

app.use(cors(corsOptions)); // ✅ ใช้ cors package แทน Middleware ที่เขียนเอง

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
        // บันทึก Error เต็มรูปแบบใน Log ของ Render
        console.error("Google Sheets API Error:", error.response?.data || error.message);
        // ส่งข้อความ Error ทั่วไปกลับไป Frontend
        res.status(500).json({ error: "Failed to fetch data from Google Sheets API." });
    }
});

// 3. เริ่ม Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
