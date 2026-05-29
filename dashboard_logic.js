// dashboard_logic.js — v2.0

// --- CONFIGURATION ---
const API_BASE_URL = 'https://wewin-case-api.onrender.com';
const API_URL     = `${API_BASE_URL}/api/casestatus`;
const LOGIN_URL   = `${API_BASE_URL}/api/login`;
const AUTH_KEY    = 'Wewin_JWT_Token';
const PAGE_SIZE   = 25;

// --- STATE ---
let allCasesData  = [];
let displayData   = []; // หลังจาก filter + search + sort
let currentFilter = 'all';
let sortColumn    = null;
let sortDir       = 'asc';
let currentPage   = 1;
let chartBar      = null;
let chartDonut    = null;

// --- DOM ELEMENTS ---
const loginContainer      = document.getElementById('login-container');
const loginForm           = document.getElementById('login-form');
const passwordInput       = document.getElementById('password-input');
const loginButton         = document.getElementById('login-button');
const loginError          = document.getElementById('login-error-message');
const dataDisplayContainer= document.getElementById('data-display-container');
const loadingMessage      = document.getElementById('loading-message');
const mainDashboard       = document.getElementById('mainDashboard');
const mainContent         = document.getElementById('mainContent');
const filterBar           = document.getElementById('filterBar');
const tableSection        = document.getElementById('tableSection');
const casesTableBody      = document.querySelector('#casesTable tbody');
const tableTitle          = document.getElementById('tableTitle');
const logoutButton        = document.getElementById('logout-button');
const exportButton        = document.getElementById('export-button');
const lastUpdatedBadge    = document.getElementById('last-updated');
const paginationEl        = document.getElementById('pagination');
const caseSearchInput     = document.getElementById('caseSearch');

// --- FILTER DEFINITIONS ---
const STATUS_FILTERS = {
    'all':       () => true,
    'ชั้นต้น':   c => c["สถานะคดี"].includes("ชั้นต้น"),
    'ถึงที่สุด': c => c["สถานะคดี"].includes("ถึงที่สุด"),
    'สูงสุด':    c => c["สถานะคดี"].includes("สูงสุด"),
    'บังคับคดี': c => c["สถานะคดี"].includes("ขั้นตอนบังคับคดี") || c["สถานะคดี"].includes("ระหว่างบังคับคดี"),
    'บังคับเสร็จ': c => c["สถานะคดี"].includes("บังคับคดีเสร็จสิ้น"),
};

const HEADERS = ["เลขคดีดำ", "ปีคดีดำ", "ผู้ฟ้องคดี", "คำพิพากษา", "ข้อกฎหมาย", "ตุลาการ", "สถานะคดี"];

function getStatusPillClass(status) {
    if (!status) return 'pill-default';
    if (status.includes("บังคับคดีเสร็จสิ้น")) return 'pill-complete';
    if (status.includes("ถึงที่สุด"))           return 'pill-final';
    if (status.includes("ชั้นต้น"))             return 'pill-first';
    if (status.includes("สูงสุด"))              return 'pill-supreme';
    if (status.includes("บังคับ"))              return 'pill-exec';
    return 'pill-default';
}

// ============================================================
// 1. UI STATE
// ============================================================

function showLogin(message = '') {
    dataDisplayContainer.style.display = 'none';
    loginContainer.style.display = 'flex';
    passwordInput.value = '';
    loginButton.disabled = false;
    loginButton.textContent = 'เข้าสู่ระบบ';
    loadingMessage.style.display = 'none';
    logoutButton.style.display = 'none';
    exportButton.style.display = 'none';
    lastUpdatedBadge.style.display = 'none';
    loginError.style.display = message ? 'block' : 'none';
    if (message) loginError.textContent = message;
}

function showLoading(msg = 'กำลังโหลดข้อมูล...') {
    loginContainer.style.display = 'none';
    dataDisplayContainer.style.display = 'block';
    loadingMessage.textContent = msg;
    loadingMessage.style.display = 'block';
    mainDashboard.style.display = 'none';
    mainContent.style.display = 'none';
    filterBar.style.display = 'none';
    tableSection.style.display = 'none';
}

function showDashboard() {
    loadingMessage.style.display = 'none';
    mainDashboard.style.display = 'grid';
    mainContent.style.display = 'block';
    filterBar.style.display = 'flex';
    tableSection.style.display = 'block';
    logoutButton.style.display = 'inline-block';
    exportButton.style.display = 'inline-block';
    lastUpdatedBadge.style.display = 'inline-block';

    // แสดงวันที่โหลดข้อมูล
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    lastUpdatedBadge.textContent = `อัปเดต: ${dateStr} ${timeStr} น.`;
}

function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    showLogin("ออกจากระบบแล้ว");
}

// ============================================================
// 2. AUTH & FETCH
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem(AUTH_KEY);
    if (token) { showLoading(); loadData(token); }
    else        { showLogin(); }

    logoutButton.addEventListener('click', logout);
    exportButton.addEventListener('click', exportCSV);
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value;
    loginButton.disabled = true;
    loginButton.textContent = 'กำลังตรวจสอบ...';
    loginError.style.display = 'none';
    try {
        const res  = await fetch(LOGIN_URL, {
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
    } catch {
        showLogin("ไม่สามารถเชื่อมต่อกับ Server ได้");
    }
});

async function fetchCaseData(token) {
    const res = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (res.status === 401 || res.status === 403) throw new Error("Unauthorized");
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
}

async function loadData(token) {
    try {
        const data = await fetchCaseData(token);
        processAndRenderDashboard(data.values);
        showDashboard();
    } catch (error) {
        sessionStorage.removeItem(AUTH_KEY);
        showLogin(error.message === "Unauthorized"
            ? "เซสชันหมดอายุหรือรหัสผ่านไม่ถูกต้อง"
            : `เกิดข้อผิดพลาด: ${error.message}`);
    }
}

// ============================================================
// 3. DATA PROCESSING
// ============================================================

function arrayToObjects(data) {
    if (!data || data.length < 2) return [];
    const headers = data[0].map(h => String(h || '').trim());
    const cases = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.filter(cell => String(cell || '').trim() !== '').length === 0) continue;
        const item = {};
        headers.forEach((h, j) => { item[h] = String(row[j] || '').trim(); });
        cases.push(item);
    }
    return cases;
}

function pct(n, total) {
    if (!total) return '';
    return `${((n / total) * 100).toFixed(1)}%`;
}

function processAndRenderDashboard(values) {
    if (!values || !Array.isArray(values) || values.length === 0) {
        loadingMessage.textContent = 'ไม่พบข้อมูลในแหล่งข้อมูล';
        loadingMessage.style.display = 'block';
        return;
    }

    allCasesData = arrayToObjects(values);

    const t = allCasesData.length;
    const stats = {
        total:    t,
        first:    allCasesData.filter(STATUS_FILTERS['ชั้นต้น']).length,
        final:    allCasesData.filter(STATUS_FILTERS['ถึงที่สุด']).length,
        supreme:  allCasesData.filter(STATUS_FILTERS['สูงสุด']).length,
        inExec:   allCasesData.filter(STATUS_FILTERS['บังคับคดี']).length,
        execComp: allCasesData.filter(STATUS_FILTERS['บังคับเสร็จ']).length,
    };

    // Stat cards
    document.getElementById("totalCases").textContent            = stats.total.toLocaleString('th-TH');
    document.getElementById("firstCourtCases").textContent       = stats.first.toLocaleString('th-TH');
    document.getElementById("finalCases").textContent            = stats.final.toLocaleString('th-TH');
    document.getElementById("supremeCourtCases").textContent     = stats.supreme.toLocaleString('th-TH');
    document.getElementById("inExecutionCases").textContent      = stats.inExec.toLocaleString('th-TH');
    document.getElementById("executionCompleteCases").textContent= stats.execComp.toLocaleString('th-TH');

    // % sub-labels
    document.getElementById("totalPct").textContent    = 'คดีทั้งหมด';
    document.getElementById("firstPct").textContent    = pct(stats.first,    t);
    document.getElementById("finalPct").textContent    = pct(stats.final,    t);
    document.getElementById("supremePct").textContent  = pct(stats.supreme,  t);
    document.getElementById("inExecPct").textContent   = pct(stats.inExec,   t);
    document.getElementById("execCompPct").textContent = pct(stats.execComp, t);

    renderBarChart(stats);
    renderDonutChart(stats);
    applyAndRender();
}

// ============================================================
// 4. FILTER + SEARCH + SORT + PAGINATE
// ============================================================

function applyAndRender() {
    const search = caseSearchInput.value.trim().toLowerCase();

    // 1. Status filter
    let result = allCasesData.filter(STATUS_FILTERS[currentFilter] || (() => true));

    // 2. Search (all columns)
    if (search) {
        result = result.filter(c =>
            HEADERS.some(h => (c[h] || '').toLowerCase().includes(search))
        );
    }

    // 3. Sort
    if (sortColumn) {
        result = [...result].sort((a, b) => {
            const va = (a[sortColumn] || '').toLowerCase();
            const vb = (b[sortColumn] || '').toLowerCase();
            const n  = va.localeCompare(vb, 'th');
            return sortDir === 'asc' ? n : -n;
        });
    }

    displayData  = result;
    currentPage  = 1;
    renderTable();
    renderPagination();
    updateTableTitle(result.length, search);
}

function updateTableTitle(count, search) {
    if (currentFilter === 'all' && !search) {
        tableTitle.textContent = `คดีทั้งหมด (${count.toLocaleString('th-TH')} คดี)`;
    } else if (search) {
        tableTitle.textContent = `ผลการค้นหา "${caseSearchInput.value.trim()}" — ${count.toLocaleString('th-TH')} คดี`;
    } else {
        tableTitle.textContent = `สถานะ: ${currentFilter} — ${count.toLocaleString('th-TH')} คดี`;
    }
}

function renderTable() {
    casesTableBody.innerHTML = '';
    const start  = (currentPage - 1) * PAGE_SIZE;
    const page   = displayData.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.style.textAlign = 'center';
        td.style.padding   = '32px';
        td.style.color     = 'var(--label-3)';
        td.textContent = 'ไม่พบข้อมูลคดีที่ตรงกับเงื่อนไข';
        tr.appendChild(td);
        casesTableBody.appendChild(tr);
        return;
    }

    page.forEach(c => {
        const tr = document.createElement('tr');
        HEADERS.forEach((h, i) => {
            const td = document.createElement('td');
            td.setAttribute('data-label', h);
            if (i === HEADERS.length - 1) {
                // สถานะคดี → status pill
                const span = document.createElement('span');
                span.className = `status-pill ${getStatusPillClass(c[h])}`;
                span.textContent = c[h] || '-';
                td.appendChild(span);
            } else {
                td.textContent = c[h] || '-';
            }
            tr.appendChild(td);
        });
        casesTableBody.appendChild(tr);
    });
}

function renderPagination() {
    paginationEl.innerHTML = '';
    const total = displayData.length;
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) return;

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end   = Math.min(currentPage * PAGE_SIZE, total);

    const info = document.createElement('span');
    info.className   = 'page-info';
    info.textContent = `แสดง ${start.toLocaleString('th-TH')}–${end.toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')} คดี`;
    paginationEl.appendChild(info);

    const btns = document.createElement('div');
    btns.className = 'page-btns';

    const makeBtn = (label, page, disabled = false) => {
        const b = document.createElement('button');
        b.className  = 'page-btn' + (page === currentPage ? ' active' : '');
        b.textContent = label;
        b.disabled   = disabled;
        if (!disabled && page !== currentPage) {
            b.addEventListener('click', () => { currentPage = page; renderTable(); renderPagination(); });
        }
        return b;
    };

    btns.appendChild(makeBtn('‹', currentPage - 1, currentPage === 1));

    // Page numbers with ellipsis
    const pageNums = [];
    if (pages <= 7) {
        for (let i = 1; i <= pages; i++) pageNums.push(i);
    } else {
        pageNums.push(1);
        if (currentPage > 3) pageNums.push('…');
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(pages - 1, currentPage + 1); i++) pageNums.push(i);
        if (currentPage < pages - 2) pageNums.push('…');
        pageNums.push(pages);
    }

    pageNums.forEach(p => {
        if (p === '…') {
            const s = document.createElement('span');
            s.className = 'page-btn';
            s.textContent = '…';
            s.style.cursor = 'default';
            btns.appendChild(s);
        } else {
            btns.appendChild(makeBtn(p, p));
        }
    });

    btns.appendChild(makeBtn('›', currentPage + 1, currentPage === pages));
    paginationEl.appendChild(btns);
}

// ============================================================
// 5. EVENT LISTENERS
// ============================================================

// Search
caseSearchInput.addEventListener('input', () => { currentPage = 1; applyAndRender(); });

// Filter chips
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.chip[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chip[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            currentPage   = 1;
            applyAndRender();
        });
    });

    // Sortable column headers
    document.querySelectorAll('#casesTable th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (sortColumn === col) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = col;
                sortDir    = 'asc';
            }
            // Update header classes
            document.querySelectorAll('#casesTable th[data-col]').forEach(t => {
                t.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
            currentPage = 1;
            applyAndRender();
        });
    });
});

// ============================================================
// 6. EXPORT CSV
// ============================================================

function exportCSV() {
    if (!displayData.length) return;
    const rows  = [HEADERS.join(',')];
    displayData.forEach(c => {
        const row = HEADERS.map(h => `"${(c[h] || '').replace(/"/g, '""')}"`);
        rows.push(row.join(','));
    });
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `คดีเราชนะ_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// 7. CHARTS
// ============================================================

const CHART_COLORS = ['#34c759', '#ff3b30', '#0071e3', '#af52de', '#5ac8fa'];
const CHART_LABELS = ['ชั้นต้น', 'ถึงที่สุด', 'สูงสุด', 'บังคับคดี', 'บังคับเสร็จ'];

function getChartData(stats) {
    return [stats.first, stats.final, stats.supreme, stats.inExec, stats.execComp];
}

function renderBarChart(stats) {
    const ctx = document.getElementById("caseStatusChart");
    if (chartBar) chartBar.destroy();

    chartBar = new Chart(ctx, {
        type: "bar",
        data: {
            labels: CHART_LABELS,
            datasets: [{
                data: getChartData(stats),
                backgroundColor: CHART_COLORS,
                borderRadius: 6,
                borderWidth: 0,
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
                    color: '#3a3a3c',
                    font: { weight: '700', family: "Sarabun", size: 12 }
                }
            },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } },
                y: { ticks: { font: { family: "Sarabun", size: 13 } }, grid: { display: false } }
            }
        }
    });
}

function renderDonutChart(stats) {
    const ctx = document.getElementById("caseDonutChart");
    if (chartDonut) chartDonut.destroy();

    const data = getChartData(stats);

    chartDonut = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: CHART_LABELS,
            datasets: [{
                data,
                backgroundColor: CHART_COLORS,
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: "Sarabun", size: 12 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 8,
                    }
                },
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const val   = ctx.parsed;
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const p     = total ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${val.toLocaleString('th-TH')} คดี (${p}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            // Center text plugin
            id: 'centerText',
            beforeDraw(chart) {
                const { width, height, ctx } = chart;
                ctx.save();
                const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                ctx.font = `bold 22px Sarabun, sans-serif`;
                ctx.fillStyle = '#1c1c1e';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const cx = width / 2;
                const cy = (height - (chart.legend.height || 0)) / 2;
                ctx.fillText(total.toLocaleString('th-TH'), cx, cy - 8);
                ctx.font = `13px Sarabun, sans-serif`;
                ctx.fillStyle = '#6e6e73';
                ctx.fillText('คดีทั้งหมด', cx, cy + 14);
                ctx.restore();
            }
        }]
    });
}
