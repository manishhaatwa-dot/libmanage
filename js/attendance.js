const db = firebase.firestore();

let currentActiveBranchId = "";
let attendanceStudents = [];

document.addEventListener("DOMContentLoaded", () => {

    if (sessionStorage.getItem("session_role") !== "admin") {
        window.location.href = "../index.html";
        return;
    }

    currentActiveBranchId = sessionStorage.getItem("session_library_id");

    const today = new Date().toISOString().split("T")[0];
    document.getElementById("attendance-date").value = today;

    loadStudents();
    document
    .getElementById("attendance-shift")
    .addEventListener("change", loadStudents);

});
async function loadStudents() {

    try {

        const selectedShift =
            document.getElementById("attendance-shift")?.value || "";

        const snapshot = await db
            .collection("saas_libraries")
            .doc(currentActiveBranchId)
            .collection("students")
            .orderBy("studentCode")
            .get();

        attendanceStudents = [];

        snapshot.forEach((doc) => {

            const student = doc.data();

            if (
                !student.shift ||
                student.shift === selectedShift
            ) {
                attendanceStudents.push(student);
            }

        });

        renderAttendanceTable();

    } catch (error) {

        console.error("Load Students Error :", error);
        alert("Unable to load student list.");

    }

}

function renderAttendanceTable() {

    const tableBody = document.getElementById("attendance-table-body");

    tableBody.innerHTML = "";

    attendanceStudents.forEach((student) => {

        tableBody.innerHTML += `

        <tr>

            <td>${student.studentCode}</td>

            <td>${student.seatNumber}</td>

            <td>${student.name}</td>

            <td>
                <input
                    type="radio"
                    name="${student.studentCode}"
                    value="Present"
                    checked>
            </td>

            <td>
                <input
                    type="radio"
                    name="${student.studentCode}"
                    value="Absent">
            </td>

        </tr>

        `;

    });

}
document
    .getElementById("save-attendance-btn")
    .addEventListener("click", saveAttendance);

async function saveAttendance() {

    try {

        const attendanceDate =
            document.getElementById("attendance-date").value;

        const attendanceShift =
            document.getElementById("attendance-shift").value;

        if (!attendanceDate) {
            alert("Please select attendance date.");
            return;
        }

        if (!attendanceShift) {
            alert("Please select shift.");
            return;
        }

        const batch = db.batch();

        attendanceStudents.forEach((student) => {

            const selectedStatus = document.querySelector(
                `input[name="${student.studentCode}"]:checked`
            );

            const attendanceRef = db
                .collection("saas_libraries")
                .doc(currentActiveBranchId)
                .collection("attendance")
                .doc(attendanceDate)
                .collection("records")
                .doc(student.studentCode);

            batch.set(attendanceRef, {

                studentCode: student.studentCode,
                name: student.name,
                seatNumber: student.seatNumber,
                shift: attendanceShift,

                status: selectedStatus
                    ? selectedStatus.value
                    : "Absent",

                date: attendanceDate,

                updatedAt:
                    firebase.firestore.FieldValue.serverTimestamp()

            }, { merge: true });

        });

        await batch.commit();

        alert("Attendance saved successfully.");

    } catch (error) {

        console.error("Attendance Save Error :", error);

        alert("Failed to save attendance: " + error.message);

    }

}
