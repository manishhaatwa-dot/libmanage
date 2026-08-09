/**
 * ==========================================================================
 * LIBMANAGE SAAS ECOSYSTEM ENGINE - STUDENT DASHBOARD
 * COMPLETE CORRECTED student-dashboard.js
 * ==========================================================================
 */

let currentStudentLibraryId = '';
let currentStudentCode = '';
let currentStudentProfile = null;
let studentAttendanceMap = {};
let attendanceMonthCursor = new Date();
let dashboardInitialized = false;

let unsubscribeStudentProfileRef = null;
let unsubscribeStudentNoticesRef = null;
let unsubscribeAttendanceDatesRef = null;
let attendanceRecordUnsubscribers = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (dashboardInitialized) return;
    dashboardInitialized = true;

    currentStudentLibraryId = sessionStorage.getItem('session_library_id') || '';
    currentStudentCode = sessionStorage.getItem('session_student_code') || sessionStorage.getItem('session_login_id') || '';

    if (!currentStudentLibraryId || !currentStudentCode) {
        alert('Session Error: Student login session is missing.');
        window.location.href = '../index.html';
        return;
    }

    try {
        if (typeof loadSaaSLayoutComponent === 'function') {
            await safeLoadLayoutComponents();
        }
    } catch (error) {
        console.error('[Student Dashboard Layout Load Error]:', error);
    }

    bindAttendanceCalendarControls();
    bindOptionalDashboardControls();

    await initializeStudentDashboard();
});

async function safeLoadLayoutComponents() {
    const jobs = [];

    const sidebar = document.getElementById('sidebar-container');
    const navbar = document.getElementById('navbar-container');
    const footer = document.getElementById('footer-container');

    if (sidebar) {
        jobs.push(
            loadSaaSLayoutComponent('sidebar-container', '../components/sidebar.html', () => {
                if (typeof handleSidebarActivation === 'function') handleSidebarActivation();
            })
        );
    }

    if (navbar) {
        jobs.push(
            loadSaaSLayoutComponent('navbar-container', '../components/navbar.html', () => {
                if (typeof bindNavbarInteractions === 'function') bindNavbarInteractions();
            })
        );
    }

    if (footer) {
        jobs.push(loadSaaSLayoutComponent('footer-container', '../components/footer.html'));
    }

    await Promise.all(jobs);
}

async function initializeStudentDashboard() {
    const db = window.db;

    if (!db) {
        alert('Database Engine Offline: Firestore is not available.');
        return;
    }

    renderAttendanceCalendarSkeleton();
    renderAttendanceSummary();
    setStudentIdentityPlaceholders();

    attachStudentProfileRealtimeListener(db);
    attachLibraryNoticesRealtimeListener(db);
    attachStudentAttendanceRealtimeListener(db);
}

function setStudentIdentityPlaceholders() {
    setTextIfExists('student-login-id', currentStudentCode);
    setTextIfExists('student-library-id', currentStudentLibraryId);
}

function bindAttendanceCalendarControls() {
    const prevBtn =
        document.getElementById('attendance-prev-month') ||
        document.getElementById('calendar-prev-btn') ||
        document.getElementById('prev-month-btn');

    const nextBtn =
        document.getElementById('attendance-next-month') ||
        document.getElementById('calendar-next-btn') ||
        document.getElementById('next-month-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            attendanceMonthCursor = new Date(
                attendanceMonthCursor.getFullYear(),
                attendanceMonthCursor.getMonth() - 1,
                1
            );
            renderAttendanceCalendar();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            attendanceMonthCursor = new Date(
                attendanceMonthCursor.getFullYear(),
                attendanceMonthCursor.getMonth() + 1,
                1
            );
            renderAttendanceCalendar();
        });
    }
}

function bindOptionalDashboardControls() {
    const refreshBtn = document.getElementById('attendance-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            renderAttendanceSummary();
            renderAttendanceCalendar();
        });
    }
}

function attachStudentProfileRealtimeListener(db) {
    if (unsubscribeStudentProfileRef) {
        unsubscribeStudentProfileRef();
        unsubscribeStudentProfileRef = null;
    }

    unsubscribeStudentProfileRef = db
        .collection('saas_libraries')
        .doc(currentStudentLibraryId)
        .collection('students')
        .doc(currentStudentCode)
        .onSnapshot((doc) => {
            if (!doc.exists) {
                console.warn('[Student Dashboard]: Student profile not found for code:', currentStudentCode);
                currentStudentProfile = null;
                renderStudentProfileFallback();
                return;
            }

            currentStudentProfile = {
                studentCode: doc.id,
                ...(doc.data() || {})
            };

            renderStudentProfile(currentStudentProfile);
        }, (error) => {
            console.error('[Student Dashboard Student Profile Listener Error]:', error);
        });
}

function attachLibraryNoticesRealtimeListener(db) {
    const noticesContainer =
        document.getElementById('student-notices-list') ||
        document.getElementById('library-notices-list') ||
        document.getElementById('notice-list');

    if (!noticesContainer) return;

    if (unsubscribeStudentNoticesRef) {
        unsubscribeStudentNoticesRef();
        unsubscribeStudentNoticesRef = null;
    }

    unsubscribeStudentNoticesRef = db
        .collection('saas_libraries')
        .doc(currentStudentLibraryId)
        .collection('notices')
        .orderBy('updatedAt', 'desc')
        .onSnapshot((snapshot) => {
            const notices = [];
            snapshot.forEach((doc) => {
                if (doc.id === 'anchor_node') return;
                notices.push({
                    id: doc.id,
                    ...(doc.data() || {})
                });
            });
            renderStudentNotices(notices);
        }, (error) => {
            console.error('[Student Dashboard Notices Listener Error]:', error);
        });
}

function clearAttendanceRecordListeners() {
    attendanceRecordUnsubscribers.forEach((unsubscribe) => {
        try {
            if (typeof unsubscribe === 'function') unsubscribe();
        } catch (error) {
            console.warn('[Attendance Record Listener Cleanup Warning]:', error);
        }
    });
    attendanceRecordUnsubscribers = [];
}

function attachStudentAttendanceRealtimeListener(db) {
    if (unsubscribeAttendanceDatesRef) {
        unsubscribeAttendanceDatesRef();
        unsubscribeAttendanceDatesRef = null;
    }

    clearAttendanceRecordListeners();
    studentAttendanceMap = {};
    renderAttendanceSummary();
    renderAttendanceCalendar();

    unsubscribeAttendanceDatesRef = db
        .collection('saas_libraries')
        .doc(currentStudentLibraryId)
        .collection('attendance')
        .onSnapshot((snapshot) => {
            clearAttendanceRecordListeners();

            const nextAttendanceMap = {};
            const dateIds = [];

            snapshot.forEach((doc) => {
                if (!doc.exists) return;
                if (!isValidDateDocumentId(doc.id)) return;
                dateIds.push(doc.id);
            });

            if (dateIds.length === 0) {
                studentAttendanceMap = {};
                renderAttendanceSummary();
                renderAttendanceCalendar();
                return;
            }

            dateIds.forEach((dateDocId) => {
                const unsubscribeRecordRef = db
                    .collection('saas_libraries')
                    .doc(currentStudentLibraryId)
                    .collection('attendance')
                    .doc(dateDocId)
                    .collection('records')
                    .doc(currentStudentCode)
                    .onSnapshot((recordDoc) => {
                        if (recordDoc.exists) {
                            const data = recordDoc.data() || {};
                            nextAttendanceMap[dateDocId] = {
                                dateId: dateDocId,
                                studentCode: data.studentCode || currentStudentCode,
                                name: data.name || '',
                                seatNumber: data.seatNumber || '',
                                shift: data.shift || '',
                                status: normalizeAttendanceStatus(data.status || '')
                            };
                        } else {
                            delete nextAttendanceMap[dateDocId];
                        }

                        studentAttendanceMap = { ...nextAttendanceMap };
                        renderAttendanceSummary();
                        renderAttendanceCalendar();
                    }, (error) => {
                        console.error(`[Attendance Record Listener Error - ${dateDocId}]:`, error);
                    });

                attendanceRecordUnsubscribers.push(unsubscribeRecordRef);
            });
        }, (error) => {
            console.error('[Attendance Dates Listener Error]:', error);
        });
}

function normalizeAttendanceStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'present') return 'Present';
    if (normalized === 'absent') return 'Absent';
    return '';
}

function isValidDateDocumentId(value) {
    return /^d{4}-d{2}-d{2}$/.test(String(value || '').trim());
}

function parseDateIdToLocalDate(dateId) {
    if (!isValidDateDocumentId(dateId)) return null;
    const [year, month, day] = dateId.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function formatDateIdFromParts(year, monthIndex, day) {
    const yearPart = String(year);
    const monthPart = String(monthIndex + 1).padStart(2, '0');
    const dayPart = String(day).padStart(2, '0');
    return `${yearPart}-${monthPart}-${dayPart}`;
}

function renderStudentProfile(profile) {
    setTextIfExists('student-login-id', profile.studentCode || currentStudentCode);
    setTextIfExists('student-library-id', currentStudentLibraryId);
    setTextIfExists('student-name', profile.name || '');
    setTextIfExists('student-shift', profile.shift || '');
    setTextIfExists('student-seat-number', profile.seatNumber || '');
    setTextIfExists('student-seat', profile.seatNumber || '');
    setTextIfExists('student-class', profile.studentClass || '');
    setTextIfExists('student-status', profile.status || '');
    setTextIfExists('student-father-name', profile.fatherName || '');
    setTextIfExists('student-code', profile.studentCode || currentStudentCode);

    const profileNameInput = document.getElementById('profile-student-name');
    if (profileNameInput) profileNameInput.value = profile.name || '';
}

function renderStudentProfileFallback() {
    setTextIfExists('student-login-id', currentStudentCode);
    setTextIfExists('student-library-id', currentStudentLibraryId);
}

function renderStudentNotices(notices) {
    const noticesContainer =
        document.getElementById('student-notices-list') ||
        document.getElementById('library-notices-list') ||
        document.getElementById('notice-list');

    if (!noticesContainer) return;

    if (!Array.isArray(notices) || notices.length === 0) {
        noticesContainer.innerHTML = '<div class="notice-empty-state">No notices available.</div>';
        return;
    }

    noticesContainer.innerHTML = notices.map((notice) => {
        const title = escapeHtml(notice.title || 'Notice');
        const message = escapeHtml(notice.message || notice.description || '');
        const dateText = escapeHtml(
            notice.date ||
            extractDisplayDateFromTimestamp(notice.updatedAt) ||
            ''
        );

        return `
            <div class="notice-item">
                <div class="notice-item-header">
                    <strong>${title}</strong>
                    <span>${dateText}</span>
                </div>
                <div class="notice-item-body">${message}</div>
            </div>
        `;
    }).join('');
}

function renderAttendanceSummary() {
    const attendanceEntries = Object.values(studentAttendanceMap);
    let totalPresent = 0;
    let totalAbsent = 0;

    attendanceEntries.forEach((entry) => {
        if (!entry || entry.studentCode !== currentStudentCode) return;
        if (entry.status === 'Present') totalPresent += 1;
        if (entry.status === 'Absent') totalAbsent += 1;
    });

    setTextIfExists('total-present', String(totalPresent));
    setTextIfExists('totalPresent', String(totalPresent));
    setTextIfExists('attendance-total-present', String(totalPresent));

    setTextIfExists('total-absent', String(totalAbsent));
    setTextIfExists('totalAbsent', String(totalAbsent));
    setTextIfExists('attendance-total-absent', String(totalAbsent));
}

function renderAttendanceCalendarSkeleton() {
    const grid =
        document.getElementById('attendance-calendar-grid') ||
        document.getElementById('attendance-calendar') ||
        document.getElementById('calendar-grid');

    if (!grid) return;

    renderAttendanceCalendar();
}

function renderAttendanceCalendar() {
    const monthLabelNode =
        document.getElementById('attendance-month-label') ||
        document.getElementById('calendar-month-label') ||
        document.getElementById('attendance-current-month');

    const grid =
        document.getElementById('attendance-calendar-grid') ||
        document.getElementById('attendance-calendar') ||
        document.getElementById('calendar-grid');

    if (!grid) return;

    const year = attendanceMonthCursor.getFullYear();
    const monthIndex = attendanceMonthCursor.getMonth();

    if (monthLabelNode) {
        monthLabelNode.textContent = attendanceMonthCursor.toLocaleString('en-US', {
            month: 'long',
            year: 'numeric'
        });
    }

    const firstDay = new Date(year, monthIndex, 1);
    const startingWeekDay = firstDay.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    let html = '';

    const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    html += weekLabels.map((label) => `<div class="attendance-weekday">${label}</div>`).join('');

    for (let i = 0; i < startingWeekDay; i++) {
        html += '<div class="attendance-day empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateId = formatDateIdFromParts(year, monthIndex, day);
        const attendance = studentAttendanceMap[dateId];
        const status = attendance && attendance.studentCode === currentStudentCode
            ? normalizeAttendanceStatus(attendance.status)
            : '';

        let statusClass = '';
        let statusLabel = '';

        if (status === 'Present') {
            statusClass = 'present';
            statusLabel = 'Present';
        } else if (status === 'Absent') {
            statusClass = 'absent';
            statusLabel = 'Absent';
        }

        html += `
            <div class="attendance-day ${statusClass}">
                <div class="attendance-date-number">${day}</div>
                <div class="attendance-status-text">${statusLabel}</div>
            </div>
        `;
    }

    grid.innerHTML = html;
}

function extractDisplayDateFromTimestamp(timestamp) {
    try {
        if (!timestamp) return '';
        if (typeof timestamp.toDate === 'function') {
            const date = timestamp.toDate();
            return date.toLocaleDateString('en-GB');
        }
        return '';
    } catch (error) {
        return '';
    }
}

function setTextIfExists(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value == null ? '' : String(value);
}

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.addEventListener('beforeunload', () => {
    try {
        if (typeof unsubscribeStudentProfileRef === 'function') unsubscribeStudentProfileRef();
        if (typeof unsubscribeStudentNoticesRef === 'function') unsubscribeStudentNoticesRef();
        if (typeof unsubscribeAttendanceDatesRef === 'function') unsubscribeAttendanceDatesRef();
        clearAttendanceRecordListeners();
    } catch (error) {
        console.warn('[Student Dashboard Cleanup Warning]:', error);
    }
});
