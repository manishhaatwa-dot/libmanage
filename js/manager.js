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
...
function calculateAndPaintMetrics(...) {
   ...
}   // ? Part 1 yahin khatam

// ? Iske turant niche Part 2 start hoga

function renderLibrariesTableRegistryGrid(...) {
   ...
}

async function executeRegistryStatusMutator(...) {
   ...
}

async function commitNewLibraryDeploymentAction(...) {
   ...
}
