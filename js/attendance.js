/**
 * ==========================================================================
 * LIBMANAGE SAAS ECOSYSTEM ENGINE - CORE CLOUD SUBCOLLECTION ATTENDANCE
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

    // 2. Load layout templates fetch channels components
    await loadSaaSLayoutComponent('sidebar-container', '../components/sidebar.html', () => handleSidebarActivation());
    await loadSaaSLayoutComponent('navbar-container', '../components/navbar.html', () => bindNavbarInteractions());
    await loadSaaSLayoutComponent('footer-container', '../components/footer.html');

    initializeAttendanceControlModule();
});

let currentBranchIdKey = "";
let branchFilteredStudentsArray = [];
const activeISOStringDayKey = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

function initializeAttendanceControlModule() {
    currentBranchIdKey = sessionStorage.getItem('session_library_id');

    // Print calendar marker contexts text fields labels
    const dateLabelNode = document.getElementById('marking-current-date');
    if (dateLabelNode) {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        dateLabelNode.innerText = new Date().toLocaleDateString('en-US', options);
    }

    // Register active toggles event listeners handlers hooks elements
    bindModuleControlsActionTriggers();

    // 3. Connect Realtime Firestore Student subcollection stream to capture live members list
    db.collection("saas_libraries")
      .doc(currentBranchIdKey)
      .collection("students")
      .onSnapshot((snapshot) => {
          branchFilteredStudentsArray = [];
          snapshot.forEach((doc) => {
              if (doc.id !== "anchor_node") {
                  branchFilteredStudentsArray.push(doc.data());
              }
          });
          
          // Refresh marking grid and aggregates instantly on stream updates
          renderDailyMarkingFormGrid();
          calculateAndRenderHistoricalReports();
      }, err => console.error("[Firestore Attendance Students Stream Fault]:", err));
}

function bindModuleControlsActionTriggers() {
    const tabMark = document.getElementById('tab-mark-trigger');
    const tabHistory = document.getElementById('tab-history-trigger');
    const secMark = document.getElementById('section-mark-attendance');
    const secHistory = document.getElementById('section-attendance-history');

    const filterPreset = document.getElementById('history-preset-filter');
    const customDateContainer = document.getElementById('custom-date-inputs');
    const customDateInput = document.getElementById('history-custom-date');
    const searchFilterInput = document.getElementById('history-student-search');

    if (tabMark && tabHistory && secMark && secHistory) {
        tabMark.addEventListener('click', () => {
            tabMark.classList.add('active');
            tabHistory.classList.remove('active');
            secMark.add('display-active');
            secHistory.classList.remove('display-active');
            renderDailyMarkingFormGrid();
        });

        tabHistory.addEventListener('click', () => {
            tabHistory.classList.add('active');
            tabMark.classList.remove('active');
            secHistory.classList.add('display-active');
            secMark.classList.remove('display-active');
            calculateAndRenderHistoricalReports();
        });
    }

    if (filterPreset && customDateContainer) {
        filterPreset.addEventListener('change', (e) => {
            if (e.target.value === 'custom') customDateContainer.classList.remove('hide-element');
            else customDateContainer.classList.add('hide-element');
            calculateAndRenderHistoricalReports();
        });
    }

    if (customDateInput) customDateInput.addEventListener('change', calculateAndRenderHistoricalReports);
    if (searchFilterInput) searchFilterInput.addEventListener('input', calculateAndRenderHistoricalReports);
}

/**
 * Builds layout maps using the live Firestore day document logs from attendance subcollection
 */
async function renderDailyMarkingFormGrid() {
    const tableBody = document.getElementById('attendance-marking-rows');
    if (!tableBody) return;

    if (branchFilteredStudentsArray.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="table-empty" style="text-align:center; padding:2rem; font-style:italic; color:var(--text-muted);">No active student records discovered in this branch directory.</td></tr>`;
        return;
    }

    try {
        // Fetch single date document matching today's ISO string key from subcollection
        const docSnapshot = await db.collection("saas_libraries")
                                    .doc(currentBranchIdKey)
                                    .collection("attendance")
                                    .doc(activeISOStringDayKey)
                                    .get();

        const todaySubDictionaryLogs = docSnapshot.exists ? docSnapshot.data() : {};

        tableBody.innerHTML = branchFilteredStudentsArray.map(student => {
            const recordTokenSignatureKey = `${student.seatNumber}_${student.name.replace(/\s+/g, '')}`;
            const currentLoggedStatus = todaySubDictionaryLogs[recordTokenSignatureKey] || 'Unmarked';

            let badgeHueClassClass = 'unmarked';
            if (currentLoggedStatus === 'Present') badgeHueClassClass = 'present';
            if (currentLoggedStatus === 'Absent') badgeHueClassClass = 'absent';

            return `
                <tr>
                    <td><code style="font-weight:700; color:var(--primary-color);">${student.studentCode}</code></td>
                    <td><strong>${student.seatNumber.toUpperCase()}</strong></td>
                    <td><strong>${student.name}</strong></td>
                    <td><span style="background:rgba(0,0,0,0.03); padding:0.2rem 0.4rem; border-radius:4px;">${student.studentClass}</span></td>
                    <td class="live-status-cell">
                        <span class="status-indicator-badge ${badgeHueClassClass}">${currentLoggedStatus}</span>
                    </td>
                    <td>
                        <div class="actions-cell-right">
                            <button class="btn-mark present-toggle ${currentLoggedStatus === 'Present' ? 'active' : ''}" 
                                    onclick="commitLiveAttendanceStatusCell('${student.seatNumber}', '${student.name.replace(/\s+/g, '\\ ')}', 'Present')">Present</button>
                            <button class="btn-mark absent-toggle ${currentLoggedStatus === 'Absent' ? 'active' : ''}" 
                                    onclick="commitLiveAttendanceStatusCell('${student.seatNumber}', '${student.name.replace(/\s+/g, '\\ ')}', 'Absent')">Absent</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("[Firestore Marking Grid Render Fault]:", err);
    }
}

/**
 * CORE CLOUD ATTENDANCE WRITE LOGIC - Atomic transactional update over active attendance subcollection document
 */
window.commitLiveAttendanceStatusCell = async function(seatNum, stringNameInput, targetStatusValue) {
    const cleanName = stringNameInput.replace(/\\/g, '').trim();
    const tokenSignatureKey = `${seatNum}_${cleanName}`;
    
    const docRef = db.collection("saas_libraries")
                     .doc(currentBranchIdKey)
                     .collection("attendance")
                     .doc(activeISOStringDayKey);

    try {
        await db.runTransaction(async (transaction) => {
            const sfDoc = await transaction.get(docRef);
            let currentLogsData = sfDoc.exists ? sfDoc.data() : {};
            
            // Toggle logic: clicking an already selected status clears it back to unmarked
            if (currentLogsData[tokenSignatureKey] === targetStatusValue) {
                delete currentLogsData[tokenSignatureKey];
            } else {
                currentLogsData[tokenSignatureKey] = targetStatusValue;
            }
            
            transaction.set(docRef, currentLogsData);
        });

        console.log(`[Firestore SUCCESS]: Attendance logged into subcollection document -> ${activeISOStringDayKey}`);
        renderDailyMarkingFormGrid(); // Hot repaint

    } catch (error) {
        console.error("[Firestore Attendance Cloud Transaction Fault]:", error);
        alert("Cloud write operation failed. Inspect server network links or rules parameters configuration.");
    }
};

/**
 * Compiles historical log sheets aggregates straight from target branch cloud subcollection documents
 */
async function calculateAndRenderHistoricalReports() {
    const tableBody = document.getElementById('attendance-history-rows');
    if (!tableBody) return;

    const presetMode = document.getElementById('history-preset-filter').value;
    const customDateInputVal = document.getElementById('history-custom-date').value;
    const searchCriterion = document.getElementById('history-student-search').value.toLowerCase().trim();

    let targetDateKeysArrayList = [];
    const todayObj = new Date();

    if (presetMode === 'today') {
        targetDateKeysArrayList.push(activeISOStringDayKey);
    } else if (presetMode === 'yesterday') {
        const yst = new Date();
        yst.setDate(todayObj.getDate() - 1);
        targetDateKeysArrayList.push(yst.toISOString().split('T')[0]);
    } else if (presetMode === 'weekly') {
        for (let i = 0; i < 7; i++) {
            const temp = new Date();