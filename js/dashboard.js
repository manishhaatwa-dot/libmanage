/**
 * ==========================================================================
 * LIBMANAGE SAAS ECOSYSTEM CORE ENGINE - MULTI-TENANT CLOUD RECOVERY MODULE
 * ==========================================================================
 */

// 1. Unified Multi-Tenant Cloud Architecture Parameters Base Configurations
const unifiedFirebaseConfig = {
    apiKey: "AIzaSyCUe84QnEA5DY31DXtzM-7M4Xu5bSa8xO8",
    authDomain: "appointment-app-cb979.firebaseapp.com",
    projectId: "appointment-app-cb979",
    storageBucket: "appointment-app-cb979.firebasestorage.app",
    messagingSenderId: "596931961212",
    appId: "1:596931961212:web:6039e8f8ab4e759c9104f9"
};

// 2. Deterministic Singular Structural Global Bootstrapper Sequence Execution
if (typeof firebase !== "undefined" && firebase.apps) {
    if (!firebase.apps.length) {
        firebase.initializeApp(unifiedFirebaseConfig);
    }
    // Expose one centralized global instance hook to clear Temporal Dead Zones (TDZ)
    window.db = firebase.firestore();
} else {
    console.warn("[LibManage Core Engine Wait Warning]: Firebase SDK layers not detected on this context stack sequence. Ensure official script tags are loaded.");
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === "undefined") {
        console.error("Firebase SDK not loaded.");
        return;
    }

    bindGatewayAuthPipelines();
});

/**
 * Handles Authentication Gateways Verification Routines Channels Loops
 */
function bindGatewayAuthPipelines() {
    const studentForm = document.getElementById('student-login-form');
    const adminForm = document.getElementById('admin-login-form');

    // Local runtime extraction assertion mapping from centralized global instance
    const db = window.db;

    // ????? LEVEL 3: STUDENT PORTAL MULTI-TENANT VERIFICATION PATHWAY
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tokenInput = document.getElementById('student-uid').value.trim().toUpperCase();

            if (!db) {
                alert("Database Engine Offline: Cloud storage hooks could not be fully initialized.");
                return;
            }

            try {
                // Execute deep lookup collection group scan matches across isolated tenant records
                const studentQuerySnapshot = await db.collectionGroup("students")
                                                       .where("studentCode", "==", tokenInput)
                                                       .get();

                if (studentQuerySnapshot.empty) {
                    alert("Authentication Error: Provided Unique Student Code not matching active network profiles indices.");
                    return;
                }

                // Extract parameters targets indices mappings keys parameters
                const targetStudentDoc = studentQuerySnapshot.docs[0];
                const studentData = targetStudentDoc.data();
                const parentLibraryId = studentData.libraryId;

                // Validate corresponding infrastructure terminal node configurations conditions state limits
                const libraryDocSnapshot = await db.collection("saas_libraries").doc(parentLibraryId).get();

                if (!libraryDocSnapshot.exists) {
                    alert("Infrastructure Error: The associated library branch database instance has been deleted or moved.");
                    return;
                }

                const libraryMetadata = libraryDocSnapshot.data();

                // Process sequential verification rules constraints properties fields states
                if (libraryMetadata.status !== "approved") {
                    alert("Access Blocked: Your parent library branch workspace registration is currently: AWAITING OWNER APPROVAL.");
                    return;
                }

                if (!libraryMetadata.enabled) {
                    alert("Access Suspended: This library branch network node is currently disabled by the owner. Contact admin.");
                    return;
                }

                 

                // Authentication Authorization Confirmed - Lock routing environment parameters tokens properties maps
                sessionStorage.setItem('session_role', 'student');
                sessionStorage.setItem('session_user_code', studentData.studentCode);
                sessionStorage.setItem('session_student_seat', studentData.seatNumber || "");
                sessionStorage.setItem('session_library_id', studentData.libraryId);
                
                const pathPrefixModifier = window.location.pathname.includes('/pages/') ? "" : "pages/";
                window.location.href = `${pathPrefixModifier}student-dashboard.html`;

            } catch (error) {
                console.error("[Ecosystem Student Auth Transaction Failure Logs Trace]:", error);
                alert("Cloud system synchronization failure exception occurred: " + error.message);
            }
        });
    }

    // ?? LEVEL 2: BRANCH ADMIN CONSOLE AUTHENTICATION PIPELINE ENGINE
    if (adminForm) {
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('admin-email').value.trim().toLowerCase();
            const passInput = document.getElementById('admin-password').value;

            if (!db) {
                alert("Database Engine Offline: Cloud storage hooks could not be fully initialized.");
                return;
            }

            try {
                // Execute direct index field query filtering across centralized root library nodes
                const adminQuerySnapshot = await db.collection("saas_libraries")
                                                           .where("adminEmail", "==", emailInput)
                                                           .where("adminPass", "==", passInput)
                                                           .get();

                if (adminQuerySnapshot.empty) {
                    alert("Security Check Failed: Invalid Admin Email ID or Password context configuration.");
                    return;
                }

                const targetLibraryDoc = adminQuerySnapshot.docs[0];
                const libraryData = targetLibraryDoc.data();

                // Enforce structural operational policy rules verification parameters logs
                if (libraryData.status !== "approved") {
                    alert("Access Restricted: Your library request terminal state is currently: PENDING APPROVAL.");
                    return;
                }

                if (!libraryData.enabled) {
                    alert("Access Suspended: Your branch terminal access has been disabled by the owner. Clear cash dues to resume.");
                    return;
                }

                // Branch Admin Authorization Verified Successfully - Freeze navigation session tracking vectors
                sessionStorage.setItem('session_role', 'admin');
                sessionStorage.setItem('session_library_id', libraryData.libraryId);
                sessionStorage.setItem('session_library_name', libraryData.name);

                const pathPrefixModifier = window.location.pathname.includes('/pages/') ? "" : "pages/";
                window.location.href = `${pathPrefixModifier}admin-dashboard.html`;

            } catch (error) {
                console.error("[Ecosystem Admin Auth Transaction Failure Logs Trace]:", error);
                alert("Cloud system synchronization failure exception occurred: " + error.message);
            }
        });
    }
}

/**
 * Reusable Asynchronous UI Fragment Layout Engine Integration Layer
 */
async function loadSaaSLayoutComponent(containerId, componentUrl, callback = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(componentUrl);
        if (!response.ok) throw new Error("HTTP network transaction status fault code: " + response.status);
        const templateHtmlStringPayload = await response.text();
        container.innerHTML = templateHtmlStringPayload;
        if (callback) callback();
    } catch (err) {
        console.error("[Ecosystem Layout Component Load Exception Error] Container Target [" + containerId + "] Asset [" + componentUrl + "]:", err);
    }
}
document.addEventListener("click", function (event) {
    const logoutBtn = event.target.closest("#admin-logout-btn");
    if (!logoutBtn) return;

    sessionStorage.removeItem("session_role");
    sessionStorage.removeItem("session_library_id");
    sessionStorage.removeItem("session_library_name");

    Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("session_admin_")) {
            sessionStorage.removeItem(key);
        }
    });

    window.location.href = "../index.html";
});
