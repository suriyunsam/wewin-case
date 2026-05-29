// server.js

require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- STARTUP VALIDATION ---
// ป้องกันการรันในสภาพแวดล้อมที่ขาด environment variables สำคัญ
const REQUIRED_ENV = ['JWT_SECRET', 'ACCESS_PASSWORD', 'GOOGLE_SHEETS_API_KEY', 'SPREADSHEET_ID', 'SHEET_RANGE'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`[STARTUP ERROR] Missing required environment variables: ${missingEnv.join(', ')}`);
    console.error('Please set these in your .env file or deployment environment.');
    process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;

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

// Rate limit เฉพาะ login เข้มงวดกว่า: 10 ครั้ง / 15 นาที
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many login attempts. Please try again in 15 minutes." }
});

// ใช้ rate limit กับทุก API endpoint
app.use('/api/', apiLimiter);

// Parse JSON body (จำกัดขนาด payload)
app.use(express.json({ limit: '10kb' }));

// 2.5 Block sensitive server-side files from static serving
// ป้องกันไม่ให้ผู้ใช้ download source code หรือ config
const BLOCKED_PATHS = [
    '/server.js',
    '/package.json',
    '/package-lock.json',
    '/.env',
    '/.gitignore',
];
app.use((req, res, next) => {
    const requestedPath = req.path.toLowerCase();
    if (BLOCKED_PATHS.some(blocked => requestedPath === blocked || requestedPath.startsWith('/node_modules'))) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
});

// Serve Static Files (index.html, dashboard_styles.css, dashboard_logic.js)
app.use(express.static(__dirname));

// 3. CORS Middleware
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
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

/** Endpoint สำหรับ Login เพื่อรับ Token */
app.post('/api/login', loginLimiter, (req, res) => {
    const { password } = req.body;

    // Input validation
    if (!password || typeof password !== 'string' || password.length > 200) {
        return res.status(400).json({ error: "Invalid request." });
    }

    if (password === ACCESS_PASSWORD) {
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
// Health check endpoint — สำหรับ Render.com / load balancer
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
