// server.js

require('dotenv').config(); 

const express = require('express');
const axios = require('axios');
const cors = require('cors'); 
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000; 

// 1. Security Headers: ป้องกัน XSS, Clickjacking และอื่นๆ
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "https://cdn.jsdelivr.net", "https://www.googletagmanager.com"], 
            "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "img-src": ["'self'", "data:"],
            "connect-src": ["'self'", "https://wewin-case-api.onrender.com"]
        },
    },
}));

// 2. Rate Limiting: ป้องกัน Brute-force Attacks
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 นาที
    max: 100, // จำกัด 100 requests ต่อ IP ต่อ window
    message: { error: "Too many requests from this IP, please try again later." }
});

// ใช้ rate limit กับทุก API endpoint
app.use('/api/', apiLimiter);

// Parse JSON body
app.use(express.json());

// Serve Static Files (index.html, dashboard_styles.css, etc.)
app.use(express.static(__dirname));

// 3. CORS Middleware
const allowedOrigins = [
    'http://localhost:8080', 
    'http://127.0.0.1', 
    'https://suriyunsam.github.io',
    'https://wewin-case.onrender.com'
]; 

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    methods: 'GET,POST',
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions)); 

// --- AUTH LOGIC ---
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'wewin_super_secret_key_change_me';

/** Endpoint สำหรับ Login เพื่อรับ Token */
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    
    if (ACCESS_PASSWORD && password === ACCESS_PASSWORD) {
        // สร้าง Token ที่มีอายุ 4 ชั่วโมง
        const token = jwt.sign({ authorized: true }, JWT_SECRET, { expiresIn: '4h' });
        return res.json({ token });
    }
    
    res.status(401).json({ error: "Invalid password" });
});

/** Middleware ตรวจสอบ JWT */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Missing token" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token" });
        req.user = user;
        next();
    });
};

// 4. API Endpoints
app.get('/', (req, res) => {
    res.json({ 
        status: 'WeWin Case Status API is running securely!', 
        message: 'Access protected data at /api/casestatus'
    });
});

app.get('/api/casestatus', authenticateToken, async (req, res) => {
    const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
    const SHEET_RANGE = process.env.SHEET_RANGE;

    if (!API_KEY || !SPREADSHEET_ID || !SHEET_RANGE) {
        return res.status(500).json({ error: "Server configuration missing." });
    }

    const encodedRange = encodeURIComponent(SHEET_RANGE);
    const GOOGLE_API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}?key=${API_KEY}`;

    try {
        const response = await axios.get(GOOGLE_API_URL);
        res.json(response.data); 
    } catch (error) {
        // ปรับปรุงการ Log: ไม่ส่งข้อมูลละเอียดกลับไปที่ Client
        console.error("Google Sheets API Error Status:", error.response?.status || error.message);
        res.status(500).json({ error: "Failed to fetch data from source." });
    }
});

app.listen(port, () => {
    console.log(`Server running securely on port ${port}`);
});
