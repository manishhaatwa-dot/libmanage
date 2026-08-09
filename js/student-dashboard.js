/**
 * ==========================================================================
 * LIBMANAGE - STUDENT DASHBOARD
 * READ ONLY STUDENT PORTAL
 *
 * STUDENT PROFILE:
 * saas_libraries/{libraryId}/students/{studentCode}
 *
 * ATTENDANCE:
 * saas_libraries/{libraryId}/attendance/{YYYY-MM-DD}/records/{studentCode}
 *
 * NOTICES:
 * saas_libraries/{libraryId}/notices/{noticeId}
 *
 * STUDENT SIDE = READ ONLY
 * NO WRITE / UPDATE / DELETE
 * ==========================================================================
 */

let studentDashboardLibraryId = "";
let studentDashboardCode = "";

let studentDashboardData = null;

let attendanceHistoryMap = {};
let attendanceMonthCursor = new Date();

let studentDashboardInitialized = false;


/**
 * ==========================================================================
 * PAGE INITIALIZATION
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", () => {

    if (studentDashboardInitialized) {
        return;
    }

    studentDashboardInitialized = true;

    initializeStudentDashboard();

});


/**
 * ==========================================================================
 * INITIALIZE STUDENT DASHBOARD
 * ==========================================================================
 */

async function initializeStudentDashboard() {

    /*
     * Student login session
     */

    studentDashboardLibraryId =
        String(
            localStorage.getItem("session_library_id") || ""
        ).trim();

    studentDashboardCode =
        String(
            localStorage.getItem("session_user_code") || ""
        ).trim();


    /*
     * No session
     */

    if (
        !studentDashboardLibraryId ||
        !studentDashboardCode
    ) {

        window.location.href = "../index.html";

        return;
    }


    displayStudentSessionIds();

    bindStudentDashboardEvents();


    try {

        await loadStudentProfile();

        await loadStudentAttendance();

        await loadStudentNotices();

        renderAttendanceCalendar();

    } catch (error) {

        console.error(
            "[Student Dashboard Initialization Error]:",
            error
        );

    }

}


/**
 * ==========================================================================
 * DISPLAY LOGIN IDS
 * ==========================================================================
 */

function displayStudentSessionIds() {

    const libraryIdNode =
        document.getElementById(
            "student-library-id-display"
        );

    const studentCodeNode =
        document.getElementById(
            "student-code-display"
        );


    if (libraryIdNode) {

        libraryIdNode.textContent =
            studentDashboardLibraryId;

    }


    if (studentCodeNode) {

        studentCodeNode.textContent =
            studentDashboardCode;

    }

}


/**
 * ==========================================================================
 * DASHBOARD EVENTS
 * ==========================================================================
 */

function bindStudentDashboardEvents() {

    const previousButton =
        document.getElementById(
            "previous-month-btn"
        );

    const nextButton =
        document.getElementById(
            "next-month-btn"
        );

    const exitButton =
        document.getElementById(
            "student-exit-btn"
        );


    if (previousButton) {

        previousButton.addEventListener(
            "click",
            () => {

                attendanceMonthCursor.setMonth(
                    attendanceMonthCursor.getMonth() - 1
                );

                renderAttendanceCalendar();

            }
        );

    }


    if (nextButton) {

        nextButton.addEventListener(
            "click",
            () => {

                attendanceMonthCursor.setMonth(
                    attendanceMonthCursor.getMonth() + 1
                );

                renderAttendanceCalendar();

            }
        );

    }


    if (exitButton) {

        exitButton.addEventListener(
            "click",
            studentPortalLogout
        );

    }

}


/**
 * ==========================================================================
 * LOAD CURRENT STUDENT PROFILE
 * ==========================================================================
 */

async function loadStudentProfile() {

    const db = window.db;


    if (!db) {

        throw new Error(
            "Firebase Firestore is not available."
        );

    }


    const studentRef =
        db
            .collection("saas_libraries")
            .doc(studentDashboardLibraryId)
            .collection("students")
            .doc(studentDashboardCode);


    const studentSnapshot =
        await studentRef.get();


    if (!studentSnapshot.exists) {

        alert(
            "Student profile could not be found."
        );

        studentPortalLogout();

        return;

    }


    studentDashboardData =
        studentSnapshot.data() || {};


    /*
     * Security verification
     */

    const storedLibraryId =
        String(
            studentDashboardData.libraryId || ""
        ).trim();


    const storedStudentCode =
        String(
            studentDashboardData.studentCode || ""
        ).trim();


    if (
        storedLibraryId &&
        storedLibraryId !==
            studentDashboardLibraryId
    ) {

        console.error(
            "[Student Security] Library ID mismatch."
        );

        alert(
            "Student session verification failed."
        );

        studentPortalLogout();

        return;

    }


    if (
        storedStudentCode &&
        storedStudentCode !==
            studentDashboardCode
    ) {

        console.error(
            "[Student Security] Student Code mismatch."
        );

        alert(
            "Student session verification failed."
        );

        studentPortalLogout();

        return;

    }


    renderStudentProfile();

}


/**
 * ==========================================================================
 * RENDER STUDENT PROFILE
 * ==========================================================================
 */

function renderStudentProfile() {

    const student =
        studentDashboardData || {};


    setText(
        "student-name",
        student.name || "-"
    );


    setText(
        "student-father",
        student.fatherName || "-"
    );


    setText(
        "student-mobile",
        student.mobile || "-"
    );


    setText(
        "student-class",
        student.studentClass || "-"
    );


    setText(
        "student-seat",
        student.seatNumber || "-"
    );


    setText(
        "student-shift",
        student.shift || "-"
    );


    setText(
        "student-joining",
        formatDisplayDate(
            student.joiningDate
        ) || "-"
    );


    setText(
        "student-expiry",
        formatDisplayDate(
            student.expiryDate
        ) || "-"
    );


    setText(
        "student-status",
        student.status || "-"
    );

}


/**
 * ==========================================================================
 * LOAD STUDENT ATTENDANCE
 *
 * IMPORTANT:
 *
 * Firebase structure:
 *
 * saas_libraries
 *    └── LIBRARY_ID
 *         └── attendance
 *              └── 2026-08-09
 *                   └── records
 *                        └── LIB001
 *
 * We read ONLY the currently logged-in student's document.
 * ==========================================================================
 */

async function loadStudentAttendance() {

    const db = window.db;


    if (!db) {

        throw new Error(
            "Firestore unavailable."
        );

    }


    attendanceHistoryMap = {};


    const attendanceCollection =
        db
            .collection("saas_libraries")
            .doc(studentDashboardLibraryId)
            .collection("attendance");


    /*
     * Get all attendance DATE documents
     * belonging to this library.
     */

    const attendanceDatesSnapshot =
        await attendanceCollection.get();


    console.log(
        "[Student Attendance] Date documents found:",
        attendanceDatesSnapshot.size
    );


    /*
     * Check every attendance date.
     */

    for (
        const attendanceDateDoc
        of attendanceDatesSnapshot.docs
    ) {

        /*
         * IMPORTANT:
         *
         * Use Firebase document ID as the date.
         *
         * Example:
         * 2026-08-09
         */

        const dateId =
            String(
                attendanceDateDoc.id || ""
            ).trim();


        if (!isValidAttendanceDate(dateId)) {

            continue;

        }


        /*
         * Read ONLY:
         *
         * records/{logged-in-student-code}
         */

        const recordSnapshot =
            await attendanceCollection
                .doc(dateId)
                .collection("records")
                .doc(studentDashboardCode)
                .get();


        /*
         * No attendance for this student on this date.
         */

        if (!recordSnapshot.exists) {

            continue;

        }


        const recordData =
            recordSnapshot.data() || {};


        /*
         * Extra student-code safety.
         */

        const recordStudentCode =
            String(
                recordData.studentCode || ""
            ).trim();


        if (
            recordStudentCode !==
            studentDashboardCode
        ) {

            continue;

        }


        /*
         * Shift safety.
         *
         * Only reject when BOTH values exist
         * and they actually differ.
         */

        const studentShift =
            String(
                studentDashboardData?.shift || ""
            ).trim();


        const attendanceShift =
            String(
                recordData.shift || ""
            ).trim();


        if (
            studentShift &&
            attendanceShift &&
            studentShift !== attendanceShift
        ) {

            console.warn(
                "[Student Attendance] Shift mismatch:",
                dateId,
                studentShift,
                attendanceShift
            );

            continue;

        }


        /*
         * Normalize status.
         */

        const rawStatus =
            String(
                recordData.status || ""
            ).trim()
            .toLowerCase();


        let normalizedStatus = "";


        if (rawStatus === "present") {

            normalizedStatus = "Present";

        }


        if (rawStatus === "absent") {

            normalizedStatus = "Absent";

        }


        if (!normalizedStatus) {

            continue;

        }


        /*
         * IMPORTANT:
         *
         * Always use Firebase DATE DOCUMENT ID.
         *
         * This avoids any date-format problem inside
         * recordData.date.
         */

        attendanceHistoryMap[dateId] = {

            status:
                normalizedStatus,

            shift:
                attendanceShift,

            date:
                dateId

        };


        console.log(
            "[Student Attendance] Loaded:",
            dateId,
            normalizedStatus
        );

    }


    console.log(
        "[Student Attendance] Final Map:",
        attendanceHistoryMap
    );


    updateAttendanceTotals();

}


/**
 * ==========================================================================
 * VALIDATE FIREBASE ATTENDANCE DATE
 * ==========================================================================
 */

function isValidAttendanceDate(value) {

    const match =
        String(value || "").match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );


    if (!match) {
        return false;
    }


    const year =
        Number(match[1]);

    const month =
        Number(match[2]);

    const day =
        Number(match[3]);


    if (
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
    ) {

        return false;

    }


    const testDate =
        new Date(
            year,
            month - 1,
            day
        );


    return (
        testDate.getFullYear() === year &&
        testDate.getMonth() === month - 1 &&
        testDate.getDate() === day
    );

}


/**
 * ==========================================================================
 * ATTENDANCE TOTALS
 * ==========================================================================
 */

function updateAttendanceTotals() {

    let presentCount = 0;
    let absentCount = 0;


    Object.keys(
        attendanceHistoryMap
    ).forEach((date) => {

        const status =
            attendanceHistoryMap[date]?.status;


        if (status === "Present") {

            presentCount++;

        }


        if (status === "Absent") {

            absentCount++;

        }

    });


    setText(
        "total-present",
        presentCount
    );


    setText(
        "total-absent",
        absentCount
    );

}


/**
 * ==========================================================================
 * RENDER ATTENDANCE CALENDAR
 * ==========================================================================
 */

function renderAttendanceCalendar() {

    const calendar =
        document.getElementById(
            "attendance-calendar"
        );

    const title =
        document.getElementById(
            "calendar-month-title"
        );


    if (!calendar || !title) {

        return;

    }


    const year =
        attendanceMonthCursor.getFullYear();


    const month =
        attendanceMonthCursor.getMonth();


    const monthName =
        attendanceMonthCursor.toLocaleString(
            "en-IN",
            {
                month: "long"
            }
        );


    title.textContent =
        `${monthName} ${year}`;


    /*
     * First weekday of month.
     */

    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    /*
     * Number of days in month.
     */

    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    let html = "";


    /*
     * Empty cells before day 1.
     */

    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        html += `
            <div class="calendar-day empty"></div>
        `;

    }


    const today =
        new Date();


    /*
     * Render every date.
     */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const monthString =
            String(month + 1)
                .padStart(2, "0");


        const dayString =
            String(day)
                .padStart(2, "0");


        /*
         * EXACT same format as Firebase:
         *
         * 2026-08-09
         */

        const dateKey =
            `${year}-${monthString}-${dayString}`;


        const attendance =
            attendanceHistoryMap[dateKey];


        let statusHtml = "";


        /*
         * PRESENT
         */

        if (
            attendance &&
            attendance.status === "Present"
        ) {

            statusHtml = `
                <span class="calendar-status present">
                    Present
                </span>
            `;

        }


        /*
         * ABSENT
         */

        else if (
            attendance &&
            attendance.status === "Absent"
        ) {

            statusHtml = `
                <span class="calendar-status absent">
                    Absent
                </span>
            `;

        }


        const isToday =
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day;


        html += `
            <div
                class="calendar-day ${isToday ? "today" : ""}"
                data-date="${dateKey}"
                title="${formatDisplayDate(dateKey)}"
            >

                <span class="calendar-day-number">
                    ${day}
                </span>

                ${statusHtml}

            </div>
        `;

    }


    calendar.innerHTML =
        html;

}


/**
 * ==========================================================================
 * LOAD STUDENT NOTICES
 * ==========================================================================
 */

async function loadStudentNotices() {

    const db =
        window.db;


    const noticeContainer =
        document.getElementById(
            "student-notice-list"
        );


    if (!noticeContainer) {

        return;

    }


    if (!db) {

        noticeContainer.innerHTML = `
            <div class="empty-message">
                Unable to connect to the notice system.
            </div>
        `;

        return;

    }


    try {

        const noticesSnapshot =
            await db
                .collection("saas_libraries")
                .doc(studentDashboardLibraryId)
                .collection("notices")
                .get();


        if (noticesSnapshot.empty) {

            noticeContainer.innerHTML = `
                <div class="empty-message">
                    No notices available right now.
                </div>
            `;

            return;

        }


        const notices = [];


        noticesSnapshot.forEach((doc) => {

            const data =
                doc.data() || {};


            notices.push({

                id:
                    doc.id,

                title:
                    data.title ||
                    "Library Notice",

                message:
                    data.message ||
                    "",

                createdAt:
                    data.createdAt ||
                    null,

                updatedAt:
                    data.updatedAt ||
                    null

            });

        });


        notices.sort(
            (a, b) => {

                const aTime =
                    getTimestampMillis(
                        a.createdAt
                    ) ||
                    getTimestampMillis(
                        a.updatedAt
                    ) ||
                    0;


                const bTime =
                    getTimestampMillis(
                        b.createdAt
                    ) ||
                    getTimestampMillis(
                        b.updatedAt
                    ) ||
                    0;


                return bTime - aTime;

            }
        );


        noticeContainer.innerHTML =
            notices
                .map(
                    (notice) => {

                        return `
                            <div class="notice-item">

                                <h3>
                                    ${escapeHtml(
                                        notice.title
                                    )}
                                </h3>

                                <p>
                                    ${escapeHtml(
                                        notice.message
                                    )}
                                </p>

                                <span class="notice-date">
                                    ${escapeHtml(
                                        formatNoticeDate(
                                            notice.createdAt,
                                            notice.updatedAt
                                        )
                                    )}
                                </span>

                            </div>
                        `;

                    }
                )
                .join("");


    } catch (error) {

        console.error(
            "[Student Notice Read Error]:",
            error
        );


        noticeContainer.innerHTML = `
            <div class="empty-message">
                Unable to load notices.
            </div>
        `;

    }

}


/**
 * ==========================================================================
 * LOGOUT
 * ==========================================================================
 */

function studentPortalLogout() {

    localStorage.removeItem(
        "session_role"
    );

    localStorage.removeItem(
        "session_user_code"
    );

    localStorage.removeItem(
        "session_student_seat"
    );

    localStorage.removeItem(
        "session_library_id"
    );

    localStorage.removeItem(
        "session_library_name"
    );


    window.location.href =
        "../index.html";

}


/**
 * ==========================================================================
 * DATE DISPLAY
 *
 * Firebase:
 * YYYY-MM-DD
 *
 * Website:
 * DD/MM/YYYY
 * ==========================================================================
 */

function formatDisplayDate(value) {

    const dateString =
        String(
            value == null
                ? ""
                : value
        ).trim();


    if (!dateString) {

        return "";

    }


    const parts =
        dateString.split("-");


    if (parts.length === 3) {

        const year =
            parts[0];

        const month =
            parts[1];

        const day =
            parts[2];


        if (
            year.length === 4 &&
            month.length >= 1 &&
            day.length >= 1
        ) {

            return (
                `${day.padStart(2, "0")}/` +
                `${month.padStart(2, "0")}/` +
                `${year}`
            );

        }

    }


    return dateString;

}


/**
 * ==========================================================================
 * FIREBASE TIMESTAMP
 * ==========================================================================
 */

function getTimestampMillis(value) {

    if (!value) {

        return null;

    }


    if (
        typeof value.toMillis ===
        "function"
    ) {

        return value.toMillis();

    }


    if (
        typeof value.toDate ===
        "function"
    ) {

        const date =
            value.toDate();


        return (
            date instanceof Date &&
            !Number.isNaN(
                date.getTime()
            )
        )
            ? date.getTime()
            : null;

    }


    if (value.seconds) {

        return (
            value.seconds * 1000
        ) +
        Math.floor(
            (value.nanoseconds || 0) /
            1000000
        );

    }


    return null;

}


/**
 * ==========================================================================
 * NOTICE DATE FORMAT
 * ==========================================================================
 */

function formatNoticeDate(
    createdAt,
    updatedAt
) {

    const source =
        createdAt || updatedAt;


    if (!source) {

        return "Recently";

    }


    let date = null;


    if (
        typeof source.toDate ===
        "function"
    ) {

        date =
            source.toDate();

    }

    else if (
        source.seconds
    ) {

        date =
            new Date(
                source.seconds * 1000
            );

    }


    if (
        !date ||
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Recently";

    }


    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/**
 * ==========================================================================
 * SAFE TEXT
 * ==========================================================================
 */

function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            value == null
                ? "-"
                : value;

    }

}


/**
 * ==========================================================================
 * HTML ESCAPE
 * ==========================================================================
 */

function escapeHtml(value) {

    return String(
        value == null
            ? ""
            : value
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#x27;"
        );

}
