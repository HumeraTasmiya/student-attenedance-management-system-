/**
 * SmartAttend – script.js
 * =====================================================================
 * Full frontend logic for the Student Attendance Management System.
 * Uses localStorage as the primary datastore (with optional backend).
 * =====================================================================
 */

'use strict';

// =====================================================================
// CONFIG – Backend API base URL (update this if your server is running)
// =====================================================================
const API_BASE = 'http://localhost:5000/api';
let USE_BACKEND = false; // Flips to true if backend responds

// =====================================================================
// DATA LAYER – localStorage helpers
// =====================================================================
const Store = {
  get: (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },
  set: (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  }
};

// In-memory state (synced with localStorage)
let students = Store.get('sa_students');
let attendance = Store.get('sa_attendance');

// =====================================================================
// BOOTSTRAP INSTANCES
// =====================================================================
let studentModal, deleteModal, toast;

// =====================================================================
// CHART.JS INSTANCES
// =====================================================================
let weeklyChart, donutChart, monthlyChart;

// =====================================================================
// INIT
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Init Bootstrap components
  studentModal = new bootstrap.Modal(document.getElementById('studentModal'));
  deleteModal  = new bootstrap.Modal(document.getElementById('deleteModal'));
  toast        = new bootstrap.Toast(document.getElementById('appToast'), { delay: 3000 });

  // Set today's date in attendance picker
  const today = getTodayString();
  document.getElementById('attendanceDate').value = today;
  document.getElementById('currentDate').textContent = formatDateDisplay(today);

  // Sidebar navigation
  setupNavigation();
  setupSidebar();

  // Search listeners
  document.getElementById('studentSearch').addEventListener('input', renderStudentsTable);
  document.getElementById('attendanceSearch').addEventListener('input', renderAttendanceTable);
  document.getElementById('attendanceDate').addEventListener('change', renderAttendanceTable);

  // Delete confirm button
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDeleteStudent);

  // Try to connect backend
  checkBackend();

  // Initial render
  renderAll();
});

// =====================================================================
// NAVIGATION
// =====================================================================
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      navigateTo(section);
      // Close sidebar on mobile
      if (window.innerWidth < 992) closeSidebar();
    });
  });
}

function navigateTo(section) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Update sections
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const activeSection = document.getElementById(`section-${section}`);
  if (activeSection) activeSection.classList.add('active');

  // Update title
  const titles = { dashboard: 'Dashboard', students: 'Students', attendance: 'Attendance', reports: 'Reports' };
  document.getElementById('pageTitle').textContent = titles[section] || section;

  // Refresh relevant charts
  if (section === 'dashboard') {
    updateDashboard();
    initWeeklyChart();
    initDonutChart();
  }
  if (section === 'reports') {
    initMonthlyChart();
    renderRankingList();
    renderReportTable();
  }
}

// =====================================================================
// SIDEBAR MOBILE
// =====================================================================
function setupSidebar() {
  const btn     = document.getElementById('hamburgerBtn');
  const close   = document.getElementById('sidebarClose');
  const overlay = document.getElementById('sidebarOverlay');

  btn.addEventListener('click', openSidebar);
  close.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// =====================================================================
// BACKEND CHECK
// =====================================================================
async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE}/students`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      USE_BACKEND = true;
      const pill = document.getElementById('backendStatus');
      pill.classList.add('connected');
      pill.querySelector('.status-text').textContent = 'Live';
      showToast('✓ Connected to backend server', 'success');
      // Sync data from backend
      await syncFromBackend();
    }
  } catch {
    // Backend not running – use localStorage (default)
    USE_BACKEND = false;
  }
}

async function syncFromBackend() {
  try {
    const [sRes, aRes] = await Promise.all([
      fetch(`${API_BASE}/students`).then(r => r.json()),
      fetch(`${API_BASE}/attendance`).then(r => r.json())
    ]);
    students   = sRes;
    attendance = aRes;
    Store.set('sa_students', students);
    Store.set('sa_attendance', attendance);
    renderAll();
  } catch (err) {
    console.warn('Sync failed:', err);
  }
}

// =====================================================================
// RENDER ALL
// =====================================================================
function renderAll() {
  updateDashboard();
  renderStudentsTable();
  renderAttendanceTable();
  initWeeklyChart();
  initDonutChart();
}

// =====================================================================
// DASHBOARD
// =====================================================================
function updateDashboard() {
  const today = getTodayString();
  const todayRecords = attendance.filter(r => r.date === today);
  const presentCount = todayRecords.filter(r => r.status === 'Present').length;
  const absentCount  = todayRecords.filter(r => r.status === 'Absent').length;

  // Overall avg attendance (all time)
  const avg = calcAverageAttendance();

  // Update stat cards
  document.getElementById('dash-totalStudents').textContent = students.length;
  document.getElementById('dash-presentToday').textContent  = presentCount;
  document.getElementById('dash-absentToday').textContent   = absentCount;
  document.getElementById('dash-avgAttendance').textContent = avg + '%';

  // Recent attendance table (last 10)
  const recent = [...attendance].reverse().slice(0, 10);
  const tbody  = document.getElementById('recentAttendanceTbody');

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No records yet. Mark attendance to get started.</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(r => {
    const student = students.find(s => s.id === r.studentId);
    if (!student) return '';
    return `
      <tr>
        <td>
          <div class="student-name-cell">
            <div class="student-avatar" style="${avatarStyle(student.name)}">${initials(student.name)}</div>
            <span style="color:var(--text-primary);font-weight:500">${escHtml(student.name)}</span>
          </div>
        </td>
        <td>${escHtml(student.rollNo)}</td>
        <td>${formatDateDisplay(r.date)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`;
  }).join('');
}

// =====================================================================
// STUDENTS TABLE
// =====================================================================
function renderStudentsTable() {
  const query  = document.getElementById('studentSearch').value.toLowerCase().trim();
  const tbody  = document.getElementById('studentsTbody');
  let filtered = students;

  if (query) {
    filtered = students.filter(s =>
      s.name.toLowerCase().includes(query)  ||
      s.rollNo.toLowerCase().includes(query) ||
      s.class.toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">${
      query ? 'No students match your search.' : 'No students added yet. Click "Add Student" to begin.'
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => `
    <tr>
      <td style="color:var(--text-muted)">${idx + 1}</td>
      <td>
        <div class="student-name-cell">
          <div class="student-avatar" style="${avatarStyle(s.name)}">${initials(s.name)}</div>
          <span style="color:var(--text-primary);font-weight:500">${escHtml(s.name)}</span>
        </div>
      </td>
      <td><code style="background:var(--bg-elevated);padding:2px 8px;border-radius:4px;font-size:12px">${escHtml(s.rollNo)}</code></td>
      <td>${escHtml(s.class)}</td>
      <td>${s.email ? escHtml(s.email) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${s.phone ? escHtml(s.phone) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn-icon edit" title="Edit" onclick="openEditStudentModal('${s.id}')"><i class="bi bi-pencil-fill"></i></button>
          <button class="btn-icon del"  title="Delete" onclick="openDeleteModal('${s.id}')"><i class="bi bi-trash3-fill"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

// =====================================================================
// ADD / EDIT STUDENT
// =====================================================================
function openAddStudentModal() {
  // Reset form
  document.getElementById('studentName').value  = '';
  document.getElementById('studentRoll').value  = '';
  document.getElementById('studentClass').value = '';
  document.getElementById('studentEmail').value = '';
  document.getElementById('studentPhone').value = '';
  document.getElementById('editStudentId').value = '';
  document.getElementById('studentModalLabel').textContent = 'Add Student';
  document.getElementById('saveStudentBtnText').textContent = 'Add Student';
  document.getElementById('studentFormErrors').classList.add('d-none');
  clearInputErrors();
  studentModal.show();
}

function openEditStudentModal(id) {
  const student = students.find(s => s.id === id);
  if (!student) return;

  document.getElementById('studentName').value   = student.name;
  document.getElementById('studentRoll').value   = student.rollNo;
  document.getElementById('studentClass').value  = student.class;
  document.getElementById('studentEmail').value  = student.email || '';
  document.getElementById('studentPhone').value  = student.phone || '';
  document.getElementById('editStudentId').value = student.id;
  document.getElementById('studentModalLabel').textContent = 'Edit Student';
  document.getElementById('saveStudentBtnText').textContent = 'Save Changes';
  document.getElementById('studentFormErrors').classList.add('d-none');
  clearInputErrors();
  studentModal.show();
}

async function saveStudent() {
  // Read values
  const name    = document.getElementById('studentName').value.trim();
  const rollNo  = document.getElementById('studentRoll').value.trim();
  const cls     = document.getElementById('studentClass').value.trim();
  const email   = document.getElementById('studentEmail').value.trim();
  const phone   = document.getElementById('studentPhone').value.trim();
  const editId  = document.getElementById('editStudentId').value;

  // Validate
  const errors = [];
  clearInputErrors();

  if (!name)   { markInvalid('studentName');  errors.push('Full name is required.'); }
  if (!rollNo) { markInvalid('studentRoll');  errors.push('Roll number is required.'); }
  if (!cls)    { markInvalid('studentClass'); errors.push('Class / section is required.'); }
  if (email && !isValidEmail(email)) { markInvalid('studentEmail'); errors.push('Enter a valid email address.'); }

  // Check duplicate roll number (excluding current student if editing)
  const duplicate = students.find(s => s.rollNo === rollNo && s.id !== editId);
  if (duplicate) { markInvalid('studentRoll'); errors.push('A student with this roll number already exists.'); }

  if (errors.length) {
    const errBox = document.getElementById('studentFormErrors');
    errBox.innerHTML = errors.map(e => `<div>• ${e}</div>`).join('');
    errBox.classList.remove('d-none');
    return;
  }

  const payload = { name, rollNo, class: cls, email, phone };

  // Disable button during save
  const btn = document.getElementById('saveStudentBtn');
  btn.disabled = true;

  try {
    if (editId) {
      // UPDATE
      if (USE_BACKEND) {
        await fetch(`${API_BASE}/students/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      const idx = students.findIndex(s => s.id === editId);
      students[idx] = { ...students[idx], ...payload };
      showToast('Student updated successfully!');
    } else {
      // CREATE
      const newStudent = { id: genId(), ...payload, createdAt: new Date().toISOString() };
      if (USE_BACKEND) {
        const res = await fetch(`${API_BASE}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        newStudent.id = data._id || newStudent.id; // Use backend-generated ID
      }
      students.push(newStudent);
      showToast('Student added successfully!');
    }

    Store.set('sa_students', students);
    studentModal.hide();
    renderStudentsTable();
    renderAttendanceTable();
    updateDashboard();
    initDonutChart();
    initWeeklyChart();

  } catch (err) {
    console.error(err);
    showToast('Error saving student. Please try again.', 'error');
  } finally {
    btn.disabled = false;
  }
}

// =====================================================================
// DELETE STUDENT
// =====================================================================
function openDeleteModal(id) {
  document.getElementById('deleteStudentId').value = id;
  deleteModal.show();
}

async function confirmDeleteStudent() {
  const id = document.getElementById('deleteStudentId').value;

  try {
    if (USE_BACKEND) {
      await fetch(`${API_BASE}/students/${id}`, { method: 'DELETE' });
    }
    students   = students.filter(s => s.id !== id);
    attendance = attendance.filter(r => r.studentId !== id);
    Store.set('sa_students', students);
    Store.set('sa_attendance', attendance);

    deleteModal.hide();
    renderStudentsTable();
    renderAttendanceTable();
    updateDashboard();
    initDonutChart();
    initWeeklyChart();
    showToast('Student deleted.');
  } catch (err) {
    console.error(err);
    showToast('Error deleting student.', 'error');
  }
}

// =====================================================================
// ATTENDANCE TABLE
// =====================================================================
function renderAttendanceTable() {
  const date   = document.getElementById('attendanceDate').value;
  const query  = document.getElementById('attendanceSearch').value.toLowerCase().trim();
  const tbody  = document.getElementById('attendanceTbody');

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Add students first, then mark attendance here.</td></tr>';
    return;
  }

  let filtered = students;
  if (query) {
    filtered = students.filter(s => s.name.toLowerCase().includes(query) || s.rollNo.toLowerCase().includes(query));
  }

  tbody.innerHTML = filtered.map((s, idx) => {
    const record = attendance.find(r => r.studentId === s.id && r.date === date);
    const status = record ? record.status : null;

    return `
      <tr>
        <td style="color:var(--text-muted)">${idx + 1}</td>
        <td>
          <div class="student-name-cell">
            <div class="student-avatar" style="${avatarStyle(s.name)}">${initials(s.name)}</div>
            <span style="color:var(--text-primary);font-weight:500">${escHtml(s.name)}</span>
          </div>
        </td>
        <td><code style="background:var(--bg-elevated);padding:2px 8px;border-radius:4px;font-size:12px">${escHtml(s.rollNo)}</code></td>
        <td>${escHtml(s.class)}</td>
        <td>
          <div class="attendance-toggle">
            <button class="att-btn ${status === 'Present' ? 'present-active' : ''}"
              onclick="toggleAttendance('${s.id}', '${date}', 'Present', this)">Present</button>
            <button class="att-btn ${status === 'Absent' ? 'absent-active' : ''}"
              onclick="toggleAttendance('${s.id}', '${date}', 'Absent', this)">Absent</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function toggleAttendance(studentId, date, status, btn) {
  // Remove active classes from sibling buttons
  const group = btn.parentElement;
  group.querySelectorAll('.att-btn').forEach(b => {
    b.classList.remove('present-active', 'absent-active');
  });

  // Apply active class
  if (status === 'Present') btn.classList.add('present-active');
  else btn.classList.add('absent-active');

  // Update in-memory state
  const idx = attendance.findIndex(r => r.studentId === studentId && r.date === date);
  if (idx >= 0) {
    attendance[idx].status = status;
  } else {
    attendance.push({ id: genId(), studentId, date, status, markedAt: new Date().toISOString() });
  }
}

async function saveAttendance() {
  const date = document.getElementById('attendanceDate').value;
  const todayRecords = attendance.filter(r => r.date === date);

  if (todayRecords.length === 0) {
    showToast('No attendance marked yet. Toggle Present/Absent for each student.', 'error');
    return;
  }

  try {
    if (USE_BACKEND) {
      await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, records: todayRecords })
      });
    }
    Store.set('sa_attendance', attendance);
    updateDashboard();
    initWeeklyChart();
    initDonutChart();
    showToast(`Attendance saved for ${formatDateDisplay(date)}!`);
  } catch (err) {
    console.error(err);
    // Still save locally
    Store.set('sa_attendance', attendance);
    showToast('Saved locally (backend error).', 'warning');
  }
}

// =====================================================================
// REPORTS
// =====================================================================
function renderReportTable() {
  const filter = document.getElementById('reportDateFilter').value;
  let records  = [...attendance].reverse();
  if (filter) records = records.filter(r => r.date === filter);

  const tbody = document.getElementById('reportTbody');

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">${filter ? 'No records for this date.' : 'No attendance records found.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const s = students.find(st => st.id === r.studentId);
    if (!s) return '';
    return `
      <tr>
        <td>
          <div class="student-name-cell">
            <div class="student-avatar" style="${avatarStyle(s.name)}">${initials(s.name)}</div>
            <span style="color:var(--text-primary);font-weight:500">${escHtml(s.name)}</span>
          </div>
        </td>
        <td>${escHtml(s.rollNo)}</td>
        <td>${escHtml(s.class)}</td>
        <td>${formatDateDisplay(r.date)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`;
  }).join('');
}

function clearReportFilter() {
  document.getElementById('reportDateFilter').value = '';
  renderReportTable();
}

function renderRankingList() {
  const container = document.getElementById('rankingList');

  if (students.length === 0) {
    container.innerHTML = '<p class="text-muted text-sm p-3">No data yet.</p>';
    return;
  }

  // Calc per-student attendance
  const ranked = students.map(s => {
    const total   = attendance.filter(r => r.studentId === s.id).length;
    const present = attendance.filter(r => r.studentId === s.id && r.status === 'Present').length;
    const pct     = total > 0 ? Math.round((present / total) * 100) : 0;
    return { ...s, pct };
  }).sort((a, b) => b.pct - a.pct);

  container.innerHTML = ranked.map((s, idx) => {
    const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
    const pctClass  = s.pct >= 75 ? 'high' : s.pct >= 50 ? 'mid' : 'low';
    const barColor  = s.pct >= 75 ? 'var(--brand)' : s.pct >= 50 ? 'var(--amber)' : 'var(--red)';

    return `
      <div class="ranking-item">
        <div class="rank-num ${rankClass}">${idx + 1}</div>
        <div class="flex-1">
          <div class="d-flex align-items-center justify-content-between">
            <span class="rank-name">${escHtml(s.name)}</span>
            <span class="rank-pct ${pctClass}">${s.pct}%</span>
          </div>
          <div class="rank-bar-bg" style="width:80px">
            <div class="rank-bar-fill" style="width:${s.pct}%;background:${barColor}"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// =====================================================================
// CHARTS
// =====================================================================
function initWeeklyChart() {
  const canvas = document.getElementById('weeklyChart');
  if (!canvas) return;
  if (weeklyChart) weeklyChart.destroy();

  // Get last 7 days
  const labels = [], presentData = [], absentData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });

    labels.push(dayLabel);
    const dayRecords = attendance.filter(r => r.date === dateStr);
    presentData.push(dayRecords.filter(r => r.status === 'Present').length);
    absentData.push(dayRecords.filter(r => r.status === 'Absent').length);
  }

  weeklyChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Present',
          data: presentData,
          backgroundColor: 'rgba(59,130,246,0.65)',
          borderColor: '#3b82f6',

          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          label: 'Absent',
          data: absentData,
          backgroundColor: 'rgba(147,197,253,0.55)',
          borderColor: '#60a5fa',

          borderWidth: 1.5,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { family: 'DM Sans', size: 12 }, boxWidth: 12, padding: 16 } }
      },
      scales: {
        x: {
          ticks: { color: '#6b7280', font: { family: 'DM Sans' } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#6b7280', font: { family: 'DM Sans' }, stepSize: 1 },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    }
  });
}

function initDonutChart() {
  const canvas = document.getElementById('donutChart');
  if (!canvas) return;
  if (donutChart) donutChart.destroy();

  const today       = getTodayString();
  const todayRec    = attendance.filter(r => r.date === today);
  const present     = todayRec.filter(r => r.status === 'Present').length;
  const absent      = todayRec.filter(r => r.status === 'Absent').length;
  const unmarked    = Math.max(0, students.length - present - absent);

  donutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Absent', 'Unmarked'],
      datasets: [{
        data: [present || 0, absent || 0, unmarked || students.length],
        backgroundColor: ['rgba(59,130,246,0.85)', 'rgba(147,197,253,0.85)', 'rgba(148,163,184,0.45)'],
        borderColor: ['#3b82f6', '#60a5fa', '#94a3b8'],

        borderWidth: 1.5,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9ca3af', font: { family: 'DM Sans', size: 12 }, padding: 16, boxWidth: 12 }
        }
      }
    }
  });
}

function initMonthlyChart() {
  const canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  if (monthlyChart) monthlyChart.destroy();

  // Last 30 days – average % per week
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const pctData = weeks.map((_, wi) => {
    const start = wi * 7;
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - 29 + start + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }
    const total   = attendance.filter(r => weekDates.includes(r.date)).length;
    const present = attendance.filter(r => weekDates.includes(r.date) && r.status === 'Present').length;
    return total > 0 ? Math.round((present / total) * 100) : 0;
  });

  monthlyChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [{
        label: 'Attendance %',
        data: pctData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.12)',
        pointBackgroundColor: '#3b82f6',

        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { family: 'DM Sans', size: 12 } } }
      },
      scales: {
        x: {
          ticks: { color: '#6b7280', font: { family: 'DM Sans' } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          beginAtZero: true, max: 100,
          ticks: { color: '#6b7280', font: { family: 'DM Sans' }, callback: v => v + '%' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    }
  });
}

// =====================================================================
// UTILITIES
// =====================================================================
function genId() {
  return '_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m)-1]} ${y}`;
}

function calcAverageAttendance() {
  if (attendance.length === 0) return 0;
  const present = attendance.filter(r => r.status === 'Present').length;
  return Math.round((present / attendance.length) * 100);
}

function statusBadge(status) {
  return status === 'Present'
    ? '<span class="badge-present"><i class="bi bi-check-circle-fill"></i> Present</span>'
    : '<span class="badge-absent"><i class="bi bi-x-circle-fill"></i> Absent</span>';
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

// Deterministic color per student name
const AVATAR_COLORS = [
  ['#3b82f6','rgba(59,130,246,0.18)'], // blue
  ['#8b5cf6','rgba(139,92,246,0.18)'], // purple
  ['#22c55e','rgba(34,197,94,0.18)'],  // green
  ['#f59e0b','rgba(245,158,11,0.18)'], // amber
  ['#ef4444','rgba(239,68,68,0.18)'],  // red
  ['#06b6d4','rgba(6,182,212,0.18)'],  // cyan
];
function avatarStyle(name) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  const [fg, bg] = AVATAR_COLORS[idx];
  return `background:${bg};color:${fg};`;
}

function escHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function markInvalid(id) {
  document.getElementById(id).classList.add('is-invalid');
}

function clearInputErrors() {
  document.querySelectorAll('.input-custom').forEach(el => el.classList.remove('is-invalid'));
}

function showToast(msg, type = 'success') {
  const el     = document.getElementById('appToast');
  const msgEl  = document.getElementById('toastMessage');
  msgEl.textContent = msg;
  el.style.borderLeft = `3px solid ${
    type === 'success' ? 'var(--brand)'
    : type === 'error'   ? 'var(--red)'
    : 'var(--amber)'
  }`;
  toast.show();
}