(function () {
  var db = firebase.firestore();
  var libraryId = sessionStorage.getItem("session_library_id");
  var role = sessionStorage.getItem("session_role");

  var state = {
    students: [],
    filteredStudents: [],
    capacity: {
      total: null,
      morning: null,
      afternoon: null,
      evening: null
    },
    selectedStudent: null,
    searchTerm: "",
    libraryUnsubscribe: null,
    studentsUnsubscribe: null
  };

  var els = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheDom();
    guardAccess();
    bindEvents();
    startRealtimeListeners();
  });

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

  function guardAccess() {
    if (role !== "admin") {
      showAlert("Only admin can access Seat Management.", "error");
      setTimeout(function () {
        window.location.href = "../index.html";
      }, 800);
      throw new Error("Unauthorized access.");
    }

    if (!libraryId) {
      showAlert("Library session is missing. Please login again.", "error");
      setTimeout(function () {
        window.location.href = "../index.html";
      }, 800);
      throw new Error("Missing library session.");
    }
  }

  function bindEvents() {
    els.availableCard.addEventListener("click", function (event) {
      if (clickedInsideStudentItem(event)) return;
      toggleCard("available");
    });

    els.occupiedCard.addEventListener("click", function (event) {
      if (clickedInsideStudentItem(event)) return;
      toggleCard("occupied");
    });

    els.availableCard.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCard("available");
      }
    });

    els.occupiedCard.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCard("occupied");
      }
    });

    els.searchInput.addEventListener("input", function () {
      state.searchTerm = (els.searchInput.value || "").trim().toLowerCase();
      renderOccupiedDetails();
    });

    els.btnConfigureCapacity.addEventListener("click", openCapacityModal);
    els.closeCapacityModal.addEventListener("click", closeCapacityModal);
    els.cancelCapacityBtn.addEventListener("click", closeCapacityModal);

    els.capacityModal.addEventListener("click", function (event) {
      if (event.target === els.capacityModal) {
        closeCapacityModal();
      }
    });

    els.studentModal.addEventListener("click", function (event) {
      if (event.target === els.studentModal) {
        closeStudentModal();
      }
    });

    els.closeStudentModal.addEventListener("click", closeStudentModal);
    els.closeStudentDetailsBtn.addEventListener("click", closeStudentModal);

    els.openStudentProfileBtn.addEventListener("click", function () {
      if (!state.selectedStudent) return;

      sessionStorage.setItem("selected_student_id", state.selectedStudent.id);
      sessionStorage.setItem("selected_student_code", state.selectedStudent.studentCode || "");
      window.location.href = "./student-profile.html?id=" + encodeURIComponent(state.selectedStudent.id);
    });

    els.capacityForm.addEventListener("submit", handleCapacitySubmit);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeCapacityModal();
        closeStudentModal();
      }
    });

    els.occupiedDetailsWrap.addEventListener("click", function (event) {
      var item = event.target.closest(".student-item");
      if (!item) return;

      event.stopPropagation();

      var studentId = item.getAttribute("data-student-id");
      var student = findStudentById(studentId);
      if (!student) return;

      openStudentModal(student);
    });
  }

  function startRealtimeListeners() {
    var libraryRef = db.collection("saas_libraries").doc(libraryId);
    var studentsRef = libraryRef.collection("students");

    state.libraryUnsubscribe = libraryRef.onSnapshot(function (doc) {
      if (doc.exists) {
        var data = doc.data() || {};
        state.capacity = {
          total: parseCapacityValue(data.totalCapacity),
          morning: parseCapacityValue(data.morningCapacity),
          afternoon: parseCapacityValue(data.afternoonCapacity),
          evening: parseCapacityValue(data.eveningCapacity)
        };
      } else {
        state.capacity = {
          total: null,
          morning: null,
          afternoon: null,
          evening: null
        };
      }

      fillCapacityForm();
      renderAll();
    }, function () {
      showAlert("Failed to load library capacity.", "error");
    });

    state.studentsUnsubscribe = studentsRef.onSnapshot(function (snapshot) {
      var students = [];

      snapshot.forEach(function (doc) {
        var data = doc.data() || {};
        if (isOccupiedStudent(data)) {
          students.push({
            id: doc.id,
            studentCode: safeText(data.studentCode),
            seatNumber: safeText(data.seatNumber),
            name: safeText(data.name),
            fatherName: safeText(data.fatherName),
            studentClass: safeText(data.studentClass),
            shift: normalizeShift(data.shift),
            joiningDate: formatDateValue(data.joiningDate),
            expiryDate: formatDateValue(data.expiryDate),
            status: safeText(data.status),
            raw: data
          });
        }
      });

      students.sort(function (a, b) {
        return compareSeatNumbers(a.seatNumber, b.seatNumber);
      });

      state.students = students;
      renderAll();
    }, function () {
      showAlert("Failed to load students data.", "error");
    });
  }

  function renderAll() {
    renderSummaryCards();
    renderAvailableDetails();
    renderOccupiedDetails();
  }

  function renderSummaryCards() {
    var occupiedCount = state.students.length;
    var capacity = getResolvedCapacity();
    var hasConfiguredCapacity = capacity.total !== null;

    if (!hasConfiguredCapacity) {
      els.totalSeatsValue.textContent = "—";
      els.availableSeatsValue.textContent = "—";
      els.occupiedSeatsValue.textContent = occupiedCount;

      els.totalSeatsSubtext.textContent = "Capacity not configured";
      els.availableSeatsSubtext.textContent = "Capacity not configured. Click to view shift-wise status.";
      els.occupiedSeatsSubtext.textContent = occupiedCount > 0
        ? "Click to view occupied seat details."
        : "No occupied seats found.";

      els.capacityBadge.style.display = "none";
    } else {
      var availableCount = Math.max(capacity.total - occupiedCount, 0);

      els.totalSeatsValue.textContent = capacity.total;
      els.availableSeatsValue.textContent = availableCount;
      els.occupiedSeatsValue.textContent = occupiedCount;

      els.totalSeatsSubtext.textContent = "Configured library capacity";
      els.availableSeatsSubtext.textContent = "Calculated from total capacity minus occupied students.";
      els.occupiedSeatsSubtext.textContent = occupiedCount > 0
        ? "Click to view occupied seat details."
        : "No occupied seats found.";

      els.capacityBadge.style.display = "inline-flex";
      els.capacityBadge.textContent = "Configured";
    }
  }

  function renderAvailableDetails() {
    var capacity = getResolvedCapacity();
    var occupiedByShift = getOccupiedByShift();

    if (!capacity.totalConfigured && !capacity.shiftConfigured) {
      els.availableDetailsWrap.innerHTML =
        '<div class="seat-empty-state">Capacity not configured yet. Use <strong>Configure Capacity</strong> to save total and shift-wise capacity in the current library document.</div>';
      return;
    }

    var rows = [
      buildShiftItem("Morning", occupiedByShift.Morning, capacity.morning),
      buildShiftItem("Afternoon", occupiedByShift.Afternoon, capacity.afternoon),
      buildShiftItem("Evening", occupiedByShift.Evening, capacity.evening)
    ];

    els.availableDetailsWrap.innerHTML = rows.join("");
  }

  function renderOccupiedDetails() {
    var filtered = getFilteredStudents();
    state.filteredStudents = filtered;

    if (!state.students.length) {
      els.occupiedDetailsWrap.innerHTML =
        '<div class="seat-empty-state">No occupied seats found in the current students collection.</div>';
      return;
    }

    if (!filtered.length) {
      els.occupiedDetailsWrap.innerHTML =
        '<div class="seat-empty-state">No occupied seats matched your search.</div>';
      return;
    }

    var html = filtered.map(function (student) {
      return [
        '<div class="student-item" data-student-id="', escapeHtml(student.id), '">',
          '<div class="student-item-row">',
            '<div>',
              '<div class="student-seat">Seat ', escapeHtml(student.seatNumber || "-"), '</div>',
              '<div class="student-meta">',
                '<span><span class="seat-mini-label">Shift:</span> <strong>', escapeHtml(student.shift || "-"), '</strong></span>',
                '<span><span class="seat-mini-label">Status:</span> <strong>', escapeHtml(student.status || "-"), '</strong></span>',
              '</div>',
            '</div>',
            '<div style="text-align:right;">',
              '<div class="student-name">', escapeHtml(student.name || "-"), '</div>',
              '<div class="student-code">', escapeHtml(student.studentCode || "-"), '</div>',
            '</div>',
          '</div>',
        '</div>'
      ].join("");
    }).join("");

    els.occupiedDetailsWrap.innerHTML = html;
  }

  function buildShiftItem(shiftName, occupiedCount, capacityValue) {
    var availableValue = capacityValue === null ? "—" : Math.max(capacityValue - occupiedCount, 0);

    return [
      '<div class="shift-item">',
        '<div class="shift-item-row">',
          '<div class="shift-name">', escapeHtml(shiftName), '</div>',
        '</div>',
        '<div class="shift-meta">',
          '<span><span class="seat-mini-label">Occupied:</span> <span class="seat-mini-value">', escapeHtml(String(occupiedCount)), '</span></span>',
          '<span><span class="seat-mini-label">Available:</span> <span class="seat-mini-value">', escapeHtml(String(availableValue)), '</span></span>',
        '</div>',
      '</div>'
    ].join("");
  }

  function toggleCard(cardType) {
    var isAvailable = cardType === "available";
    var cardEl = isAvailable ? els.availableCard : els.occupiedCard;
    var toggleText = isAvailable ? els.availableToggleText : els.occupiedToggleText;
    var expanded = cardEl.classList.contains("expanded");

    if (expanded) {
      cardEl.classList.remove("expanded");
      cardEl.setAttribute("aria-expanded", "false");
      toggleText.textContent = "View Details";
    } else {
      cardEl.classList.add("expanded");
      cardEl.setAttribute("aria-expanded", "true");
      toggleText.textContent = "Hide Details";
    }
  }

  function openCapacityModal() {
    fillCapacityForm();
    els.capacityModal.classList.add("show");
    els.capacityModal.setAttribute("aria-hidden", "false");
  }

  function closeCapacityModal() {
    els.capacityModal.classList.remove("show");
    els.capacityModal.setAttribute("aria-hidden", "true");
  }

  function fillCapacityForm() {
    els.totalCapacityInput.value = state.capacity.total !== null ? state.capacity.total : "";
    els.morningCapacityInput.value = state.capacity.morning !== null ? state.capacity.morning : "";
    els.afternoonCapacityInput.value = state.capacity.afternoon !== null ? state.capacity.afternoon : "";
    els.eveningCapacityInput.value = state.capacity.evening !== null ? state.capacity.evening : "";
  }

  function handleCapacitySubmit(event) {
    event.preventDefault();

    var total = parseInputNumber(els.totalCapacityInput.value);
    var morning = parseInputNumber(els.morningCapacityInput.value);
    var afternoon = parseInputNumber(els.afternoonCapacityInput.value);
    var evening = parseInputNumber(els.eveningCapacityInput.value);

    if (total === null && morning === null && afternoon === null && evening === null) {
      showAlert("Please enter capacity before saving.", "error");
      return;
    }

    if (total !== null) {
      if (morning === null) morning = total;
      if (afternoon === null) afternoon = total;
      if (evening === null) evening = total;
    }

    var payload = {
      totalCapacity: total,
      morningCapacity: morning,
      afternoonCapacity: afternoon,
      eveningCapacity: evening,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    els.saveCapacityBtn.disabled = true;
    els.saveCapacityBtn.textContent = "Saving...";

    db.collection("saas_libraries").doc(libraryId).set(payload, { merge: true })
      .then(function () {
        showAlert("Capacity saved successfully.", "success");
        closeCapacityModal();
      })
      .catch(function () {
        showAlert("Failed to save capacity.", "error");
      })
      .finally(function () {
        els.saveCapacityBtn.disabled = false;
        els.saveCapacityBtn.textContent = "Save Capacity";
      });
  }

  function openStudentModal(student) {
    state.selectedStudent = student;

    els.modalSeatNumber.textContent = student.seatNumber || "-";
    els.modalStudentCode.textContent = student.studentCode || "-";
    els.modalStudentName.textContent = student.name || "-";
    els.modalFatherName.textContent = student.fatherName || "-";
    els.modalStudentClass.textContent = student.studentClass || "-";
    els.modalStudentShift.textContent = student.shift || "-";
    els.modalStudentStatus.textContent = student.status || "-";
    els.modalJoiningDate.textContent = student.joiningDate || "-";
    els.modalExpiryDate.textContent = student.expiryDate || "-";

    els.studentModal.classList.add("show");
    els.studentModal.setAttribute("aria-hidden", "false");
  }

  function closeStudentModal() {
    els.studentModal.classList.remove("show");
    els.studentModal.setAttribute("aria-hidden", "true");
  }

  function getFilteredStudents() {
    if (!state.searchTerm) {
      return state.students.slice();
    }

    return state.students.filter(function (student) {
      var seat = (student.seatNumber || "").toLowerCase();
      var name = (student.name || "").toLowerCase();
      var code = (student.studentCode || "").toLowerCase();

      return seat.indexOf(state.searchTerm) !== -1 ||
        name.indexOf(state.searchTerm) !== -1 ||
        code.indexOf(state.searchTerm) !== -1;
    });
  }

  function getOccupiedByShift() {
    var counts = {
      Morning: 0,
      Afternoon: 0,
      Evening: 0
    };

    state.students.forEach(function (student) {
      var shift = normalizeShift(student.shift);
      if (counts.hasOwnProperty(shift)) {
        counts[shift] += 1;
      }
    });

    return counts;
  }

  function getResolvedCapacity() {
    var total = parseCapacityValue(state.capacity.total);
    var morning = parseCapacityValue(state.capacity.morning);
    var afternoon = parseCapacityValue(state.capacity.afternoon);
    var evening = parseCapacityValue(state.capacity.evening);

    if (total !== null) {
      if (morning === null) morning = total;
      if (afternoon === null) afternoon = total;
      if (evening === null) evening = total;
    }

    return {
      total: total,
      morning: morning,
      afternoon: afternoon,
      evening: evening,
      totalConfigured: total !== null,
      shiftConfigured: morning !== null || afternoon !== null || evening !== null
    };
  }

  function isOccupiedStudent(data) {
    var seat = safeText(data.seatNumber);
    return seat !== "";
  }

  function normalizeShift(value) {
    var shift = safeText(value).toLowerCase();

    if (shift === "morning") return "Morning";
    if (shift === "afternoon") return "Afternoon";
    if (shift === "evening") return "Evening";

    return safeText(value) || "-";
  }

  function parseCapacityValue(value) {
    if (value === null || value === undefined || value === "") return null;
    var num = Number(value);
    if (isNaN(num) || num < 0) return null;
    return Math.floor(num);
  }

  function parseInputNumber(value) {
    var trimmed = String(value || "").trim();
    if (trimmed === "") return null;

    var num = Number(trimmed);
    if (isNaN(num) || num < 0) return null;

    return Math.floor(num);
  }

  function formatDateValue(value) {
    if (!value) return "-";

    if (typeof value === "string") return value;

    if (value.toDate && typeof value.toDate === "function") {
      return formatDate(value.toDate());
    }

    if (value.seconds) {
      return formatDate(new Date(value.seconds * 1000));
    }

    return "-";
  }

  function formatDate(dateObj) {
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "-";

    var day = String(dateObj.getDate()).padStart(2, "0");
    var month = String(dateObj.getMonth() + 1).padStart(2, "0");
    var year = dateObj.getFullYear();

    return day + "-" + month + "-" + year;
  }

  function compareSeatNumbers(a, b) {
    var aText = String(a || "");
    var bText = String(b || "");

    var aNum = parseInt(aText.replace(/[^d]/g, ""), 10);
    var bNum = parseInt(bText.replace(/[^d]/g, ""), 10);

    if (!isNaN(aNum) && !isNaN(bNum) && aNum !== bNum) {
      return aNum - bNum;
    }

    return aText.localeCompare(bText);
  }

  function findStudentById(id) {
    for (var i = 0; i < state.students.length; i++) {
      if (state.students[i].id === id) {
        return state.students[i];
      }
    }
    return null;
  }

  function clickedInsideStudentItem(event) {
    return !!event.target.closest(".student-item");
  }

  function safeText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function escapeHtml(value) {
    return String(value)
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
    }, 3500);
  }

  window.addEventListener("beforeunload", function () {
    if (typeof state.libraryUnsubscribe === "function") {
      state.libraryUnsubscribe();
    }
    if (typeof state.studentsUnsubscribe === "function") {
      state.studentsUnsubscribe();
    }
  });
})();
