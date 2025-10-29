import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, limit, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Variables (MUST be set by the canvas environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Firebase Initialization and Auth ---
let db, auth, userId = null;
let isAuthReady = false;

// Case: Use a map to ensure data-label consistency with desktop headers
const TABLE_HEADERS = [
    "เลขคดีดำ",
    "ปีคดีดำ", 
    "ผู้ฟ้องคดี",
    "คำพิพากษา",
    "ข้อกฎหมาย",
    "ตุลาการ",
    "สถานะคดี"
];

// --- Mock Data Structure (replace with actual Firestore data structure) ---
const MOCK_CASES = [
    { 
        caseNo: "ว123", caseYear: "65", plaintiff: "นายสมชาย ใจดี", 
        judgment: "ยกฟ้องตามมาตรา 9", law: "ม.10(2) พ.ร.บ. จัดตั้งศาลปกครองฯ", 
        judge: "สมหญิง รักไทย", status: "ถึงที่สุด" 
    },
    { 
        caseNo: "อ456", caseYear: "66", plaintiff: "บริษัท รุ่งเรือง จำกัด", 
        judgment: "เพิกถอนคำสั่ง คสช. ที่ 15/2560", law: "ม.3 พ.ร.บ. ควบคุมการใช้รถยนต์ฯ", 
        judge: "สมศักดิ์ ขยัน", status: "พิจารณาชั้นต้น" 
    },
    { 
        caseNo: "ว789", caseYear: "66", plaintiff: "นางสาวอรทัย สุขเกษม", 
        judgment: "ให้จ่ายค่าสินไหมทดแทน 50,000 บาท", law: "ม.15(1) พ.ร.บ. ความรับผิดทางละเมิดฯ", 
        judge: "สมหญิง รักไทย", status: "บังคับคดี" 
    },
    { 
        caseNo: "ว101", caseYear: "67", plaintiff: "นายใจเด็ด จริงใจ", 
        judgment: "รอฟังผลจากศาลปกครองสูงสุด", law: "ม.20 พ.ร.บ. วิธีปฏิบัติราชการทางปกครองฯ", 
        judge: "สมศักดิ์ ขยัน", status: "พิจารณาสูงสุด" 
    },
];

// -----------------------------------------------------------------
// 1. DATA RENDERING FUNCTIONS
// -----------------------------------------------------------------

/**
 * คำนวณจำนวนคดีตามสถานะและแสดงผลใน Dashboard Cards
 * @param {Array<Object>} cases - ข้อมูลคดี
 */
function updateDashboardCards(cases) {
    const counts = cases.reduce((acc, c) => {
        if (c.status) {
            let key;
            if (c.status.includes('ชั้นต้น')) key = 'firstCourtCases';
            else if (c.status.includes('ถึงที่สุด')) key = 'finalCases';
            else if (c.status.includes('สูงสุด')) key = 'supremeCourtCases';
            else if (c.status.includes('บังคับคดีเสร็จสิ้น')) key = 'executionCompleteCases';
            else if (c.status.includes('บังคับคดี')) key = 'inExecutionCases';
            
            if (key) acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
    }, {});
    
    document.getElementById('totalCases').textContent = cases.length.toString();
    document.getElementById('firstCourtCases').textContent = (counts.firstCourtCases || 0).toString();
    document.getElementById('finalCases').textContent = (counts.finalCases || 0).toString();
    document.getElementById('supremeCourtCases').textContent = (counts.supremeCourtCases || 0).toString();
    document.getElementById('inExecutionCases').textContent = (counts.inExecutionCases || 0).toString();
    document.getElementById('executionCompleteCases').textContent = (counts.executionCompleteCases || 0).toString();
}

/**
 * สร้างและแสดงตารางข้อมูลคดี พร้อมกำหนด data-label ที่ถูกต้องสำหรับ Mobile View
 * @param {Array<Object>} cases - ข้อมูลคดีที่จะแสดง
 */
function renderCasesTable(cases) {
    const tableBody = document.getElementById('casesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = ''; // Clear previous data
    
    cases.forEach(caseItem => {
        const row = document.createElement('tr');
        
        // นี่คือจุดสำคัญ: การกำหนด data-label ให้ตรงกับหัวข้อ TH
        row.innerHTML = `
            <td data-label="${TABLE_HEADERS[0]}">${caseItem.caseNo}</td>
            <td data-label="${TABLE_HEADERS[1]}">${caseItem.caseYear}</td>
            <td data-label="${TABLE_HEADERS[2]}">${caseItem.plaintiff}</td>
            <td data-label="${TABLE_HEADERS[3]}">${caseItem.judgment}</td>
            <td data-label="${TABLE_HEADERS[4]}">${caseItem.law}</td>
            <td data-label="${TABLE_HEADERS[5]}">${caseItem.judge}</td>
            <td data-label="${TABLE_HEADERS[6]}">${caseItem.status}</td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * อัปเดตแผนภูมิสถานะคดี
 * @param {Array<Object>} cases - ข้อมูลคดี
 */
function updateCaseStatusChart(cases) {
    const statusCounts = cases.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(statusCounts);
    const data = Object.values(statusCounts);
    
    const ctx = document.getElementById('caseStatusChart').getContext('2d');

    // ตรวจสอบและทำลาย Chart เก่าก่อนสร้างใหม่
    if (window.caseStatusChartInstance) {
        window.caseStatusChartInstance.destroy();
    }
    
    window.caseStatusChartInstance = new Chart(ctx, {
        type: 'bar', // เปลี่ยนเป็น Bar Chart เพื่อรองรับ Label ยาวๆ ได้ดีขึ้น
        data: {
            labels: labels,
            datasets: [{
                label: 'จำนวนคดี',
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // ทำให้เป็นแนวนอน
            scales: {
                x: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'จำนวนคดีตามสถานะการดำเนินงาน',
                    font: {
                        size: 16,
                        weight: '600'
                    }
                },
                tooltip: {
                    callbacks: {
                        title: (context) => context[0].label,
                        label: (context) => `จำนวน: ${context.formattedValue} คดี`
                    }
                },
                datalabels: {
                    color: '#333',
                    anchor: 'end',
                    align: 'end',
                    formatter: (value) => value > 0 ? value : '',
                    font: {
                        weight: 'bold'
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}


// -----------------------------------------------------------------
// 2. FIREBASE & AUTHENTICATION LOGIC
// -----------------------------------------------------------------

/**
 * จัดการการแสดงผลเมื่อล็อกอินสำเร็จ
 */
function showDashboardContent() {
    // ซ่อนฟอร์มและแสดงแดชบอร์ด
    const loginContainer = document.getElementById('login-container');
    const dataDisplayContainer = document.getElementById('data-display-container');
    const loadingMessage = document.getElementById('loading-message');
    
    if (loginContainer) loginContainer.style.display = 'none';
    if (dataDisplayContainer) dataDisplayContainer.style.display = 'block';
    if (loadingMessage) loadingMessage.style.display = 'block';

    // Mock data fetching to simulate real data loading
    setTimeout(() => {
        if (loadingMessage) loadingMessage.style.display = 'none';
        
        // แสดงส่วนหลักของแดชบอร์ด
        const mainDashboard = document.getElementById('mainDashboard');
        const mainContent = document.getElementById('mainContent');
        const tableSection = document.getElementById('tableSection');

        if (mainDashboard) mainDashboard.style.display = 'grid';
        if (mainContent) mainContent.style.display = 'block';
        if (tableSection) tableSection.style.display = 'block';
        
        // Render data with correct data-labels
        updateDashboardCards(MOCK_CASES);
        renderCasesTable(MOCK_CASES);
        updateCaseStatusChart(MOCK_CASES);
    }, 1500); // Simulate network delay
}

/**
 * จัดการการแสดงผลเมื่อยังไม่ได้ล็อกอิน
 */
function showLoginForm() {
    const loginContainer = document.getElementById('login-container');
    const dataDisplayContainer = document.getElementById('data-display-container');
    const errorMessageElement = document.getElementById('login-error-message');

    if (loginContainer) loginContainer.style.display = 'block';
    if (dataDisplayContainer) dataDisplayContainer.style.display = 'none';
    if (errorMessageElement) errorMessageElement.style.display = 'none';
}

/**
 * จำลองการล็อกอินด้วยรหัสผ่าน (ควรเปลี่ยนไปใช้ Firebase Authentication จริง)
 * FIX: เปลี่ยนเป็น synchronous เพื่อความน่าเชื่อถือในการจัดการ UI/State
 * @param {string} password - รหัสผ่านที่ผู้ใช้กรอก
 */
function attemptLogin(password) {
    const LOGIN_PASSWORD = "123"; // รหัสผ่านง่ายๆ สำหรับการจำลอง
    const errorMessageElement = document.getElementById('login-error-message');
    const loginButton = document.getElementById('login-button');

    // ปิดปุ่มก่อน
    if (loginButton) loginButton.disabled = true;
    if (errorMessageElement) errorMessageElement.style.display = 'none';

    // *** ตรรกะการตรวจสอบรหัสผ่าน (Synchronous Check) ***
    if (password === LOGIN_PASSWORD) {
        // หากรหัสผ่านถูกต้อง ให้แสดง Dashboard ทันที
        console.log("Password verified. Showing dashboard content.");
        showDashboardContent();
        
    } else {
        // หากรหัสผ่านผิด ให้แสดงข้อผิดพลาดและเปิดปุ่ม
        if (errorMessageElement) {
            errorMessageElement.textContent = 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง';
            errorMessageElement.style.display = 'block';
        }
        console.warn("Login failed: Incorrect password.");
    }
    
    // หากตรวจสอบผิดพลาดหรือตรวจสอบเสร็จแล้ว ให้ปลดปุ่ม (ในกรณีที่ผิดพลาด)
    if (password !== LOGIN_PASSWORD && loginButton) {
         loginButton.disabled = false;
    }
}

/**
 * ลงชื่อออกจากระบบ (Logout)
 */
window.logout = function() {
    // ใช้ Firebase sign out เพื่อจัดการ token/session
    auth.signOut().then(() => {
        // จากนั้นกลับไปหน้า Login Form
        showLoginForm();
    }).catch(error => {
        console.error("Logout Error:", error);
        // Fallback: แสดงฟอร์ม login แม้ sign out จะล้มเหลว (เพื่อความต่อเนื่องของ UI)
        showLoginForm(); 
    });
};

/**
 * Event Listener สำหรับ Login Form
 */
document.getElementById('login-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    // ใช้ ? เพื่อป้องกันข้อผิดพลาดหาก element หายไป
    const password = document.getElementById('password-input')?.value;
    if (password) {
        attemptLogin(password);
    }
});

/**
 * ตรวจสอบสถานะการเข้าสู่ระบบ Firebase (รันในพื้นหลัง)
 * NOTE: ส่วนนี้ควรทำให้ผู้ใช้เข้าถึงข้อมูลได้โดยอัตโนมัติหากมี __initial_auth_token
 */
function setupAuthListener() {
    if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing.");
        // หากไม่มี config ให้แสดงฟอร์ม login (เพื่อใช้ mock password)
        showLoginForm(); 
        return;
    }

    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        // หาก Firebase init ล้มเหลว ให้แสดงฟอร์ม login (เพื่อใช้ mock password)
        showLoginForm(); 
        return;
    }
    
    // ตั้งค่า listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            console.log("Firebase Auth: User signed in (UID:", userId, ")");
            // **NOTE:** เราปิดการเรียก showDashboardContent() ตรงนี้ เพื่อบังคับให้ใช้ Password Mock
            // หากคุณต้องการให้เข้าสู่ระบบอัตโนมัติเมื่อ Firebase พร้อม ให้เปิดบรรทัดนี้:
            // showDashboardContent(); 
        } else {
            userId = null;
            console.log("Firebase Auth: User signed out/anonymous.");
        }
        isAuthReady = true;
    });

    // Initial sign-in attempt (สำคัญสำหรับ Canvas environment)
    if (initialAuthToken) {
        signInWithCustomToken(auth, initialAuthToken).catch(error => {
            console.warn("Custom token sign-in failed. Falling back to anonymous:", error);
            signInAnonymously(auth).catch(e => console.error("Anonymous sign-in failed:", e));
        });
    } else {
        signInAnonymously(auth).catch(e => console.error("Anonymous sign-in failed:", e));
    }
    
    // ในกรณีนี้ เรายังคงแสดงฟอร์ม Login ตั้งแต่แรก เพื่อบังคับให้ผู้ใช้กรอกรหัสผ่าน 123
    showLoginForm();
}

// -----------------------------------------------------------------
// 3. MAIN EXECUTION
// -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', setupAuthListener);

// เพิ่ม Event Listener สำหรับ Search Bar (จำลองการค้นหาใน Mock Data)
document.getElementById('caseSearch')?.addEventListener('input', function(e) {
    const searchTerm = e.target.value.trim().toLowerCase();
    
    if (searchTerm === "") {
        renderCasesTable(MOCK_CASES);
        return;
    }
    
    const filteredCases = MOCK_CASES.filter(caseItem => 
        caseItem.caseNo.toLowerCase().includes(searchTerm)
    );
    
    renderCasesTable(filteredCases);
});
