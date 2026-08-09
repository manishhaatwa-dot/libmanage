/**
 * ==========================================================================
 * LIBMANAGE - STUDENT DASHBOARD
 * READ ONLY STUDENT PORTAL
 *
 * DATA SOURCE:
 * saas_libraries/{libraryId}/students/{studentCode}
 *
 * ATTENDANCE:
 * saas_libraries/{libraryId}/attendance/{date}/records/{studentCode}
 *
 * NOTICES:
 * saas_libraries/{libraryId}/notices/{noticeId}
 *
 * STUDENT SIDE HAS NO WRITE / UPDATE / DELETE OPERATIONS.
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

    studentDashboardLibraryId =
        localStorage.getItem("session_library_id") || "";

    studentDashboardCode =
        localStorage.getItem("session_user_code") || "";


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
 * DISPLAY LOGIN IDs
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

    const db =
        window.db;


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


    const storedLibraryId =
        String(
            studentDashboardData.libraryId || ""
        );


    const storedStudentCode =
        String(
            studentDashboardData.studentCode || ""
        );


    if (
        storedLibraryId &&
        storedLibraryId !==
            String(studentDashboardLibraryId)
    ) {

        console.error(
            "[Student Security Context Mismatch] Library ID mismatch."
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
            String(studentDashboardCode)
    ) {

        console.error(
            "[Student Security Context Mismatch] Student Code mismatch."
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
 * LOAD ATTENDANCE
 *
 * ONLY CURRENT STUDENT RECORD IS READ.
 *
 * FIRESTORE:
 * saas_libraries/{libraryId}/attendance/{date}/records/{studentCode}
 *
 * IMPORTANT:
 * Student side performs READ ONLY.
 * ==========================================================================
 */

async function loadStudentAttendance() {

    const db =
        window.db;


    if (!db) {

        throw new Error(
            "Firestore unavailable."
        );

    }


    attendanceHistoryMap = {};


    const attendanceRef =
        db
            .collection("saas_libraries")
            .doc(studentDashboardLibraryId)
            .collection("attendance");


    try {

        /*
         * Get all attendance date documents
         * belonging ONLY to this library.
         */

        const attendanceDatesSnapshot =
            await attendanceRef.get();


        /*
         * Read the CURRENT student's record
         * from every attendance date.
         */

        for (
            const attendanceDateDoc
            of attendanceDatesSnapshot.docs
        ) {

            const dateId =
                attendanceDateDoc.id;


            const recordSnapshot =
                await attendanceRef
                    .doc(dateId)
                    .collection("records")
                    .doc(studentDashboardCode)
                    .get();


            /*
             * No attendance record for this
             * student on this date.
             */

            if (!recordSnapshot.exists) {

                continue;

            }


            const recordData =
                recordSnapshot.data() || {};


            /*
             * STUDENT CODE SAFETY CHECK
             */

            const recordStudentCode =
                String(
                    recordData.studentCode || ""
                ).trim();


            if (
                recordStudentCode !==
                String(
                    studentDashboardCode
                ).trim()
            ) {

                continue;

            }


            /*
             * LIBRARY SAFETY CHECK
             */

            if (
                recordData.libraryId &&
                String(
                    recordData.libraryId
                ).trim() !==
                String(
                    studentDashboardLibraryId
                ).trim()
            ) {

                continue;

            }


            /*
             * SHIFT SAFETY CHECK
             */

            if (
                studentDashboardData &&
                studentDashboardData.shift &&
                recordData.shift &&
                String(
                    recordData.shift
                ).trim() !==
                String(
                    studentDashboardData.shift
                ).trim()
            ) {

                continue;

            }


            /*
             * Attendance date.
             *
             * Firestore:
             * 2026-08-09
             */

            const attendanceDate =
                String(
                    recordData.date ||
                    dateId
                ).trim();


            /*
             * Attendance status.
             */

            const attendanceStatus =
                String(
                    recordData.status || ""
                ).trim();


            /*
             * Only Present / Absent records
             * are displayed.
             */

            if (
                attendanceStatus !== "Present" &&
                attendanceStatus !== "Absent"
            ) {

                continue;

            }


            /*
             * SAVE INTO STUDENT'S OWN
             * ATTENDANCE HISTORY MAP.
             */

            attendanceHistoryMap[
                attendanceDate
            ] = {

                status:
                    attendanceStatus,

                shift:
                    recordData.shift || "",

                date:
                    attendanceDate

            };

        }


        /*
         * Update totals.
         */

        updateAttendanceTotals();


        /*
         * Render calendar after Firebase
         * attendance data has loaded.
         */

        renderAttendanceCalendar();


        console.log(
            "[Student Attendance Loaded Successfully]",
            {
                libraryId:
                    studentDashboardLibraryId,

                studentCode:
                    studentDashboardCode,

                attendance:
                    attendanceHistoryMap
            }
        );


    } catch (error) {

        console.error(
            "[Student Attendance Read Error]:",
            error
        );

    }

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
            attendanceHistoryMap[date].status;


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


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    let html = "";


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
         * Firebase date format:
         * YYYY-MM-DD
         */

        const dateKey =
            `${year}-${monthString}-${dayString}`;


        const attendance =
            attendanceHistoryMap[
                dateKey
            ];


        let statusHtml = "";


        /*
         * PRESENT = GREEN
         */

        if (
            attendance &&
            attendance.status === "Present"
        ) {

            statusHtml = `
                <span
                    class="calendar-status present"
                    style="
                        display:inline-block;
                        margin-top:4px;
                        padding:3px 6px;
                        border-radius:5px;
                        background:#16a34a;
                        color:#ffffff;
                        font-size:0.7rem;
                        font-weight:700;
                    "
                >
                    Present
                </span>
            `;

        }


        /*
         * ABSENT = RED
         */

        if (
            attendance &&
            attendance.status === "Absent"
        ) {

            statusHtml = `
                <span
                    class="calendar-status absent"
                    style="
                        display:inline-block;
                        margin-top:4px;
                        padding:3px 6px;
                        border-radius:5px;
                        background:#dc2626;
                        color:#ffffff;
                        font-size:0.7rem;
                        font-weight:700;
                    "
                >
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
 *
 * READ ONLY
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


        if (
            noticesSnapshot.empty
        ) {

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

                id: doc.id,

                title:
                    data.title || "Library Notice",

                message:
                    data.message || "",

                createdAt:
                    data.createdAt || null,

                updatedAt:
                    data.updatedAt || null

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
            notices.map(
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
            ).join("");


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
 * Firebase keeps:
 * YYYY-MM-DD
 *
 * Website displays:
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


        return date instanceof Date &&
            !Number.isNaN(
                date.getTime()
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

    } else if (
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
