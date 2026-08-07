/**
 * ==========================================================================
 * LIBMANAGE SAAS ECOSYSTEM ENGINE - SEAT REASSIGNMENT SUBCOLLECTION CORE
 * ==========================================================================
 */

// Centralized Hook reference from shared instance models
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session identity gateway verification check
    if (sessionStorage.getItem('session_role') !== 'admin') {
        window.location.href = "../index.html";
        return;
    }

    // 2. Hydrate asynchronous UI shell layout components templates fetch scripts channels
    await loadSaaSLayoutComponent('sidebar-container', '../components/sidebar.html', () => handleSidebarActivation());
    await loadSaaSLayoutComponent('navbar-container', '../components/navbar.html', () => bindNavbarInteractions());
    await loadSaaSLayoutComponent('footer-container', '../components/footer.html');

    initializeSeatLayoutMatrixModule();
});

let currentTenantBranchId = "";
let branchStudentsDB = [];
let targetInspectedSeatTokenId = "";
let activeBranchCapacityLimit = 30; // Synchronized fallback placeholder limit

const alphabetRowsArray = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];

function initializeSeatLayoutMatrixModule() {
    currentTenantBranchId = sessionStorage.getItem('session_library_id');

    // Bind action events control triggers references elements hooks
    const closeBtn = document.getElementById('close-inspector-btn');
    const triggerReassignBtn = document.getElementById('trigger-reassign-btn');
    const cancelReassignBtn = document.getElementById('cancel-reassign-btn');
    const reassignmentForm = document.getElementById('reassign-form');

    if (closeBtn) closeBtn.addEventListener('click', closeSeatInspectorModalPanel);
    if (triggerReassignBtn) triggerReassignBtn.addEventListener('click', toggleInspectorToFormView);
    if (cancelReassignBtn) cancelReassignBtn.addEventListener('click', toggleInspectorToDetailsView);
    if (reassignmentForm) reassignmentForm.addEventListener('submit', commitSeatAllocationReassignmentAction);

    // 3. Connect Realtime Listener for Library Document to fetch manual strength limits dynamically
    db.collection("saas_libraries").doc(currentTenantBranchId).onSnapshot((libDoc) => {
        if (libDoc.exists) {
            activeBranchCapacityLimit = libDoc.data().totalSeats || 30;
        }
        
        // Nested subcollection real-time student listener setup configuration mapping
        db.collection("saas_libraries")
          .doc(currentTenantBranchId)
          .collection("students")
          .onSnapshot((snapshot) => {
              branchStudentsDB = [];
              snapshot.forEach((doc) => {
                  if (doc.id !== "anchor_node") {
                      branchStudentsDB.push(doc.data());
                  }
              });
              // Trigger matrix drawing routine loops straight after synchronizing collections
              buildAndDrawDynamicTenantSeatCanvasGrid();
          }, err => console.error("Firestore student streaming fault on seats:", err));
          
    }, err => console.error("Firestore root branch monitoring fault on seats:", err));
}

/**
 * Builds dynamic seat grid blocks precisely counting matching activeBranchCapacityLimit metrics
 */
function buildAndDrawDynamicTenantSeatCanvasGrid() {
    const canvasNode = document.getElementById('library-matrix-grid');
    if (!canvasNode) return;

    let compiledGridHTMLOutput = "";
    const todayTimestampValue = new Date().setHours(0, 0, 0, 0);
    const columnsPerDeskRowRule = 5;

    for (let currentCount = 1; currentCount <= activeBranchCapacityLimit; currentCount++) {
        const alphabeticRowIndexPointer = Math.floor((currentCount - 1) / columnsPerDeskRowRule);
        const columnDeskSeatNumber = ((currentCount - 1) % columnsPerDeskRowRule) + 1;
        
        const stringRowLetter = alphabetRowsArray[alphabeticRowIndexPointer] || 'Z';
        const finalSeatIdTokenCode = `${stringRowLetter}${columnDeskSeatNumber}`;

        const currentOccupantObj = branchStudentsDB.find(s => s.seatNumber.toUpperCase() === finalSeatIdTokenCode);

        let structuralTagClassClass = "available";
        let characterDisplayLabelName = "Available";

        if (currentOccupantObj) {
            const studentExpiryTimestampValue = new Date(currentOccupantObj.expiryDate).setHours(0, 0, 0, 0);
            
            if (currentOccupantObj.status === 'Expired' || studentExpiryTimestampValue < todayTimestampValue) {
                structuralTagClassClass = "expired";
                characterDisplayLabelName = currentOccupantObj.name;
            } else {
                structuralTagClassClass = "occupied";
                characterDisplayLabelName = currentOccupantObj.name;
            }
        }

        compiledGridHTMLOutput += `
            <div class="seat-unit ${structuralTagClassClass}" onclick="openSeatInspectorModalPanel('${finalSeatIdTokenCode}')">
                <span>${finalSeatIdTokenCode}</span>
                <span class="seat-occupant-lbl">${characterDisplayLabelName}</span>
            </div>
        `;
    }

    canvasNode.innerHTML = compiledGridHTMLOutput;
}

/**
 * Overlay View Control routers functions nodes
 */
window.openSeatInspectorModalPanel = function(seatId) {
    targetInspectedSeatTokenId = seatId;

    const overlay = document.getElementById('seat-inspector-modal');
    const labelNode = document.getElementById('inspect-seat-id');

    if (!overlay || !labelNode) return;
    labelNode.innerText = seatId;

    toggleInspectorToDetailsView();

    const allocatedStudentObj = branchStudentsDB.find(s => s.seatNumber.toUpperCase() === seatId);

    const nameNode = document.getElementById('inspect-student-name');
    const codeNode = document.getElementById('inspect-student-code');
    const fatherNode = document.getElementById('inspect-father-name');
    const classNode = document.getElementById('inspect-class');
    const expiryNode = document.getElementById('inspect-expiry-date');

    if (allocatedStudentObj) {
        nameNode.innerText = allocatedStudentObj.name;
        codeNode.innerText = allocatedStudentObj.studentCode;
        fatherNode.innerText = allocatedStudentObj.fatherName;
        classNode.innerText = allocatedStudentObj.studentClass;
        expiryNode.innerText = allocatedStudentObj.expiryDate;
    } else {
        nameNode.innerText = "Unoccupied Slot";
        codeNode.innerText = "-";
        fatherNode.innerText = "-";
        classNode.innerText = "-";
        expiryNode.innerText = "-";
    }

    populateUnallocatedCandidatesDropdownMenu();
    overlay.classList.add('active');
};

function closeSeatInspectorModalPanel() {
    const overlay = document.getElementById('seat-inspector-modal');
    if (overlay) overlay.classList.remove('active');
}

function toggleInspectorToFormView() {
    document.getElementById('seat-details-view').classList.remove('active');
    document.getElementById('seat-reassign-form-view').classList.add('active');
}

function toggleInspectorToDetailsView() {
    document.getElementById('seat-reassign-form-view').classList.remove('active');
    document.getElementById('seat-details-view').classList.add('active');
}

/**
 * Creates list variants matches unassigned registry profiles nodes inside tenant boundaries
 */
function populateUnallocatedCandidatesDropdownMenu() {
    const menuSelectNode = document.getElementById('student-dropdown-selector');
    if (!menuSelectNode) return;

    const unallocatedCandidatesArrayList = branchStudentsDB.filter(s => {
        return !s.seatNumber || s.seatNumber === "" || s.seatNumber.toUpperCase() === targetInspectedSeatTokenId;
    });

    let innerOptionsHTMLCompilation = `<option value="CLEAR_VACANT">-- LEAVE SEAT UNOCCUPIED / VACANT --</option>`;

    unallocatedCandidatesArrayList.forEach(student => {
        const currentSeatMarkerAddendum = student.seatNumber.toUpperCase() === targetInspectedSeatTokenId ? " (Current Tenant)" : "";
        innerOptionsHTMLCompilation += `<option value="${student.studentCode}">${student.name} [Code: ${student.studentCode}]${currentSeatMarkerAddendum}</option>`;
    });

    menuSelectNode.innerHTML = innerOptionsHTMLCompilation;
}

/**
 * CORE WRITE OPERATION PIPELINE - Commits seat alterations atomically to Firestore database subcollections paths
 */
async function commitSeatAllocationReassignmentAction(event) {
    event.preventDefault();

    const selectedTargetValueToken = document.getElementById('student-dropdown-selector').value;
    const subcollectionRef = db.collection("saas_libraries").doc(currentTenantBranchId).collection("students");

    try {
        // 1. Clear seat bindings from any student currently occupying this target seat slot
        let clearAllocationsBatchArray = branchStudentsDB.filter(s => s.seatNumber.toUpperCase() === targetInspectedSeatTokenId);
        
        for (const student of clearAllocationsBatchArray) {
            await subcollectionRef.doc(student.studentCode).update({ seatNumber: "" });
            console.log(`[Firestore SUCCESS]: Unlinked seat ${targetInspectedSeatTokenId} from student ${student.studentCode}`);
        }

        // 2. Bind the new student assignee if not freeing up the seat slot completely
        if (selectedTargetValueToken !== "CLEAR_VACANT") {
            await subcollectionRef.doc(selectedTargetValueToken).update({ seatNumber: targetInspectedSeatTokenId });
            console.log(`[Firestore SUCCESS]: Linked seat ${targetInspectedSeatTokenId} to student ${selectedTargetValueToken}`);
        }

        closeSeatInspectorModalPanel();

    } catch (error) {
        console.error("[Firestore Seat Allocation Modification Fault]:", error);