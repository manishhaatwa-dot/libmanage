/**
 * students.js
 * Improved version without changing architecture, IDs, login flow,
 * sessionStorage keys, Firestore structure, or dashboard workflow.
 */

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (sessionStorage.getItem('session_role') !== 'admin') {
            window.location.href = "../index.html";
            return;
        }

        await loadSaaSLayoutComponent('sidebar-container', '../components/sidebar.html', () => handleSidebarActivation());
        await loadSaaSLayoutComponent('navbar-container', '../components/navbar.html', () => bindNavbarInteractions());
        await loadSaaSLayoutComponent('footer-container', '../components/footer.html');

        initializeStudentDirectoryModule();
    } catch (error) {
        console.error('[students.js bootstrap error]:', error);
        alert('Unable to initialize student dashboard: ' + error.message);
    }
});

let currentActiveBranchId = "";
let localBranchStudentsArray = [];

function initializeStudentDirectoryModule() {
    try {
        currentActiveBranchId = sessionStorage.getItem('session_library_id');

        const db = firebase.firestore();

        const searchInput = document.getElementById('student-search-input');
        const openModalBtn = document.getElementById('open-add-modal-btn');
        const closeModalBtn = document.getElementById('close-modal-btn');
        const cancelFormBtn = document.getElementById('cancel-form-btn');
        const registrationForm = document.getElementById('student-form');
        const modal = document.getElementById('student-modal');

        if (searchInput) {
            searchInput.addEventListener('input', executeStudentDirectorySearchFilter);
        }

        if (openModalBtn) {
            openModalBtn.addEventListener('click', () => triggerStudentFormModalOpen(false));
        }

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', triggerStudentFormModalClose);
        }

        if (cancelFormBtn) {
            cancelFormBtn.addEventListener('click', triggerStudentFormModalClose);
        }

        if (registrationForm) {
            registrationForm.addEventListener('submit', commitStudentDirectoryMutationAction);
        }

        if (modal) {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    triggerStudentFormModalClose();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            const activeModal = document.getElementById('student-modal');
            if (event.key === 'Escape' && activeModal && activeModal.classList.contains('active')) {
                triggerStudentFormModalClose();
            }
        });

        db.collection("saas_libraries")
            .doc(currentActiveBranchId)
            .collection("students")
            .onSnapshot((snapshot) => {
                try {
                    localBranchStudentsArray = [];

                    snapshot.forEach((doc) => {
                        if (doc.id !== "anchor_node") {
                            const data = doc.data() || {};
                            localBranchStudentsArray.push({
                                ...data,
                                studentCode: data.studentCode || doc.id
                            });
                        }
                    });

                    paintStudentDirectoryTableGrid(localBranchStudentsArray);
                } catch (snapshotRenderError) {
                    console.error('[student snapshot render error]:', snapshotRenderError);
                }
            }, (error) => {
                console.error("[Firestore Student Subcollection Snapshot Stream Fault Exception]:", error);
                alert("Realtime student data stream failed: " + error.message);
            });
    } catch (error) {
        console.error('[initializeStudentDirectoryModule error]:', error);
        alert('Student module initialization failed: ' + error.message);
    }
}

function getStudentStatusClass(status) {
    const normalizedStatus = String(status || '').trim().toLowerCase();

    if (normalizedStatus === 'active') return 'status-active';
    if (normalizedStatus === 'expired') return 'status-expired';
    if (normalizedStatus === 'inactive') return 'status-inactive';
    if (normalizedStatus === 'pending') return 'status-pending';

    return 'status-default';
}

function escapeHtml(value) {
    const text = String(value ?? '');
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function paintStudentDirectoryTableGrid(dataset) {
    try {
        const tableBody = document.getElementById('students-table-rows');
        if (!tableBody) return;

        if (!Array.isArray(dataset) || dataset.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="table-empty">
                        No student records found for this library branch.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = dataset.map((student) => {
            const studentCode = escapeHtml(student.studentCode || '');
            const seatNumber = escapeHtml((student.seatNumber || '').toString().toUpperCase());
            const name = escapeHtml(student.name || '');
            const fatherName = escapeHtml(student.fatherName || '');
            const studentClass = escapeHtml(student.studentClass || '');
            const joiningDate = escapeHtml(student.joiningDate || '');
            const expiryDate = escapeHtml(student.expiryDate || '');
            const status = escapeHtml(student.status || 'Unknown');
            const statusClass = getStudentStatusClass(student.status);

            return `
                <tr>
                    <td>
                        <span class="student-code-text">${studentCode}</span>
                    </td>
                    <td>
                        <strong>${seatNumber}</strong>
                    </td>
                    <td>
                        <strong>${name}</strong>
                    </td>
                    <td>${fatherName}</td>
                    <td>
                        <span class="student-class-badge">${studentClass}</span>
                    </td>
                    <td>${joiningDate}</td>
                    <td>${expiryDate}</td>
                    <td>
                        <span class="status-tag ${statusClass}">${status}</span>
                    </td>
                    <td>
                        <div class="actions-cell-wrapper">
                            <button
                                type="button"
                                class="action-btn edit-btn"
                                onclick="routeProfileToEditPipeline('${studentCode}')"
                                title="Edit Student"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                class="action-btn delete-btn"
                                onclick="routeProfileToDeletePipeline('${studentCode}')"
                                title="Delete Student"
                            >
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('[paintStudentDirectoryTableGrid error]:', error);

        const tableBody = document.getElementById('students-table-rows');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="table-empty">
                        Failed to render student records.
                    </td>
                </tr>
            `;
        }
    }
}

function resetStudentFormFields() {
    try {
        const form = document.getElementById('student-form');
        if (form) form.reset();

        const formEditIndex = document.getElementById('form-edit-index');
        const formStudentCode = document.getElementById('form-student-code');
        const modalTitle = document.getElementById('modal-title-context');
        const displayCodeBlock = document.getElementById('modal-code-display-block');
        const displayCodeLabel = document.getElementById('lbl-display-unique-token');

        if (formEditIndex) formEditIndex.value = "";
        if (formStudentCode) formStudentCode.value = "";
        if (modalTitle) modalTitle.innerText = "Register New Library Member";
        if (displayCodeBlock) displayCodeBlock.classList.add('hide-element');
        if (displayCodeLabel) displayCodeLabel.innerText = "";
    } catch (error) {
        console.error('[resetStudentFormFields error]:', error);
    }
}

function triggerStudentFormModalOpen(isEditMode = false) {
    try {
        const modal = document.getElementById('student-modal');
        const titleNode = document.getElementById('modal-title-context');
        const displayCodeBlock = document.getElementById('modal-code-display-block');

        if (!modal) return;

        if (!isEditMode) {
            resetStudentFormFields();
        } else {
            if (titleNode) titleNode.innerText = "Modify Member Registration Profile";
            if (displayCodeBlock) displayCodeBlock.classList.remove('hide-element');
        }

        modal.classList.add('active');
        document.body.classList.add('modal-open');

        const firstInput =
            document.getElementById('std-name') ||
            document.querySelector('#student-form input, #student-form select, #student-form textarea');

        if (firstInput) {
            setTimeout(() => firstInput.focus(), 50);
        }
    } catch (error) {
        console.error('[triggerStudentFormModalOpen error]:', error);
        alert('Unable to open student form: ' + error.message);
    }
}

function triggerStudentFormModalClose() {
    try {
        const modal = document.getElementById('student-modal');
        if (!modal) return;

        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    } catch (error) {
        console.error('[triggerStudentFormModalClose error]:', error);
        alert('Unable to close student form: ' + error.message);
    }
}

async function generateNextStudentCode() {
    try {
        const numericIds = localBranchStudentsArray
            .map((student) => String(student.studentCode || '').trim().toUpperCase())
            .filter((code) => /^LIBd+$/.test(code))
            .map((code) => parseInt(code.replace('LIB', ''), 10))
            .filter((num) => !isNaN(num));

        let nextNumber = 1;

        if (numericIds.length > 0) {
            nextNumber = Math.max(...numericIds) + 1;
        }

        let nextCode = `LIB${String(nextNumber).padStart(3, '0')}`;

        const db = firebase.firestore();

        while (localBranchStudentsArray.some((student) => String(student.studentCode).toUpperCase() === nextCode)) {
            nextNumber += 1;
            nextCode = `LIB${String(nextNumber).padStart(3, '0')}`;
        }

        const existingDoc = await db.collection("saas_libraries")
            .doc(currentActiveBranchId)
            .collection("students")
            .doc(nextCode)
            .get();

        if (existingDoc.exists) {
            let safeCounter = nextNumber;
            let safeCode = nextCode;

            do {
                safeCounter += 1;
                safeCode = `LIB${String(safeCounter).padStart(3, '0')}`;
                const docCheck = await db.collection("saas_libraries")
                    .doc(currentActiveBranchId)
                    .collection("students")
                    .doc(safeCode)
                    .get();

                if (!docCheck.exists) {
                    return safeCode;
                }
            } while (true);
        }

        return nextCode;
    } catch (error) {
        console.error('[generateNextStudentCode error]:', error);
        throw error;
    }
}

async function commitStudentDirectoryMutationAction(event) {
    event.preventDefault();

    try {
        const db = firebase.firestore();

        const editIndexRawValue = document.getElementById('form-edit-index')?.value || "";
        const existingStudentCode = document.getElementById('form-student-code')?.value || "";

        const name = document.getElementById('std-name')?.value.trim() || "";
        const fatherName = document.getElementById('std-father')?.value.trim() || "";
        const studentClass = document.getElementById('std-class')?.value.trim() || "";
        const seatNumber = (document.getElementById('std-seat')?.value.trim() || "").toUpperCase();
        const joiningDate = document.getElementById('std-joining')?.value || "";
        const expiryDate = document.getElementById('std-expiry')?.value || "";
        const status = document.getElementById('std-status')?.value || "";

        if (!name || !fatherName || !studentClass || !seatNumber || !joiningDate || !expiryDate || !status) {
            alert('Please fill all required student fields before saving.');
            return;
        }

        // Validate Expired Membership Status
        if (new Date(expiryDate) < new Date() && status === "Active") {
            alert("Membership has already expired. Please change Status to 'Expired' or select a valid Expiry Date.");
            return;
        }

        const isSeatOccupiedConflict = localBranchStudentsArray.some((std) => {
            if (existingStudentCode !== "" && std.studentCode === existingStudentCode) return false;
            return String(std.seatNumber || '').toUpperCase() === seatNumber;
        });

        if (isSeatOccupiedConflict) {
            alert(`Validation Conflict: Seat "${seatNumber}" is already assigned to another student.`);
            return;
        }

        // Validate Membership Dates
        if (joiningDate > expiryDate) {
            alert("Expiry Date cannot be earlier than Joining Date.");
            return;
        }

        const isCreateMode = editIndexRawValue === "";
        let finalStudentUniqueTokenCode = existingStudentCode;
        const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();

        if (isCreateMode) {
            finalStudentUniqueTokenCode = await generateNextStudentCode();
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
            updatedAt: serverTimestamp
        };

        if (isCreateMode) {
            payloadStudentModel.createdAt = serverTimestamp;
        } else {
            const existingRecord = localBranchStudentsArray.find(
                (student) => student.studentCode === finalStudentUniqueTokenCode
            );

            if (existingRecord && existingRecord.createdAt) {
                payloadStudentModel.createdAt = existingRecord.createdAt;
            }
        }

        const studentRef = db.collection("saas_libraries")
            .doc(currentActiveBranchId)
            .collection("students")
            .doc(finalStudentUniqueTokenCode);

        if (isCreateMode) {
            await studentRef.set(payloadStudentModel);
        } else {
            await studentRef.set(payloadStudentModel, { merge: true });
        }

        console.log(`[Firestore Transaction SUCCESS]: Written student profile document -> ${finalStudentUniqueTokenCode}`);
        triggerStudentFormModalClose();
    } catch (error) {
        console.error("[Firestore Student Document Mutation Write Fault Error Exception]:", error);
        alert("Cloud write operations failure exception caught inside registry transaction channels: " + error.message);
    }
}

window.routeProfileToEditPipeline = function(studentCodeToken) {
    try {
        const profileObj = localBranchStudentsArray.find((student) => student.studentCode === studentCodeToken);
        if (!profileObj) {
            alert('Student profile not found for editing.');
            return;
        }

        const formEditIndex = document.getElementById('form-edit-index');
        const formStudentCode = document.getElementById('form-student-code');
        const stdName = document.getElementById('std-name');
        const stdFather = document.getElementById('std-father');
        const stdClass = document.getElementById('std-class');
        const stdSeat = document.getElementById('std-seat');
        const stdJoining = document.getElementById('std-joining');
        const stdExpiry = document.getElementById('std-expiry');
        const stdStatus = document.getElementById('std-status');
        const displayTokenLabel = document.getElementById('lbl-display-unique-token');

        if (formEditIndex) formEditIndex.value = "TRUE";
        if (formStudentCode) formStudentCode.value = profileObj.studentCode || "";

        if (stdName) stdName.value = profileObj.name || "";
        if (stdFather) stdFather.value = profileObj.fatherName || "";
        if (stdClass) stdClass.value = profileObj.studentClass || "";
        if (stdSeat) stdSeat.value = profileObj.seatNumber || "";
        if (stdJoining) stdJoining.value = profileObj.joiningDate || "";
        if (stdExpiry) stdExpiry.value = profileObj.expiryDate || "";
        if (stdStatus) stdStatus.value = profileObj.status || "";

        if (displayTokenLabel) {
            displayTokenLabel.innerText = profileObj.studentCode || "";
        }

        triggerStudentFormModalOpen(true);
    } catch (error) {
        console.error('[routeProfileToEditPipeline error]:', error);
        alert('Unable to load student profile for editing: ' + error.message);
    }
};

window.routeProfileToDeletePipeline = async function(studentCodeToken) {
    try {
        const db = firebase.firestore();

        if (!studentCodeToken) {
            alert('Invalid student code.');
            return;
        }

        const isConfirmed = confirm(
            `Are you sure you want to permanently delete student record "${studentCodeToken}"?`
        );

        if (!isConfirmed) return;

        await db.collection("saas_libraries")
            .doc(currentActiveBranchId)
            .collection("students")
            .doc(studentCodeToken)
            .delete();

        console.log(`[Firestore Transaction SUCCESS]: Purged student document from subcollection mapping registers -> ${studentCodeToken}`);
    } catch (error) {
        console.error("[Firestore Student Delete Transaction Path Operation Fault Exception]:", error);
        alert("Cloud write operations purge transaction failed: " + error.message);
    }
};

function executeStudentDirectorySearchFilter(event) {
    try {
        const criterionTextInput = String(event?.target?.value || '').toLowerCase().trim();

        if (criterionTextInput === "") {
            paintStudentDirectoryTableGrid(localBranchStudentsArray);
            return;
        }

        const filteredMatchOutputResultsArrayList = localBranchStudentsArray.filter((student) => {
            const name = String(student.name || '').toLowerCase();
            const fatherName = String(student.fatherName || '').toLowerCase();
            const studentCode = String(student.studentCode || '').toLowerCase();
            const seatNumber = String(student.seatNumber || '').toLowerCase();

            return (
                name.includes(criterionTextInput) ||
                fatherName.includes(criterionTextInput) ||
                studentCode.includes(criterionTextInput) ||
                seatNumber.includes(criterionTextInput)
            );
        });

        paintStudentDirectoryTableGrid(filteredMatchOutputResultsArrayList);
    } catch (error) {
        console.error('[executeStudentDirectorySearchFilter error]:', error);
    }
}

function handleSidebarActivation() {
    try {
        const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
        menuItems.forEach((item) => {
            if (item.getAttribute('data-page') === 'students') {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    } catch (error) {
        console.error('[handleSidebarActivation error]:', error);
    }
}

function bindNavbarInteractions() {
    try {
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebarPanel = document.querySelector('.sidebar-panel');
        const logoutBtn = document.getElementById('admin-logout-btn');
        const activeRouteText = document.getElementById('nav-active-title');
        const navLibraryName = document.getElementById('nav-library-name');

        if (activeRouteText) {
            activeRouteText.innerText = "Student Registry Records";
        }

        if (navLibraryName) {
            navLibraryName.innerText = sessionStorage.getItem('session_library_name') || '';
        }

        if (toggleBtn && sidebarPanel) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebarPanel.classList.toggle('open');
            });

            document.addEventListener('click', (e) => {
                if (!sidebarPanel.contains(e.target) && !toggleBtn.contains(e.target)) {
                    sidebarPanel.classList.remove('open');
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                try {
                    sessionStorage.clear();
                    window.location.href = "../index.html";
                } catch (error) {
                    console.error('[logout error]:', error);
                    alert('Logout failed: ' + error.message);
                }
            });
        }
    } catch (error) {
        console.error('[bindNavbarInteractions error]:', error);
    }
}

async function loadSaaSLayoutComponent(containerId, componentUrl, callback = null) {
    try {
        const container = document.getElementById(containerId);
        if (!container) return;

        const response = await fetch(componentUrl);
        if (!response.ok) {
            throw new Error(`HTTP Fault status: ${response.status}`);
        }

        container.innerHTML = await response.text();

        if (typeof callback === 'function') {
            callback();
        }
    } catch (err) {
        console.error("Component asset failure:", err);
    }
}
