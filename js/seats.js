(function () {
  var db = firebase.firestore();
  var libraryId = sessionStorage.getItem("session_library_id");
  var role = sessionStorage.getItem("session_role");

  var state = {
    students: [],
    capacity: {
      total: null,
      morning: null,
      afternoon: null,
      evening: null
    },
    searchTerm: "",
    selectedStudent: null,
    libraryUnsubscribe: null,
    studentsUnsubscribe: null
  };

  var els = {};

  window.toggleSeatCardDetails = function (type) {
    if (type === "available") {
      toggleAvailableCard();
    } else if (type === "occupied") {
      toggleOccupiedCard();
    }
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheDom();
    checkAccess();
    bindEvents();
    attachRealtimeListeners();
    renderAll();
  }

  function cacheDom() {
    els.alert = document.getElementById("seatAlert");

    els.totalSeatsValue = document.getElementById("totalSeatsValue");
    els.availableSeatsValue = document.getElementById("availableSeatsValue");
    els.occupiedSeatsValue = document.getElementById("occupiedSeatsValue");

    els.totalSeatsSubtext = document.getElementById("totalSeatsSubtext");
    els.availableSeatsSubtext = document.getElementById("availableSeatsSubtext");
    els.occupiedSeatsSubtext = document.getElementById("occupiedSeatsSubtext");
    els.capacityBadge = document.getElementById("capacityBadge");

    els.searchInput = document.getElementById("seatSearchInput");

    els.availableCard = document.getElementById("availableCard");
    els.occupiedCard = document.getElementById("occupiedCard");
    els.availableCardContent = document.getElementById("availableCardContent");
    els.occupiedCardContent = document.getElementById("occupiedCardContent");
    els.availableDetailsWrap = document.getElementById("availableDetailsWrap");
    els.occupiedDetailsWrap = document.getElementById("occupiedDetailsWrap");
    els.availableToggleText = document.getElementById("availableToggleText");
    els.occupiedToggleText = document.getElementById("occupiedToggleText");

    els.btnConfigureCapacity = document.getElementById("btnConfigureCapacity");

    els.capacityModal = document.getElementById("capacityModal");
    els.closeCapacityModal = document.getElementById("closeCapacityModal");
    els.cancelCapacityBtn = document.getElementById("cancelCapacityBtn");
    els.capacityForm = document.getElementById("capacityForm");
    els.totalCapacityInput = document.getElementById("totalCapacityInput");
    els.morningCapacityInput = document.getElementById("morningCapacityInput");
    els.afternoonCapacityInput = document.getElementById("afternoonCapacityInput");
    els.eveningCapacityInput = document.getElementById("eveningCapacityInput");
    els.saveCapacityBtn = document.getElementById("saveCapacityBtn");

    els.studentModal = document.getElementById("studentModal");
    els.closeStudentModal = document.getElementById("closeStudentModal");
    els.closeStudentDetailsBtn = document.getElementById("closeStudentDetailsBtn");
    els.openStudentProfileBtn = document.getElementById("openStudentProfileBtn");

    els.modalSeatNumber = document.getElementById("modalSeatNumber");
    els.modalStudentCode = document.getElementById("modalStudentCode");
    els.modalStudentName = document.getElementById("modalStudentName");
    els.modalFatherName = document.getElementById("modalFatherName");
    els.modalStudentClass = document.getElementById("modalStudentClass");
    els.modalStudentShift = document.getElementById("modalStudentShift");
    els.modalStudentStatus = document.getElementById("modalStudentStatus");
    els.modalJoiningDate = document.getElementById("modalJoiningDate");
    els.modalExpiryDate = document.getElementById("modalExpiryDate");
  }

  function checkAccess() {
    if (role !== "admin") {
      showAlert("Only admin can access Seat Management.", "error");
      return;
    }

    if (!libraryId) {
      showAlert("Library session not found. Please login again.", "error");
      return;
    }
  }

  function bindEvents() {
    if (els.availableCard) {
      els.availableCard.onclick = function (e) {
        var studentItem = findParentByClass(e.target, "student-item");
        if (studentItem) return;
        toggleAvailableCard();
      };
    }

    if (els.occupiedCard) {
      els.occupiedCard.onclick = function (e) {
        var studentItem = findParentByClass(e.target, "student-item");
        if (studentItem) {
          var studentId = studentItem.getAttribute("data-student-id");
          var student = getStudentById(studentId);
          if (student) {
            openStudentModal(student);
          }
          return;
        }
        toggleOccupiedCard();
      };
    }

    if (els.searchInput) {
      els.searchInput.oninput = function () {
        state.searchTerm = (els.searchInput.value || "").toLowerCase().trim();
        renderOccupiedDetails();
      };
    }

    if (els.btnConfigureCapacity) {
      els.btnConfigureCapacity.onclick = function () {
        fillCapacityForm();
        openModal(els.capacityModal);
      };
    }

    if (els.closeCapacityModal) {
      els.closeCapacityModal.onclick = function () {
        closeModal(els.capacityModal);
      };
    }

    if (els.cancelCapacityBtn) {
      els.cancelCapacityBtn.onclick = function () {
        closeModal(els.capacityModal);
      };
    }

    if (els.capacityForm) {
      els.capacityForm.onsubmit = saveCapacity;
    }

    if (els.closeStudentModal) {
      els.closeStudentModal.onclick = function () {
        closeModal(els.studentModal);
      };
    }

    if (els.closeStudentDetailsBtn) {
      els.closeStudentDetailsBtn.onclick = function () {
        closeModal(els.studentModal);
      };
    }

    if (els.openStudentProfileBtn) {
      els.openStudentProfileBtn.onclick = function () {
        if (!state.selectedStudent) return;
        sessionStorage.setItem("selected_student_id", state.selectedStudent.id);
        window.location.href = "./student-profile.html?id=" + encodeURIComponent(state.selectedStudent.id);
      };
    }
  }

  function attachRealtimeListeners() {
    if (!libraryId) return;

    var libraryRef = db.collection("saas_libraries").doc(libraryId);
    var studentsRef = db.collection("saas_libraries").doc(libraryId).collection("students");

    state.libraryUnsubscribe = libraryRef.onSnapshot(function (doc) {
      var data = doc.exists ? (doc.data() || {}) : {};
      state.capacity.total = parseNumber(data.totalCapacity);
      state.capacity.morning = parseNumber(data.morningCapacity);
      state.capacity.afternoon = parseNumber(data.afternoonCapacity);
      state.capacity.evening = parseNumber(data.eveningCapacity);
      fillCapacityForm();
      renderSummary();
      renderAvailableDetails();
    }, function (error) {
      console.error("Library listener error:", error);
      showAlert("Capacity load failed.", "error");
    });

    state.studentsUnsubscribe = studentsRef.onSnapshot(function (snapshot) {
      var rows = [];

      snapshot.forEach(function (doc) {
        var data = doc.data() || {};
        if (String(data.seatNumber || "").trim() !== "") {
          rows.push({
            id: doc.id,
            seatNumber: String(data.seatNumber || "").trim(),
            studentCode: String(data.studentCode || "").trim(),
            name: String(data.name || "").trim(),
            fatherName: String(data.fatherName || "").trim(),
            studentClass: String(data.studentClass || "").trim(),
            shift: normalizeShift(data.shift),
            joiningDate: formatDate(data.joiningDate),
            expiryDate: formatDate(data.expiryDate),
            status: String(data.status || "").trim()
          });
        }
      });

      rows.sort(function (a, b) {
        return compareSeat(a.seatNumber, b.seatNumber);
      });

      state.students = rows;
      renderSummary();
      renderAvailableDetails();
      renderOccupiedDetails();
    }, function (error) {
      console.error("Students listener error:", error);
      showAlert("Students load failed.", "error");
    });
  }

  function renderAll() {
    renderSummary();
    renderAvailableDetails();
    renderOccupiedDetails();
  }

  function toggleAvailableCard() {
    if (!els.availableCard || !els.availableCardContent) return;
    var isExpanded = els.availableCard.classList.contains("expanded");

    if (isExpanded) {
      els.availableCard.classList.remove("expanded");
      els.availableCardContent.style.display = "none";
      els.availableCard.setAttribute("aria-expanded", "false");
      if (els.availableToggleText) els.availableToggleText.textContent = "View Details";
    } else {
      els.availableCard.classList.add("expanded");
      els.availableCardContent.style.display = "block";
      els.availableCard.setAttribute("aria-expanded", "true");
      if (els.availableToggleText) els.availableToggleText.textContent = "Hide Details";
      renderAvailableDetails();
    }
  }

  function toggleOccupiedCard() {
    if (!els.occupiedCard || !els.occupiedCardContent) return;
    var isExpanded = els.occupiedCard.classList.contains("expanded");

    if (isExpanded) {
      els.occupiedCard.classList.remove("expanded");
      els.occupiedCardContent.style.display = "none";
      els.occupiedCard.setAttribute("aria-expanded", "false");
      if (els.occupiedToggleText) els.occupiedToggleText.textContent = "View Details";
    } else {
      els.occupiedCard.classList.add("expanded");
      els.occupiedCardContent.style.display = "block";
      els.occupiedCard.setAttribute("aria-expanded", "true");
      if (els.occupiedToggleText) els.occupiedToggleText.textContent = "Hide Details";
      renderOccupiedDetails();
    }
  }

  function renderSummary() {
    if (!els.occupiedSeatsValue || !els.totalSeatsValue || !els.availableSeatsValue) return;

    var occupied = state.students.length;
    var totalCapacity = parseNumber(state.capacity.total);
    var totalConfigured = totalCapacity !== null;
    var available = totalConfigured ? Math.max(totalCapacity - occupied, 0) : null;

    els.occupiedSeatsValue.textContent = occupied;

    if (totalConfigured) {
      els.totalSeatsValue.textContent = totalCapacity;
      els.availableSeatsValue.textContent = available;
      if (els.totalSeatsSubtext) els.totalSeatsSubtext.textContent = "Configured library capacity";
      if (els.availableSeatsSubtext) els.availableSeatsSubtext.textContent = "Click to view shift-wise availability";
      if (els.capacityBadge) {
        els.capacityBadge.style.display = "inline-flex";
        els.capacityBadge.textContent = "Configured";
      }
    } else {
      els.totalSeatsValue.textContent = "--";
      els.availableSeatsValue.textContent = "--";
      if (els.totalSeatsSubtext) els.totalSeatsSubtext.textContent = "Capacity not configured";
      if (els.availableSeatsSubtext) els.availableSeatsSubtext.textContent = "Click to view shift-wise availability";
      if (els.capacityBadge) {
        els.capacityBadge.style.display = "none";
      }
    }

    if (els.occupiedSeatsSubtext) els.occupiedSeatsSubtext.textContent = "Click to view occupied seat details";
  }

  function renderAvailableDetails() {
    if (!els.availableDetailsWrap) return;

    var occupiedByShift = { Morning: 0, Afternoon: 0, Evening: 0 };

    for (var i = 0; i < state.students.length; i++) {
      if (state.students[i].shift === "Morning") occupiedByShift.Morning++;
      else if (state.students[i].shift === "Afternoon") occupiedByShift.Afternoon++;
      else if (state.students[i].shift === "Evening") occupiedByShift.Evening++;
    }

    var totalCapacity = parseNumber(state.capacity.total);
    var morningCapacity = parseNumber(state.capacity.morning);
    var afternoonCapacity = parseNumber(state.capacity.afternoon);
    var eveningCapacity = parseNumber(state.capacity.evening);

    if (totalCapacity !== null) {
      if (morningCapacity === null) morningCapacity = totalCapacity;
      if (afternoonCapacity === null) afternoonCapacity = totalCapacity;
      if (eveningCapacity === null) eveningCapacity = totalCapacity;
    }

    if (morningCapacity === null && afternoonCapacity === null && eveningCapacity === null) {
      els.availableDetailsWrap.innerHTML = '<div class="seat-empty-state">Capacity not configured yet.</div>';
      return;
    }

    els.availableDetailsWrap.innerHTML =
      shiftRow("Morning", occupiedByShift.Morning, morningCapacity) +
      shiftRow("Afternoon", occupiedByShift.Afternoon, afternoonCapacity) +
      shiftRow("Evening", occupiedByShift.Evening, eveningCapacity);
  }

  function renderOccupiedDetails() {
    if (!els.occupiedDetailsWrap) return;

    if (!state.students.length) {
      els.occupiedDetailsWrap.innerHTML = '<div class="seat-empty-state">No occupied seats found.</div>';
      return;
    }

    var list = getFilteredStudents();

    if (!list.length) {
      els.occupiedDetailsWrap.innerHTML = '<div class="seat-empty-state">No occupied seats matched your search.</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      html += ''
        + '<div class="student-item" data-student-id="' + escapeHtml(item.id) + '">'
        + '<div class="student-item-row">'
        + '<div>'
        + '<div class="student-seat">Seat ' + escapeHtml(item.seatNumber || "-") + '</div>'
        + '<div class="student-meta"><span><span class="seat-mini-label">Shift:</span> <strong>' + escapeHtml(item.shift || "-") + '</strong></span></div>'
        + '</div>'
        + '<div style="text-align:right;">'
        + '<div class="student-name">' + escapeHtml(item.name || "-") + '</div>'
        + '<div class="student-code">' + escapeHtml(item.studentCode || "-") + '</div>'
        + '</div>'
        + '</div>'
        + '</div>';
    }

    els.occupiedDetailsWrap.innerHTML = html;
  }

  function getFilteredStudents() {
    if (!state.searchTerm) return state.students.slice();

    var out = [];
    for (var i = 0; i < state.students.length; i++) {
      var s = state.students[i];
      var seat = (s.seatNumber || "").toLowerCase();
      var name = (s.name || "").toLowerCase();
      var code = (s.studentCode || "").toLowerCase();

      if (
        seat.indexOf(state.searchTerm) !== -1 ||
        name.indexOf(state.searchTerm) !== -1 ||
        code.indexOf(state.searchTerm) !== -1
      ) {
        out.push(s);
      }
    }
    return out;
  }

  function shiftRow(name, occupied, capacity) {
    var available = capacity === null ? "--" : Math.max(capacity - occupied, 0);

    return ''
      + '<div class="shift-item">'
      + '<div class="shift-item-row"><div class="shift-name">' + escapeHtml(name) + '</div></div>'
      + '<div class="shift-meta">'
      + '<span><span class="seat-mini-label">Occupied:</span> <span class="seat-mini-value">' + escapeHtml(String(occupied)) + '</span></span>'
      + '<span><span class="seat-mini-label">Available:</span> <span class="seat-mini-value">' + escapeHtml(String(available)) + '</span></span>'
      + '</div>'
      + '</div>';
  }

  function saveCapacity(e) {
    e.preventDefault();

    var total = parseNumber(els.totalCapacityInput.value);
    var morning = parseNumber(els.morningCapacityInput.value);
    var afternoon = parseNumber(els.afternoonCapacityInput.value);
    var evening = parseNumber(els.eveningCapacityInput.value);

    if (total !== null) {
      if (morning === null) morning = total;
      if (afternoon === null) afternoon = total;
      if (evening === null) evening = total;
    }

    els.saveCapacityBtn.disabled = true;
    els.saveCapacityBtn.textContent = "Saving...";

    db.collection("saas_libraries").doc(libraryId).set({
      totalCapacity: total,
      morningCapacity: morning,
      afternoonCapacity: afternoon,
      eveningCapacity: evening,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
      showAlert("Capacity saved successfully.", "success");
      closeModal(els.capacityModal);
    }).catch(function (error) {
      console.error("Save capacity error:", error);
      showAlert("Failed to save capacity.", "error");
    }).finally(function () {
      els.saveCapacityBtn.disabled = false;
      els.saveCapacityBtn.textContent = "Save Capacity";
    });
  }

  function fillCapacityForm() {
    if (!els.totalCapacityInput) return;
    els.totalCapacityInput.value = state.capacity.total !== null ? state.capacity.total : "";
    els.morningCapacityInput.value = state.capacity.morning !== null ? state.capacity.morning : "";
    els.afternoonCapacityInput.value = state.capacity.afternoon !== null ? state.capacity.afternoon : "";
    els.eveningCapacityInput.value = state.capacity.evening !== null ? state.capacity.evening : "";
  }

  function openStudentModal(student) {
    state.selectedStudent = student;
    if (els.modalSeatNumber) els.modalSeatNumber.textContent = student.seatNumber || "-";
    if (els.modalStudentCode) els.modalStudentCode.textContent = student.studentCode || "-";
    if (els.modalStudentName) els.modalStudentName.textContent = student.name || "-";
    if (els.modalFatherName) els.modalFatherName.textContent = student.fatherName || "-";
    if (els.modalStudentClass) els.modalStudentClass.textContent = student.studentClass || "-";
    if (els.modalStudentShift) els.modalStudentShift.textContent = student.shift || "-";
    if (els.modalStudentStatus) els.modalStudentStatus.textContent = student.status || "-";
    if (els.modalJoiningDate) els.modalJoiningDate.textContent = student.joiningDate || "-";
    if (els.modalExpiryDate) els.modalExpiryDate.textContent = student.expiryDate || "-";
    openModal(els.studentModal);
  }

  function getStudentById(id) {
    for (var i = 0; i < state.students.length; i++) {
      if (state.students[i].id === id) return state.students[i];
    }
    return null;
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }

  function normalizeShift(value) {
    var v = String(value || "").toLowerCase().trim();
    if (v === "morning") return "Morning";
    if (v === "afternoon") return "Afternoon";
    if (v === "evening") return "Evening";
    return String(value || "").trim();
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    var n = Number(value);
    if (isNaN(n) || n < 0) return null;
    return Math.floor(n);
  }

  function formatDate(value) {
    if (!value) return "-";
    if (typeof value === "string") return value;
    if (value.toDate && typeof value.toDate === "function") return dateToText(value.toDate());
    if (value.seconds) return dateToText(new Date(value.seconds * 1000));
    return "-";
  }

  function dateToText(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "-";
    var day = String(d.getDate()).padStart(2, "0");
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var year = d.getFullYear();
    return day + "-" + month + "-" + year;
  }

  function compareSeat(a, b) {
    var an = parseInt(String(a || "").replace(/[^d]/g, ""), 10);
    var bn = parseInt(String(b || "").replace(/[^d]/g, ""), 10);
    if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
    return String(a || "").localeCompare(String(b || ""));
  }

  function findParentByClass(el, className) {
    while (el && el !== document) {
      if (el.classList && el.classList.contains(className)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showAlert(message, type) {
    if (!els.alert) return;
    els.alert.className = "seat-alert show " + (type || "info");
    els.alert.textContent = message;
    clearTimeout(showAlert._timer);
    showAlert._timer = setTimeout(function () {
      els.alert.className = "seat-alert";
      els.alert.textContent = "";
    }, 4000);
  }

  window.addEventListener("beforeunload", function () {
    if (typeof state.libraryUnsubscribe === "function") state.libraryUnsubscribe();
    if (typeof state.studentsUnsubscribe === "function") state.studentsUnsubscribe();
  });
})();
