/**
 * ==========================================================================
 * LIBMANAGE SAAS ECOSYSTEM ENGINE - STUDENT CRUD & AUTOMATIC SUBCOLLECTION UID
 * ==========================================================================
 */

// Centralized Hook reference from shared instance models
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session integrity validation check
    if (sessionStorage.getItem('session_role') !== 'admin') {
        window.location.href = "../index.html";
        return;
    }

    // 2. Load shared layout shells synchronous frameworks templates fetch channels
    await loadSaaSLayoutComponent('sidebar-container', '../components/sidebar.html', () => handleSidebarActivation());
    await loadSaaSLayoutComponent('navbar-container', '../components/navbar.html', () => bindNavbarInteractions());
    await loadSaaSLayoutComponent('footer-container', '../components/footer.html');

    initializeStudentDirectoryModule();
});

let currentActiveBranchId = "";
let localBranchStudentsArray = [];

function initializeStudentDirectoryModule() {
    currentActiveBranchId = sessionStorage.getItem('session_library_id');

    // Bind layout elements triggers references variables hooks
    const searchInput = document.getElementById('student-search-input');
    const openModalBtn = document.getElementById('open-add-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    const registrationForm = document.getElementById('student-form');

    if (searchInput) searchInput.addEventListener('input', executeStudentDirectorySearchFilter);
    if (openModalBtn) openModalBtn.addEventListener('click', () => triggerStudentFormModalOpen());
    if (closeModalBtn) closeModalBtn.addEventListener('click', triggerStudentFormModalClose);
    if (cancelFormBtn) cancelFormBtn.addEventListener('click', triggerStudentFormModalClose);
    if (registrationForm) registrationForm.addEventListener('submit', commitStudentDirectoryMutationAction);

    // 3. Connect Realtime Firestore Listener to stream this branch's subcollection directly
    db.collection("saas_libraries")
      .doc(currentActiveBranchId)
      .collection("students")
      .onSnapshot((snapshot) => {
          localBranchStudentsArray = [];
          snapshot.forEach((doc) => {
              // Ignore the layout anchor node safely during table renders
              if (doc.id !== "anchor_node") {
                  localBranchStudentsArray.push(doc.data());
              }
          });
          // Paint fresh database state down to table container grid
          paintStudentDirectoryTableGrid(localBranchStudentsArray);
      }, (error) => {
          console.error("[Firestore Student Subcollection Stream Fault]:", error);
      });
}

/**
 * Renders dataset directly onto data table nodes spaces loops
 */
function paintStudentDirectoryTableGrid(dataset) {
    const tableBody = document.getElementById('students-table-rows');
    if (!tableBody) return;

    if (dataset.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="table-empty" style="text-align:center; padding:2rem; font-style:italic; color:var(--text-muted);">No student records found under this library branch subcollection.</td></tr>`;
        return;
    }

    tableBody.innerHTML = dataset.map((student) => {
        const tagStatusHueClass = student.status === 'Active' ? 'active' : 'expired';

        return `
            <tr>
                <td><code style="font-weight:700; color:var(--primary-color); font-size:0.9rem;">${student.studentCode}</code></td>
                <td><strong>${student.seatNumber.toUpperCase()}</strong></td>
                <td><strong>${student.name}</strong></td>
                <td>${student.fatherName}</td>
                <td><span style="background:rgba(0,0,0,0.03); padding:0.2rem 0.4rem; border-radius:4px; font-weight:500;">${student.studentClass}</span></td>
                <td>${student.joiningDate}</td>
                <td>${student.expiryDate}</td>
                <td><span class="status-tag ${tagStatusHueClass}">${student.status}</span></td>
                <td>
                    <div class="actions-cell-wrapper">
                        <button class="action-icon-btn edit-btn" onclick="routeProfileToEditPipeline('${student.studentCode}')" title="Modify Profile Options">??</button>
                        <button class="action-icon-btn delete-btn" onclick="routeProfileToDeletePipeline('${student.studentCode}')" title="Purge Record completely">???</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Toggles Form overlays visibility windows controls states parameters
 */
function triggerStudentFormModalOpen(isEditMode = false) {
    const modal = document.getElementById('student-modal');
    const titleNode = document.getElementById('modal-title-context');
    const displayCodeBlock = document.getElementById('modal-code-display-block');

    if (!modal) return;

    if (!isEditMode) {
        document.getElementById('student-form').reset();
        document.getElementById('form-edit-index').value = "";
        document.getElementById('form-student-code').value = "";
        if (titleNode) titleNode.innerText = "Register New Library Member";
        if (displayCodeBlock) displayCodeBlock.classList.add('hide-element');
    } else {
        if (titleNode) titleNode.innerText = "Modify Member Registration Profile";
        if (displayCodeBlock) displayCodeBlock.classList.remove('hide-element');
    }

    modal.classList.add('active');
}

function triggerStudentFormModalClose() {
    const modal = document.getElementById('student-modal');
    if (modal) modal.classList.remove('active');
}

/**
 * CORE MULTI-TENANT CRUD MUTATOR CONTROLLER - Performs strict WRITE operations on target subcollections
 */
async function commitStudentDirectoryMutationAction(event) {
    event.preventDefault();

    const editIndexRawValue = document.getElementById('form-edit-index').value; 
    const existingStudentCode = document.getElementById('form-student-code').value;

    const name = document.getElementById('std-name').value.trim();
    const fatherName = document.getElementById('std-father').value.trim();
    const studentClass = document.getElementById('std-class').value.trim();
    const seatNumber = document.getElementById('std-seat').value.trim().toUpperCase();
    const joiningDate = document.getElementById('std-joining').value;
    const expiryDate = document.getElementById('std-expiry').value;
    const status = document.getElementById('std-status').value;

    // Verify duplicate seat conflicts across local memory array mirrored from cloud streams
    const isSeatOccupiedConflict = localBranchStudentsArray.some((std) => {
        if (existingStudentCode !== "" && std.studentCode === existingStudentCode) return false;
        return std.seatNumber.toUpperCase() === seatNumber;
    });

    if (isSeatOccupiedConflict) {
        alert(`Validation Conflict: Seat "${seatNumber}" is currently assigned to another active record within this library network cluster node.`);
        return;
    }

    let finalStudentUniqueTokenCode = existingStudentCode;

    if (editIndexRawValue === "") {
        // CREATE OPERATION: Automatic Unique Code Matrix Generation
        const shortLibraryKeySegment = currentActiveBranchId.replace("LIB-", "").substring(0, 4);
        const randomEntropyString = Math.floor(100 + Math.random() * 900); 
        finalStudentUniqueTokenCode = `${shortLibraryKeySegment}-${seatNumber}-${randomEntropyString}`.toUpperCase();
    }

    const payloadStudentModel = {
        studentCode: finalStudentUniqueTokenCode, 
        libraryId: currentActiveBranchId,         
        name: name,
        fatherName: fatherName,
        studentClass: studentClass,
        seatNumber: seatNumber,
        joiningDate: joiningDate,
        expiryDate: expiryDate,
        status: status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        // FIRESTORE WRITE: Save or update document straight inside library's student subcollection path
        await db.collection("saas_libraries")
                .doc(currentActiveBranchId)
                .collection("students")
                .doc(finalStudentUniqueTokenCode)
                .set(payloadStudentModel);

        console.log(`[Firestore SUCCESS]: Student document written successfully -> ${finalStudentUniqueTokenCode}`);
        triggerStudentFormModalClose();

    } catch (error) {
        console.error("[Firestore Student Write Operation Fault]:", error);
        alert("Cloud transaction write failed. Check internet parameters link or Firestore Rules configuration.");
    }
}

/**
 * Maps document target element parameters into modals form rows fields
 */
window.routeProfileToEditPipeline = function(studentCodeToken) {
    const profileObj = localBranchStudentsArray.find(s => s.studentCode === studentCodeToken);
    if (!profileObj) return;

    document.getElementById('form-edit-index').value = "TRUE"; // Flag edit transaction channel
    document.getElementById('form-student-code').value = profileObj.studentCode;

    document.getElementById('std-name').value = profileObj.name;
    document.getElementById('std-father').value = profileObj.fatherName;
    document.getElementById('std-class').value = profileObj.studentClass;
    document.getElementById('std-seat').value = profileObj.seatNumber;
    document.getElementById('std-joining').value = profileObj.joiningDate;
    document.getElementById('std-expiry').value = profileObj.expiryDate;
    document.getElementById('std-status').value = profileObj.status;

    if (document.getElementById('lbl-display-unique-token')) {