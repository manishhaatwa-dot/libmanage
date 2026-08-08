const db = firebase.firestore();

let currentActiveBranchId = "";
let seatStudents = [];

document.addEventListener("DOMContentLoaded", async () => {

    if (sessionStorage.getItem("session_role") !== "admin") {
        window.location.href = "../index.html";
        return;
    }

    currentActiveBranchId =
        sessionStorage.getItem("session_library_id");

   await loadSeatStudents();
setupSeatRealtimeListener();

    const searchInput =
        document.getElementById("seat-search-input");

    if (searchInput) {
        searchInput.addEventListener(
            "input",
            filterSeatGrid
        );
    }

});
async function loadSeatStudents() {

    try {

        const snapshot = await db
            .collection("saas_libraries")
            .doc(currentActiveBranchId)
            .collection("students")
            .get();

        seatStudents = [];

        snapshot.forEach((doc) => {

            const student = doc.data();

            if (student.seatNumber) {
                seatStudents.push(student);
            }

        });

        renderSeatGrid();

    } catch (error) {

        console.error("Seat Student Load Error:", error);

        alert("Unable to load library seat data.");

    }

}
function renderSeatGrid() {

    const seatGrid = document.getElementById("seat-grid");

    if (!seatGrid) return;

    seatGrid.innerHTML = "";

    seatStudents.forEach((student) => {

        const seat = document.createElement("div");

        seat.className = "seat-card occupied";
        makeSeatCardClickable(seat, student);

        seat.innerHTML = `
            <div class="seat-number">
                ${student.seatNumber}
            </div>

            <div class="seat-status">
                Occupied
            </div>

            <div class="seat-student-name">
                ${student.name}
            </div>
        `;

        seatGrid.appendChild(seat);

    });

    updateSeatSummary();

}
function updateSeatSummary() {

    const totalSeats =
        document.getElementById("total-seats-count");

    const availableSeats =
        document.getElementById("available-seats-count");

    const occupiedSeats =
        document.getElementById("occupied-seats-count");

    const occupiedCount = seatStudents.length;

    if (occupiedSeats) {
        occupiedSeats.innerText = occupiedCount;
    }

    if (totalSeats) {
        totalSeats.innerText = occupiedCount;
    }

    if (availableSeats) {
        availableSeats.innerText = 0;
    }

}
function filterSeatGrid(event) {

    const searchText =
        String(event?.target?.value || "")
            .toLowerCase()
            .trim();

    if (!searchText) {
        renderSeatGrid();
        return;
    }

    const filteredStudents = seatStudents.filter((student) => {

        const seatNumber =
            String(student.seatNumber || "").toLowerCase();

        const studentName =
            String(student.name || "").toLowerCase();

        const studentCode =
            String(student.studentCode || "").toLowerCase();

        return (
            seatNumber.includes(searchText) ||
            studentName.includes(searchText) ||
            studentCode.includes(searchText)
        );

    });

    renderFilteredSeatGrid(filteredStudents);

}

function renderFilteredSeatGrid(students) {

    const seatGrid =
        document.getElementById("seat-grid");

    if (!seatGrid) return;

    seatGrid.innerHTML = "";

    students.forEach((student) => {

        const seat = document.createElement("div");

        seat.className = "seat-card occupied";
        makeSeatCardClickable(seat, student);

        seat.innerHTML = `
            <div class="seat-number">
                ${student.seatNumber}
            </div>

            <div class="seat-status">
                Occupied
            </div>

            <div class="seat-student-name">
                ${student.name}
            </div>
        `;

        seatGrid.appendChild(seat);

    });

}

function setupSeatRealtimeListener() {

    db.collection("saas_libraries")
        .doc(currentActiveBranchId)
        .collection("students")
        .onSnapshot((snapshot) => {

            seatStudents = [];

            snapshot.forEach((doc) => {

                const student = doc.data();

                if (student.seatNumber) {
                    seatStudents.push(student);
                
                }
             document.addEventListener("DOMContentLoaded", () => {

    const availableCard =
        document.getElementById("available-seats-card");

    if (availableCard) {
        availableCard.addEventListener(
            "click",
            toggleShiftAvailability
        );
    }

});


function toggleShiftAvailability() {

    const container =
        document.getElementById("shift-availability-content");

    if (!container) return;

    if (container.classList.contains("show")) {

        container.classList.remove("show");
        container.innerHTML = "";

        return;
    }

    renderShiftAvailability();

    container.classList.add("show");

}


function renderShiftAvailability() {

    const container =
        document.getElementById("shift-availability-content");

    if (!container) return;

    const shifts = [
        "Morning",
        "Afternoon",
        "Evening"
    ];

    container.innerHTML = shifts.map((shift) => {

        const occupied =
            seatStudents.filter(
                (student) => student.shift === shift
            ).length;

        return `
            <div class="shift-availability-row">

                <strong>${shift}</strong>

                <span>
                    Occupied: ${occupied}
                </span>

                <span>
                    Available: Capacity not set
                </span>

            </div>
        `;

    }).join("");

}

            });

            renderSeatGrid();

        }, (error) => {

            console.error(
                "Seat Realtime Listener Error:",
                error
            );

        });

}
function openSeatStudentProfile(studentCode) {

    const student = seatStudents.find(
        (item) => item.studentCode === studentCode
    );

    if (!student) return;

    alert(
        "Student: " + student.name +
        "\nSeat: " + student.seatNumber +
        "\nCode: " + student.studentCode +
        "\nShift: " + (student.shift || "Not Assigned")
    );

}
function makeSeatCardClickable(seat, student) {

    seat.addEventListener("click", () => {

        openSeatStudentProfile(student.studentCode);

    });

}
