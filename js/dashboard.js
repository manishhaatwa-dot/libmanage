/**
 * ==========================================================================
 * LIBMANAGE SAAS ECOSYSTEM CORE ENGINE - CONFIGURATIONS & FIREBASE AUTH SYNC
 * ==========================================================================
 */

// 1. Core Firebase Web App Configuration (Compat Mode Blueprint)
const firebaseConfig = {
    apiKey: "AIzaSyCUe84QnEA5DY31DXtzM-7M4Xu5bSa8xO8",
    authDomain: "://firebaseapp.com",
    projectId: "appointment-app-cb979",
    storageBucket: "appointment-app-cb979.firebasestorage.app",
    messagingSenderId: "596931961212",
    appId: "1:596931961212:web:6039e8f8ab4e759c9104f9"
};

// Safely boot single global instance wrapper to avoid console collisions
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore(); // Centralized Cloud Firestore Hook

document.addEventListener('DOMContentLoaded', () => {
    bindGatewayAuthPipelines();
});

/**
 * Handles Realtime Multi-Tenant Authentication Gates for Admins & Students
 */
function bindGatewayAuthPipelines() {
    const studentForm = document.getElementById('student-login-form');
    const adminForm = document.getElementById('admin-login-form');

    // ????? LEVEL 3: STUDENT LOGIN GATEWAY (Uses Unique Code + Seat Number verification)
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tokenInput = document.getElementById('student-uid').value.trim().toUpperCase();

            try {
                // Fetch group indices collection maps using Firestore Collection Group query profiles
                const studentQuerySnapshot = await db.collectionGroup("students")
                                                       .where("studentCode", "==", tokenInput)
                                                       .get();

                if (studentQuerySnapshot.empty) {
                    alert("Authentication Error: Provided Student Code not registered in our network databases.");
                    return;
                }

                // Extract verified entity document properties
                const studentDoc = studentQuerySnapshot.docs[0];
                const studentData = studentDoc.data();
                const parentLibraryId = studentData.libraryId;

                // Validate Parent Library Terminal node status before allowing workspace loads
                const libraryDoc = await db.collection("saas_libraries").doc(parentLibraryId).get();
                
                if (!libraryDoc.exists) {
                    alert("Infrastructure Error: Associated Library Branch profile not discovered.");
                    return;
                }

                const libData = libraryDoc.data();
                if (libData.status !== "approved") {
                    alert("Authorization Denied: This library node is currently awaiting system approval.");
                    return;
                }
                if (!libData.enabled) {
                    alert("Access Suspended: This library branch network node is currently disabled by the owner. Contact admin.");
                    return;
                }

                // Grant Session Keys authorizations
                sessionStorage.setItem('session_role', 'student');
                sessionStorage.setItem('session_user_code', studentData.studentCode);
                sessionStorage.setItem('session_student_seat', studentData.seatNumber);
                sessionStorage.setItem('session_library_id', studentData.libraryId);
                
                const prefix = window.location.pathname.includes('/pages/') ? "" : "pages/";
                window.location.href = `${prefix}student-dashboard.html`;

            } catch (error) {
                console.error("[Firestore Student Login Fault]:", error);
                alert("Cloud sync failure. Verify network parameters link channels.");
            }
        });
    }

    // ?? LEVEL 2: BRANCH ADMIN MULTI-TENANT LOGIN ENGINE
    if (adminForm) {
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('admin-email').value.trim().toLowerCase();
            const passInput = document.getElementById('admin-password').value;

            try {
                // Verify admin credentials straight against root saas_libraries documents metrics
                const adminQuerySnapshot = await db.collection("saas_libraries")
                                                   .where("adminEmail", "==", emailInput)
                                                   .where("adminPass", "==", passInput)
                                                   .get();

                if (adminQuerySnapshot.empty) {
                    alert("Security Check Failed: Invalid Admin Email ID or Password context configuration.");
                    return;
                }

                const matchedLibDoc = adminQuerySnapshot.docs[0];
                const libData = matchedLibDoc.data();

                // Core Hierarchy State Restrictions checks
                if (libData.status !== "approved") {
                    alert("Access Restricted: Your library request terminal state is currently: PENDING APPROVAL.");
                    return;
                }

                if (!libData.enabled) {
                    alert("Access Suspended: Your branch terminal access has been disabled by the owner. Clear cash dues to resume.");
                    return;
                }

                // Admin Authorized Successfully - Freeze environment routing tokens context properties maps
                sessionStorage.setItem('session_role', 'admin');
                sessionStorage.setItem('session_library_id', libData.libraryId);
                sessionStorage.setItem('session_library_name', libData.name);

                const prefix = window.location.pathname.includes('/pages/') ? "" : "pages/";
                window.location.href = `${prefix}admin-dashboard.html`;

            } catch (error) {
                console.error("[Firestore Admin Login Fault]:", error);
                alert("Database transactional failure. Verify systems schemas configurations parameters logs.");
            }
        });
    }
}

/**
 * Reusable Asynchronous UI Shell Loader Component Engine
 */
async function loadSaaSLayoutComponent(containerId, componentUrl, callback = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(componentUrl);
        if (!response.ok) throw new Error(`Network failure code: ${response.status}`);
        container.innerHTML = await response.text();
        if (callback) callback();
    } catch (err) {
        console.error(`Layout Load Fault Component Fragment Error [${componentUrl}]:`, err);
    }
}