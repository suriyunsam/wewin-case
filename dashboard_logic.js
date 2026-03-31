// dashboard_logic.js

// เก็บ instance ของ Chart.js
let chartInstance = null; 

// --- CONFIGURATION ---
const API_BASE_URL = 'https://wewin-case-api.onrender.com';
const API_URL = `${API_BASE_URL}/api/casestatus`;
const LOGIN_URL = `${API_BASE_URL}/api/login`;
const AUTH_KEY = 'Wewin_JWT_Token'; // เก็บ JWT แทนรหัสผ่านจริง

// Elements สำหรับ Login
const loginContainer = document.getElementById('login-container');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password-input');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error-message');

// Elements สำหรับ Dashboard
const dataDisplayContainer = document.getElementById('data-display-container');
const loadingMessage = document.getElementById('loading-message');
const mainDashboard = document.getElementById('mainDashboard');
const mainContent = document.getElementById('mainContent');
const tableSection = document.getElementById('tableSection'); 
const caseSearchInput = document.getElementById('caseSearch');
const casesTableBody = document.querySelector("#casesTable tbody");
const tableTitle = document.getElementById('tableTitle');
const logoutButton = document.getElementById('logout-button');
        
let allCasesData = []; 

// ----------------------------------------------------
// 1. Logic การจัดการ UI State
// ----------------------------------------------------

function showLogin(message = '') {
    dataDisplayContainer.style.display = 'none';
    loginContainer.style.display = 'flex';
    passwordInput.value = '';
    loginButton.disabled = false;
    loginButton.textContent = 'เข้าสู่ระบบ';
    loadingMessage.style.display = 'none';
    logoutButton.style.display = 'none';

    if (message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    } else {
        loginError.style.display = 'none';
    }
}

function showLoading(message = 'กำลังโหลดข้อมูล...') {
    loginContainer.style.display = 'none';
    dataDisplayContainer.style.display = 'block';
    loadingMessage.textContent = message;
    loadingMessage.style.display = 'block';
    mainDashboard.style.display = 'none';
    mainContent.style.display = 'none';
    tableSection.style.display = 'none'; 
}

function showDashboard() {
    loadingMessage.style.display = 'none';
    mainDashboard.style.display = 'grid'; 
    mainContent.style.display = 'block'; 
    tableSection.style.display = 'block'; 
    logoutButton.style.display = 'inline-block';
}

function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    showLogin("ออกจากระบบแล้ว");
}

// ----------------------------------------------------
// 2. Logic การล็อกอินและการดึงข้อมูล (Secure Fetch)
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem(AUTH_KEY);
    if (token) {
        showLoading();
        loadData(token);
    } else {
        showLogin();
    }
    logoutButton.addEventListener('click', logout);
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    
    loginButton.disabled = true;
    loginButton.textContent = 'กำลังตรวจสอบ...';
    loginError.style.display = 'none';
    
    try {
        const res = await fetch(LOGIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const data = await res.json();
        
        if (res.ok && data.token) {
            sessionStorage.setItem(AUTH_KEY, data.token);
            showLoading();
            loadData(data.token);
        } else {
            showLogin(data.error || "รหัสผ่านไม่ถูกต้อง");
        }
    } catch (err) {
        showLogin("ไม่สามารถเชื่อมต่อกับ Server ได้");
    }
});

async function fetchCaseData(token) {
    const res = await fetch(API_URL, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json',
        }
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Unauthorized");
    }
    
    if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
    }

    return res.json();
}

async function loadData(token) {
    try {
        const data = await fetchCaseData(token);
        processAndRenderDashboard(data.values); 
        showDashboard(); 
    } catch (error) {
        sessionStorage.removeItem(AUTH_KEY);
        if (error.message === "Unauthorized") {
            showLogin("เซสชันหมดอายุหรือรหัสผ่านไม่ถูกต้อง");
        } else {
            showLogin(`เกิดข้อผิดพลาด: ${error.message}`);
        }
    }
}

// ----------------------------------------------------
// 3. Logic Dashboard (Anti-XSS Rendering)
// ----------------------------------------------------

function arrayToObjects(data) {
    if (!data || data.length < 2) return [];
    const headers = data[0].map(h => String(h || '').trim());
    const cases = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.filter(cell => String(cell || '').trim() !== '').length === 0) continue; 
        const item = {};
        headers.forEach((header, j) => { 
            item[header] = String(row[j] || '').trim(); 
        });
        cases.push(item);
    }
    return cases;
}

/** 
 * ป้องกัน XSS: ใช้ textContent แทน insertAdjacentHTML 
 * เพื่อให้แน่ใจว่าข้อมูลจาก Google Sheets จะไม่ถูกประมวลผลเป็น HTML
 */
function renderCasesTable(cases) {
    casesTableBody.innerHTML = ''; 
    if (cases.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.style.textAlign = 'center';
        td.textContent = 'ไม่พบข้อมูลคดีที่ตรงกับคำค้นหา';
        tr.appendChild(td);
        casesTableBody.appendChild(tr);
        return;
    }

    const headers = ["เลขคดีดำ", "ปีคดีดำ", "ผู้ฟ้องคดี", "คำพิพากษา", "ข้อกฎหมาย", "ตุลาการ", "สถานะคดี"];

    cases.forEach(c => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.setAttribute('data-label', header);
            td.textContent = c[header] || "-"; // ปลอดภัย 100% จาก XSS
            tr.appendChild(td);
        });
        casesTableBody.appendChild(tr);
    });
}

function filterAndRenderCases() {
    const searchTerm = caseSearchInput.value.trim().toLowerCase();
    let filteredCases = [];
    if (searchTerm.length === 0) {
        filteredCases = allCasesData.slice(-10).reverse();
        tableTitle.innerText = "10 คดีล่าสุดที่อัปเดต";
    } else {
        filteredCases = allCasesData.filter(c =>
            (c["เลขคดีดำ"] && String(c["เลขคดีดำ"]).toLowerCase().includes(searchTerm)) ||
            (c["ปีคดีดำ"] && String(c["ปีคดีดำ"]).toLowerCase().includes(searchTerm))
        );
        tableTitle.innerText = `ผลการค้นหา: "${caseSearchInput.value.trim()}" (${filteredCases.length} คดี)`;
    }
    renderCasesTable(filteredCases);
}

caseSearchInput.addEventListener('input', filterAndRenderCases);

function processAndRenderDashboard(values) {
    if (!values) return;
    const cases = arrayToObjects(values);
    allCasesData = cases; 

    const stats = {
        total: cases.length,
        first: cases.filter(c => c["สถานะคดี"].includes("ชั้นต้น")).length,
        supreme: cases.filter(c => c["สถานะคดี"].includes("สูงสุด")).length,
        inExec: cases.filter(c => c["สถานะคดี"].includes("ขั้นตอนบังคับคดี") || c["สถานะคดี"].includes("ระหว่างบังคับคดี")).length,
        execComp: cases.filter(c => c["สถานะคดี"].includes("บังคับคดีเสร็จสิ้น")).length,
        final: cases.filter(c => c["สถานะคดี"].includes("ถึงที่สุด")).length
    };

    document.getElementById("totalCases").innerText = stats.total.toLocaleString('th-TH');
    document.getElementById("finalCases").innerText = stats.final.toLocaleString('th-TH');
    document.getElementById("firstCourtCases").innerText = stats.first.toLocaleString('th-TH');
    document.getElementById("supremeCourtCases").innerText = stats.supreme.toLocaleString('th-TH');
    document.getElementById("executionCompleteCases").innerText = stats.execComp.toLocaleString('th-TH');
    document.getElementById("inExecutionCases").innerText = stats.inExec.toLocaleString('th-TH');

    renderChart(stats);
    filterAndRenderCases(); 
}

function renderChart(stats) {
    const ctx = document.getElementById("caseStatusChart");
    if (chartInstance) { chartInstance.destroy(); }

    chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["ถึงที่สุด", "ชั้นต้น", "สูงสุด", "ระหว่างบังคับคดี", "บังคับคดีเสร็จ"],
            datasets: [{
                data: [stats.final, stats.first, stats.supreme, stats.inExec, stats.execComp],
                backgroundColor: ["#4CAF50", "#2196F3", "#FFC107", "#FF8C00", "#008080"],
                borderWidth: 1
            }]
        },
        options: { 
            indexAxis: 'y',
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    color: '#333',
                    font: { weight: 'bold', family: "Sarabun" }
                }
            },
            scales: {
                x: { beginAtZero: true },
                y: { ticks: { font: { family: "Sarabun" } } }
            }
        }
    });
}
