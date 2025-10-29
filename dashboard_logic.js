// เก็บ instance ของ Chart.js
let chartInstance = null; 

// --- CONFIGURATION ---
const API_URL = 'https://wewin-case-api.onrender.com/api/casestatus';
const AUTH_KEY = 'Wewin_Auth_Key'; 

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
        
let allCasesData = []; // เก็บข้อมูลคดีทั้งหมดที่ดึงมา

// ----------------------------------------------------
// 1. Logic การจัดการ UI State (Login/Loading/Data)
// ----------------------------------------------------

/** แสดงหน้า Login และซ่อน Dashboard */
function showLogin(message = '') {
    dataDisplayContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    passwordInput.value = '';
    loginButton.disabled = false;
    loginButton.textContent = 'เข้าสู่ระบบ';
    loadingMessage.style.display = 'none';
    
    if (message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    } else {
        loginError.style.display = 'none';
    }
}

/** แสดงหน้า Loading และซ่อนส่วนอื่นๆ */
function showLoading(message = 'กำลังโหลดข้อมูล...') {
    loginContainer.style.display = 'none';
    dataDisplayContainer.style.display = 'block';
    loadingMessage.textContent = message;
    loadingMessage.style.display = 'block';
    mainDashboard.style.display = 'none';
    mainContent.style.display = 'none';
    tableSection.style.display = 'none'; 
}

/** แสดง Dashboard หลัก */
function showDashboard() {
    loadingMessage.style.display = 'none';
    mainDashboard.style.display = 'grid'; 
    mainContent.style.display = 'block'; 
    tableSection.style.display = 'block'; 
}

/** ล้าง Session และกลับไปหน้า Login */
function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    showLogin("ออกจากระบบแล้ว กรุณาเข้าสู่ระบบอีกครั้ง");
}

// ----------------------------------------------------
// 2. Logic การล็อกอินและการดึงข้อมูล (Secure Fetch)
// ----------------------------------------------------

// ตรวจสอบสถานะการล็อกอินเมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', () => {
    const storedPassword = sessionStorage.getItem(AUTH_KEY);
    if (storedPassword) {
        showLoading();
        loadData(storedPassword);
    } else {
        showLogin();
    }
});

// ดักจับการ Submit Form
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    
    loginButton.disabled = true;
    loginButton.textContent = 'กำลังตรวจสอบ...';
    loginError.style.display = 'none';
    
    showLoading(); 
    loadData(password, true); 
});

/** ดึงข้อมูลจาก API */
async function fetchCaseData(password) {
    const res = await fetch(API_URL, {
        method: 'GET',
        headers: {
            // ส่งรหัสผ่านผ่าน Header เพื่อความปลอดภัย
            'Authorization': `Bearer ${password}`, 
            'Content-Type': 'application/json',
        }
    });

    if (res.status === 401) {
        throw new Error("Unauthorized");
    }
    
    if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }

    return res.json();
}

/** Logic การ Retry เพื่อจัดการปัญหา Server Cold Start */
async function loadData(password, isLoginAttempt = false) {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        attempt++;
        // Exponential backoff delay: 0s (initial), 2s, 4s
        const delay = attempt === 1 ? 0 : Math.pow(2, attempt) * 500; 

        try {
            if (attempt > 1) {
                 showLoading(`กำลังพยายามเชื่อมต่อใหม่... (ครั้งที่ ${attempt}/${MAX_RETRIES})`);
                 await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const data = await fetchCaseData(password);

            if (isLoginAttempt) {
                // ถ้าเป็นการล็อกอินครั้งแรกและสำเร็จ ให้บันทึกรหัสผ่านไว้
                sessionStorage.setItem(AUTH_KEY, password);
            }

            // Success: Process data and show dashboard
            setTimeout(() => {
                processAndRenderDashboard(data.values); 
                showDashboard(); 
            }, 50);

            return; 
            
        } catch (error) {
            if (error.message === "Unauthorized") {
                sessionStorage.removeItem(AUTH_KEY);
                showLogin("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่");
                return;
            }
            
            if (error.message.startsWith("API Error")) {
                sessionStorage.removeItem(AUTH_KEY);
                showLogin(`เกิดข้อผิดพลาดในการดึงข้อมูล: ${error.message}.`);
                return;
            }
            
            console.warn(`Fetch attempt ${attempt} failed. Retrying...`, error);

            if (attempt === MAX_RETRIES) {
                sessionStorage.removeItem(AUTH_KEY);
                showLogin(`ไม่สามารถเชื่อมต่อกับ Server ได้ (พยายาม ${MAX_RETRIES} ครั้ง)`);
                return;
            }
        }
    }
}

// ----------------------------------------------------
// 3. Logic Dashboard 
// ----------------------------------------------------

/** แปลงข้อมูลจาก Array of Arrays เป็น Array of Objects */
function arrayToObjects(data) {
    if (!data || data.length < 2) return [];
    
    // สร้าง headers จากแถวแรก และ trim space ออก (สำคัญมากสำหรับการเทียบ key)
    const headers = data[0].map(h => String(h || '').trim());
    console.log("DEBUG: Actual API Headers used as keys:", headers); 
    
    const cases = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.filter(cell => String(cell || '').trim() !== '').length === 0) continue; 
        
        const item = {};
        headers.forEach((header, j) => { 
            // ใช้วิธี map โดยอิงตาม header name
            item[header] = String(row[j] || '').trim(); 
        });
        cases.push(item);
    }
    return cases;
}

/** สร้างแถวตาราง HTML จากข้อมูลคดีที่ถูกกรองแล้ว */
function renderCasesTable(cases) {
    casesTableBody.innerHTML = ''; 
    if (cases.length === 0) {
        // Colspan = 7 เนื่องจากมี 7 คอลัมน์ 
        const noResultsRow = `<tr class="no-results"><td colspan="7" style="text-align: center;">ไม่พบข้อมูลคดีที่ตรงกับคำค้นหา</td></tr>`;
        casesTableBody.insertAdjacentHTML("beforeend", noResultsRow);
        return;
    }

    // กำหนดหัวตารางตามลำดับที่แสดงใน HTML
    const headers = [
        "เลขคดีดำ", "ปีคดีดำ", "ผู้ฟ้องคดี", "ผลของคำพิพากษา", 
        "ข้อกฎหมายที่ศาลใช้", "ตุลาการเจ้าของสำนวน", "สถานะคดี"
    ];

    cases.forEach(c => {
        // ใช้ data-label attribute เพื่อให้ CSS สามารถดึงไปแสดงผลเป็นหัวตารางใน Card View ได้บนมือถือ
        const row = `<tr>
            <td data-label="${headers[0]}">${c["เลขคดีดำ"] || "-"}</td>
            <td data-label="${headers[1]}">${c["ปีคดีดำ"] || "-"}</td>
            <td data-label="${headers[2]}">${c["ผู้ฟ้องคดี"] || "-"}</td>
            <td data-label="${headers[3]}">${c["ผลของคำพิพากษา"] || "-"}</td>
            <td data-label="${headers[4]}">${c["ข้อกฎหมายที่ศาลใช้"] || "-"}</td> 
            <td data-label="${headers[5]}">${c["ตุลาการเจ้าของสำนวน"] || "-"}</td> 
            <td data-label="${headers[6]}">${c["สถานะคดี"] || "-"}</td>
        </tr>`;
        casesTableBody.insertAdjacentHTML("beforeend", row);
    });
}

/** กรองและแสดงผลคดีตามคำค้นหา */
function filterAndRenderCases() {
    const searchTerm = caseSearchInput.value.trim().toLowerCase();
    let filteredCases = [];
    
    if (searchTerm.length === 0) {
        // แสดง 10 คดีล่าสุด
        filteredCases = allCasesData.slice(-10).reverse();
        tableTitle.innerText = "10 คดีล่าสุดที่อัปเดต";
    } else {
        filteredCases = allCasesData.filter(c =>
            // กรองตาม เลขคดีดำ หรือ ปีคดีดำ 
            (c["เลขคดีดำ"] && String(c["เลขคดีดำ"]).toLowerCase().includes(searchTerm)) ||
            (c["ปีคดีดำ"] && String(c["ปีคดีดำ"]).toLowerCase().includes(searchTerm))
        );
        tableTitle.innerText = `ผลการค้นหาคดี: "${caseSearchInput.value.trim()}" (${filteredCases.length} คดี)`;
    }

    renderCasesTable(filteredCases);
}

// ผูก Event Listener
caseSearchInput.addEventListener('input', filterAndRenderCases);


/** ประมวลผลและแสดงผล Dashboard ทั้งหมด */
function processAndRenderDashboard(values) {
    if (!values) return;

    const cases = arrayToObjects(values);
    allCasesData = cases; 

    // 1. คำนวณสถานะคดี
    const totalCases = cases.length;
    const firstCourtCases = cases.filter(c => c["สถานะคดี"].includes("ชั้นต้น")).length;
    const supremeCourtCases = cases.filter(c => c["สถานะคดี"].includes("สูงสุด")).length;
    const inExecutionCases = cases.filter(c => c["สถานะคดี"].includes("อยู่ในขั้นตอนบังคับคดี") || c["สถานะคดี"].includes("ระหว่างบังคับคดี")).length;
    const executionCompleteCases = cases.filter(c => c["สถานะคดี"].includes("บังคับคดีเสร็จสิ้น")).length;
    const finalCases = cases.filter(c => c["สถานะคดี"].includes("ถึงที่สุด")).length; 

    // 2. อัปเดตตัวเลขในการ์ด
    document.getElementById("totalCases").innerText = totalCases.toLocaleString('th-TH');
    document.getElementById("finalCases").innerText = finalCases.toLocaleString('th-TH');
    document.getElementById("firstCourtCases").innerText = firstCourtCases.toLocaleString('th-TH');
    document.getElementById("supremeCourtCases").innerText = supremeCourtCases.toLocaleString('th-TH');
    document.getElementById("executionCompleteCases").innerText = executionCompleteCases.toLocaleString('th-TH');
    document.getElementById("inExecutionCases").innerText = inExecutionCases.toLocaleString('th-TH');

    // 3. สร้าง Bar Chart (แผนภูมิแท่งแนวนอน)
    const ctx = document.getElementById("caseStatusChart");
    if (chartInstance) { chartInstance.destroy(); } // ทำลาย instance เก่าก่อน

    const chartData = {
        labels: ["คำพิพากษาถึงที่สุด", "อยู่ระหว่างพิจารณาชั้นต้น", "อยู่ระหว่างพิจารณาสูงสุด", "อยู่ในขั้นตอนบังคับคดี", "บังคับคดีเสร็จสิ้น"],
        datasets: [{
            label: "จำนวนคดี",
            data: [finalCases, firstCourtCases, supremeCourtCases, inExecutionCases, executionCompleteCases],
            backgroundColor: ["#4CAF50", "#2196F3", "#FFC107", "#FF8C00", "#008080"],
            borderColor: "white",
            borderWidth: 1
        }]
    };
    
    chartInstance = new Chart(ctx, {
        // เปลี่ยนเป็น Bar Chart
        type: "bar",
        data: chartData,
        options: { 
            indexAxis: 'y', // กำหนดให้เป็นแนวนอน
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                datalabels: {
                    formatter: (value) => {
                        return new Intl.NumberFormat('th-TH').format(value); // แสดงเฉพาะจำนวนคดี
                    },
                    anchor: 'end', // ตำแหน่งข้อความที่ปลายแท่ง
                    align: 'right', // จัดชิดขวา
                    color: '#333', // สีตัวอักษรเป็นสีเข้ม
                    font: {
                        weight: 'bold',
                        size: 14,
                        family: "Sarabun"
                    }
                },
                legend: { 
                    display: false, // ปิด Legend เนื่องจากฉลากอยู่บนแกน Y อยู่แล้ว
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.x !== null) {
                                label += new Intl.NumberFormat('th-TH').format(context.parsed.x) + ' คดี';
                            }
                            return label;
                        }
                    },
                    titleFont: { family: "Sarabun", size: 14 },
                    bodyFont: { family: "Sarabun", size: 12 }
                }
            },
            // ปรับแกน X และ Y
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'จำนวนคดี',
                        font: { family: "Sarabun", weight: 'bold', size: 14 }
                    },
                    ticks: {
                        callback: function(value) {
                             return new Intl.NumberFormat('th-TH').format(value);
                        },
                        font: { family: "Sarabun" }
                    }
                },
                y: {
                    font: { family: "Sarabun" }
                }
            }
        }
    });

    // 4. แสดงผลตารางเริ่มต้น
    filterAndRenderCases(); 
}
