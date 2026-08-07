/**
 * ==========================================================================
 * LIBMANAGE SAAS SECURITY CONTROL - MASTER OWNER CONTROL REALTIME CRUD
 * ==========================================================================
 */

// Firestore Reference
const db = window.db;

if (!db) {
    alert("Firestore not initialized.");
    throw new Error("Firestore not initialized.");
}

document.addEventListener("DOMContentLoaded", () => {

    // Session Check
    if (sessionStorage.getItem("session_role") !== "manager") {
        window.location.href = "../index.html";
        return;
    }

    initializeManagerDashboardEngine();

});

function initializeManagerDashboardEngine() {

    const logoutBtn = document.getElementById("mgr-logout-btn");
    const creationForm = document.getElementById("create-library-form");

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {

            sessionStorage.clear();
            window.location.href = "../index.html";

        });
    }

    // Create Library
    if (creationForm) {
        creationForm.addEventListener(
            "submit",
            commitNewLibraryDeploymentAction
        );
    }

    // Live Libraries Listener
    db.collection("saas_libraries")
        .orderBy("createdAt", "desc")
        .onSnapshot(
            (snapshot) => {

                const libraries = [];

                snapshot.forEach((doc) => {

                    libraries.push(doc.data());

                });

                calculateAndPaintMetrics(libraries);
                renderLibrariesTableRegistryGrid(libraries);

            },
            (error) => {

                console.error(
                    "[Firestore Listener Error]",
                    error
                );

            }
        );
}

/**
 * Dashboard Cards
 */
function calculateAndPaintMetrics(libraries) {

    const total = libraries.length;

    const active = libraries.filter(
        lib => lib.status === "approved" && lib.enabled
    ).length;

    const disabled = libraries.filter(
        lib => !lib.enabled
    ).length;

    document.getElementById("total-branches-count").innerText = total;

    document.getElementById("active-branches-count").innerText = active;

    document.getElementById("disabled-branches-count").innerText = disabled;

}
/**
 * Libraries Table
 */
function renderLibrariesTableRegistryGrid(libraries) {

    const tableBody = document.getElementById("network-libraries-rows");

    if (!tableBody) return;

    if (libraries.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;padding:20px;">
                    No Libraries Found
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = libraries.map(lib => {

        const statusBadge = lib.status === "approved"
            ? `<span class="mgr-badge status-approved">Approved</span>`
            : `<span class="mgr-badge status-pending">Pending</span>`;

        const accessBadge = lib.enabled
            ? `<span class="mgr-badge status-active">Active</span>`
            : `<span class="mgr-badge status-disabled">Disabled</span>`;

        let actionButton = "";

        if (lib.status === "pending") {

            actionButton =
            `<button class="btn-ops-toggle btn-approve"
            onclick="executeRegistryStatusMutator('${lib.libraryId}','approve')">
            Approve
            </button>`;

        } else if (lib.enabled) {

            actionButton =
            `<button class="btn-ops-toggle btn-disable"
            onclick="executeRegistryStatusMutator('${lib.libraryId}','disable')">
            Disable
            </button>`;

        } else {

            actionButton =
            `<button class="btn-ops-toggle btn-enable"
            onclick="executeRegistryStatusMutator('${lib.libraryId}','enable')">
            Enable
            </button>`;
        }

        return `
        <tr>

            <td>
                <strong>${lib.name}</strong><br>
                <small>${lib.libraryId}</small>
            </td>

            <td>${lib.adminEmail}</td>

            <td>${lib.totalSeats}</td>

            <td>
                ${statusBadge}
                ${accessBadge}
            </td>

            <td>

                ${actionButton}

                <button
                    class="btn-ops-toggle btn-delete"
                    onclick="executeRegistryStatusMutator('${lib.libraryId}','delete')">
                    Delete
                </button>

            </td>

        </tr>
        `;

    }).join("");

}

/**
 * Update Library Status
 */
async function executeRegistryStatusMutator(libraryId, commandType) {

    const docRef = db.collection("saas_libraries").doc(libraryId);

    try {

        if (commandType === "approve") {

            await docRef.update({
                status: "approved",
                enabled: true
            });

        }

        else if (commandType === "disable") {

            if (confirm("Disable this Library?")) {

                await docRef.update({
                    enabled: false
                });

            }

        }

        else if (commandType === "enable") {

            await docRef.update({
                enabled: true
            });

        }

        else if (commandType === "delete") {

            if (confirm("Delete this Library permanently?")) {

                await docRef.delete();

            }

        }

    }
    catch (error) {

        console.error(error);

        alert(error.message);

    }

}

/**
 * Create Library
 */
async function commitNewLibraryDeploymentAction(event) {

    event.preventDefault();

    const name =
        document.getElementById("lib-name").value.trim();

    const email =
        document.getElementById("lib-email").value.trim().toLowerCase();

    const password =
        document.getElementById("lib-pass").value.trim();

    const totalSeats =
        parseInt(document.getElementById("lib-seats").value);

    try {

        const check = await db
            .collection("saas_libraries")
            .where("adminEmail","==",email)
            .get();

        if (!check.empty) {

            alert("Email already exists.");

            return;

        }

        const libraryId =
            "LIB-" +
            Math.random().toString(36).substr(2,4).toUpperCase() +
            Math.floor(10 + Math.random()*90);

        const libraryData = {

            libraryId,

            name,

            adminEmail: email,

            adminPass: password,

            totalSeats,

            status: "approved",

            enabled: true,

            createdAt: firebase.firestore.FieldValue.serverTimestamp()

        };

        const docRef =
            db.collection("saas_libraries")
            .doc(libraryId);

        await docRef.set(libraryData);

        const anchor = {

            initMetadata: true,

            createdAt: new Date().toISOString()

        };

        await docRef.collection("students").doc("anchor").set(anchor);

        await docRef.collection("attendance").doc("anchor").set(anchor);

        await docRef.collection("timetable").doc("anchor").set(anchor);

        await docRef.collection("holidays").doc("anchor").set(anchor);

        await docRef.collection("notices").doc("anchor").set(anchor);

        alert("Library Created Successfully.");

        document
            .getElementById("create-library-form")
            .reset();

        document
            .getElementById("lib-pass")
            .value = "password123";

    }
    catch (error) {

        console.error(error);

        alert(error.message);

    }

}
