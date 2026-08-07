/**
 * ==========================================================================
 * LIBMANAGE SAAS SECURITY CONTROL - MASTER OWNER CONTROL REALTIME CRUD
 * ==========================================================================
 */

// Centralized Hook reference from shared instance models
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // 1. Session verification check gate
    if (sessionStorage.getItem('session_role') !== 'manager') {
        window.location.href = "../index.html";
        return;
    }

    initializeManagerDashboardEngine();
});

function initializeManagerDashboardEngine() {
    const logoutBtn = document.getElementById('mgr-logout-btn');
    const creationForm = document.getElementById('create-library-form');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = "../index.html";
        });
    }

    if (creationForm) {
        creationForm.addEventListener('submit', commitNewLibraryDeploymentAction);
    }

    // 2. Connect Realtime Firestore Live Snapshot Stream to paint registries dynamically
    db.collection("saas_libraries").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        let systemLibrariesDB = [];
        snapshot.forEach((doc) => {
            systemLibrariesDB.push(doc.data());
        });
        
        // Execute UI Paint counters and table grids loops instantly on mutations
        calculateAndPaintMetrics(systemLibrariesDB);
        renderLibrariesTableRegistryGrid(systemLibrariesDB);
    }, (error) => {
        console.error("[Firestore Live Stream Listener Fault]:", error);
    });
}

/**
 * Calculates global stats counters across tenant document sets
 */
function calculateAndPaintMetrics(librariesArray) {
    const totalCount = librariesArray.length;
    const activeCount = librariesArray.filter(l => l.status === 'approved' && l.enabled === true).length;
    const disabledCount = librariesArray.filter(l => l.enabled === false).length;

    document.getElementById('total-branches-count').innerText = totalCount;
    document.getElementById('active-branches-count').innerText = activeCount;
    document.getElementById('disabled-branches-count').innerText = disabledCount;
}

/**
 * Builds rows containing active operational change triggers mapped from Firestore documents
 */
function renderLibrariesTableRegistryGrid(librariesArray) {
    const tableBody = document.getElementById('network-libraries-rows');
    if (!tableBody) return;

    if (librariesArray.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="table-empty" style="text-align:center; padding:2rem; color:var(--text-muted); font-style:italic;">No active library branches found inside cloud network registry records.</td></tr>`;
        return;
    }

    tableBody.innerHTML = librariesArray.map((lib) => {
        let statusBadge = lib.status === 'approved' ? 
            `<span class="mgr-badge status-approved">Approved</span>` : 
            `<span class="mgr-badge status-pending">Pending</span>`;

        let accessBadge = lib.enabled ? 
            `<span class="mgr-badge status-active">Active</span>` : 
            `<span class="mgr-badge status-disabled">Suspended</span>`;

        let operationalButtons = "";

        if (lib.status === 'pending') {
            operationalButtons += `<button class="btn-ops-toggle btn-approve" onclick="executeRegistryStatusMutator('${lib.libraryId}', 'approve')">Approve</button>`;
        } else {
            if (lib.enabled) {
                operationalButtons += `<button class="btn-ops-toggle btn-disable" onclick="executeRegistryStatusMutator('${lib.libraryId}', 'disable')" title="Put access on Hold due to Cash dues">Disable</button>`;
            } else {
                operationalButtons += `<button class="btn-ops-toggle btn-enable" onclick="executeRegistryStatusMutator('${lib.libraryId}', 'enable')" title="Restore Access parameters instantly">Enable</button>`;
            }
        }

        return `
            <tr>
                <td class="lib-meta-cell">
                    <strong>${lib.name}</strong>
                    <span>ID Token: ${lib.libraryId}</span>
                </td>
                <td><code>${lib.adminEmail}</code></td>
                <td><strong>${lib.totalSeats} Seats</strong></td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:0.2rem; align-items:flex-start;">
                        ${statusBadge} ${accessBadge}
                    </div>
                </td>
                <td>
                    <div class="mgr-actions-row">
                        ${operationalButtons}
                        <button class="btn-ops-toggle btn-delete" onclick="executeRegistryStatusMutator('${lib.libraryId}', 'delete')" title="Purge Record completely">???</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * CORE MUTATOR CONTROLLER - Directly alters document status keys variables on Firestore in real-time
 */
async function executeRegistryStatusMutator(libraryId, commandType) {
    const docRef = db.collection("saas_libraries").doc(libraryId);

    try {
        if (commandType === 'approve') {
            await docRef.update({ status: 'approved', enabled: true });
        } 
        else if (commandType === 'disable') {
            if (confirm(`Are you certain you want to SUSPEND terminal access for this branch? Admin and students will be locked out immediately. (ALL SYSTEM HISTORY AND DATA REMAINS COMPLETELY SAFE)`)) {
                await docRef.update({ enabled: false });
            }
        } 
        else if (commandType === 'enable') {
            await docRef.update({ enabled: true });
        } 
        else if (commandType === 'delete') {
            if (confirm(`?? EXTREME DANGER: Are you completely certain you want to permanently delete this branch node? This purges the terminal profile from cloud servers maps data pools.`)) {
                await docRef.delete();
                alert("Library Node Purged Successfully from Cloud Registry.");
            }
        }
    } catch (error) {
        console.error(`[Firestore Mutator Command Fault - ${commandType}]:`, error);
        alert(`Cloud transactional update failed. Ensure your internet connection is live.`);
    }
}

/**
 * BOOTSTRAPS & INITIALIZES COMPLETE SYSTEM SUBCOLLECTIONS AUTOMATICALLY ON CLOUD FIRESTORE WRITE
 */
async function commitNewLibraryDeploymentAction(event) {
    event.preventDefault();

    const name = document.getElementById('lib-name').value.trim();
    const email = document.getElementById('lib-email').value.trim().toLowerCase();
    const password = document.getElementById('lib-pass').value.trim();
    const manualSeats = parseInt(document.getElementById('lib-seats').value);

    try {
        // 1. Conflict checking scan mapping queries channels
        const querySnapshot = await db.collection("saas_libraries").where("adminEmail", "==", email).get();
        if (!querySnapshot.empty) {
            alert("Registration Conflict Error: Admin Login Email address already active on another tenant cluster node.");
            return;
        }

        // Generate clean structural random unique ID document token keys
        const uniqueIdToken = `LIB-${Math.random().toString(36).substr(2, 4).toUpperCase()}${Math.floor(10 + Math.random() * 90)}`;

        const payloadNewBranchModel = {
            libraryId: uniqueIdToken,
            name: name,
            adminEmail: email,
            adminPass: password,
            totalSeats: manualSeats, 
            status: "approved",      
            enabled: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp() // Precise tracking timestamp
        };

        // 2. ROOT OPERATION WRITE: Deploy main library root document inside Firestore
        const mainDocRef = db.collection("saas_libraries").doc(uniqueIdToken);
        await mainDocRef.set(payloadNewBranchModel);
        console.log(`[Firestore SUCCESS]: Root Document Created for ${uniqueIdToken}`);

        // 3. SUBCOLLECTIONS CORE BOOTSTRAP WRITE OPERATION PIPELINES
        // Instantly generate structural anchor items to populate nested subcollection maps schemas rules
        const baselineAnchorPayload = { initMetadata: "Architecture Anchor Active", syncedAt: new Date().toISOString() };

        await mainDocRef.collection("students").doc("anchor_node").set(baselineAnchorPayload);
        await mainDocRef.collection("attendance").doc("anchor_node").set(baselineAnchorPayload);
        await mainDocRef.collection("timetable").doc("anchor_node").set(baselineAnchorPayload);
        await mainDocRef.collection("holidays").doc("anchor_node").set(baselineAnchorPayload);
        await mainDocRef.collection("notices").doc("anchor_node").set(baselineAnchorPayload);

        console.log(`[Firestore SUCCESS]: Subcollections (students, attendance, timetable, holidays, notices) initialized under ${uniqueIdToken}`);
        alert(`Success! "${name}" node deployed cleanly with full Cloud Subcollections Architecture.`);

        // Reset view form fields controllers states mappings
        document.getElementById('create-library-form').reset();
        document.getElementById('lib-pass').value = "password123";

    } catch (error) {
        console.error("[Firestore Deployment Mutation Core Fault]:", error);
        alert("Cloud write operation failed. Inspect browser console logs or ensure Firestore Rules allow read/write commands.");
    }
}