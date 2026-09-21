/* ==========================================================================
   PATS PORTAL - CBT ENGINE CORE (assets/js/cbt-engine.js)
   Engine Utama Panel Pengerjaan Ujian PATS (Solved Forced-Choice Engine)
   ========================================================================== */

class CBTEngine {
  /**
   * @param {object} config - Konfigurasi CBT ({ testCode, testInfo, questions, options, onSubmit, onExit })
   */
  constructor(config) {
    this.testCode = config.testCode || "PATS";
    this.testInfo = config.testInfo || {};
    this.questions = config.questions || [];
    this.options = config.options || [];
    this.onSubmit = config.onSubmit || (() => {});
    this.onExit = config.onExit || (() => { window.location.href = "index.html"; });

    this.currentIndex = 0;
    this.answers = {};
    this.timerInterval = null;
    this.storageKey = `pats_answers_${this.testCode}`;
    this.timerKey = `pats_timer_${this.testCode}`;

    this.init();
  }

  init() {
    // 1. Restore jawaban tersimpan di localStorage jika ada
    const savedAnswers = localStorage.getItem(this.storageKey);
    if (savedAnswers) {
      try {
        this.answers = JSON.parse(savedAnswers);
      } catch (e) {
        this.answers = {};
      }
    }

    // 2. Proteksi Halaman via PATS_AUTH
    if (typeof PATS_AUTH !== "undefined") {
      this.userSession = PATS_AUTH.protectCbtPage(this.testCode);
    } else {
      this.userSession = JSON.parse(sessionStorage.getItem("pats_user_session")) || {
        nama_lengkap: "Peserta/Tester",
        asal_instansi: "PATS System"
      };
    }
  }

  /**
   * Helper internal: Memaksa ekstrasi nilai menjadi STRING MURNI
   */
  _extractVal(val) {
    if (val === null || val === undefined) return "";
    if (typeof val === "object" && val.value !== undefined) return String(val.value).trim();
    return String(val).trim();
  }

  /**
   * Helper internal: Mengecek apakah suatu nomor soal sudah dijawab secara valid
   */
  isQuestionAnswered(questionId) {
    const qKey = String(questionId);
    if (!Object.prototype.hasOwnProperty.call(this.answers, qKey)) return false;

    const ans = this.answers[qKey];
    if (ans === null || ans === undefined || ans === "") return false;

    // Khusus Tipe Forced-Choice (Most & Least HARUS Terisi Dua-duanya)
    if (typeof ans === "object") {
      const m = this._extractVal(ans.most);
      const l = this._extractVal(ans.least);
      return m !== "" && l !== "";
    }

    return true;
  }

  renderApp(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const testTitle = this.testInfo.nama_resmi || this.testInfo.nama_singkat || "Tes Psikometri";
    const userName = this.userSession ? this.userSession.nama_lengkap : "Peserta";
    const userInstansi = this.userSession ? (this.userSession.asal_instansi || "Umum") : "Umum";

    container.innerHTML = `
      <!-- Header Nama Sistem -->
      <div style="text-align: center; padding: 12px 20px; background-color: var(--surface-color, #ffffff); border-bottom: 1px solid var(--border-color, #e2e8f0); margin-bottom: 15px;">
        <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--primary-color, #2563eb); margin: 0;">
          Psikometrik & Aptitude Test System (PATS) Apaca Consulting
        </h2>
      </div>

      <!-- Header Informasi Peserta & Timer -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: var(--surface-color, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-md, 10px); margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary, #64748b);">Pengguna / Tester:</div>
          <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary, #1e293b);">${userName} <span style="font-weight: 400; font-size: 0.85rem; color: var(--text-secondary, #64748b);">(${userInstansi})</span></div>
          <div style="font-size: 0.875rem; font-weight: 600; color: var(--primary-color, #2563eb); margin-top: 2px;">Jenis Tes: ${testTitle}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: var(--text-secondary, #64748b);">Sisa Waktu:</div>
          <div id="cbt-timer-display" style="font-size: 1.25rem; font-weight: 800; color: var(--danger-color, #ef4444);">--:--</div>
        </div>
      </div>

      <!-- Main Panel CBT -->
      <div style="display: grid; grid-template-columns: 260px 1fr; gap: 20px; align-items: start;">
        
        <!-- Sidebar Navigasi Soal (Kiri) -->
        <div style="background: var(--surface-color, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-md, 10px); padding: 16px;">
          <h4 style="font-size: 0.9rem; margin-bottom: 12px; border-bottom: 1px solid var(--border-color, #e2e8f0); padding-bottom: 8px;">Navigasi Soal</h4>
          <div id="cbt-nav-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; max-height: 320px; overflow-y: auto; padding-right: 4px;"></div>

          <div style="margin-top: 20px; border-top: 1px solid var(--border-color, #e2e8f0); padding-top: 16px; display: flex; flex-direction: column; gap: 10px;">
            <button id="cbt-btn-submit" class="btn-primary" style="background-color: var(--success-color, #10b981); width: 100%;">
              Kirim Jawaban
            </button>
            <button id="cbt-btn-exit" style="background-color: transparent; color: var(--danger-color, #ef4444); border: 1px solid var(--danger-color, #ef4444); padding: 8px; border-radius: var(--radius-sm, 6px); font-weight: 600; cursor: pointer; width: 100%;">
              Keluar Tes
            </button>
          </div>
        </div>

        <!-- Panel Pertanyaan (Kanan) -->
        <div style="background: var(--surface-color, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-md, 10px); padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span id="cbt-question-number" style="font-weight: 700; color: var(--primary-color, #2563eb); font-size: 1rem;">Soal No. 1</span>
            <span id="cbt-question-status" style="font-size: 0.8rem; padding: 2px 8px; border-radius: 4px; background: #f1f5f9; color: var(--text-secondary, #64748b);">Belum Dijawab</span>
          </div>

          <div id="cbt-question-text" style="font-size: 1.05rem; margin-bottom: 24px; line-height: 1.6; min-height: 60px;">
            Memuat pertanyaan...
          </div>

          <div id="cbt-options-container" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px;"></div>

          <!-- Footer Control Navigasi -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color, #e2e8f0); padding-top: 16px;">
            <button id="cbt-btn-prev" class="btn-primary" style="width: auto; background-color: var(--secondary-color, #64748b);">&larr; Sebelumnya</button>
            <button id="cbt-btn-next" class="btn-primary" style="width: auto;">Selanjutnya &rarr;</button>
          </div>
        </div>

      </div>
    `;

    document.getElementById("cbt-btn-prev").addEventListener("click", () => this.prevQuestion());
    document.getElementById("cbt-btn-next").addEventListener("click", () => this.nextQuestion());
    document.getElementById("cbt-btn-submit").addEventListener("click", () => this.confirmSubmit());
    document.getElementById("cbt-btn-exit").addEventListener("click", () => this.confirmExit());

    this.startTimer("cbt-timer-display");
    this.renderCurrentQuestion();
  }

  startTimer(displayElementId) {
    const display = document.getElementById(displayElementId);
    const durationLimit = this.testInfo.durasi_menit;

    if (durationLimit === "off" || durationLimit === 0 || !durationLimit) {
      if (display) {
        display.innerText = "Tanpa Batas Waktu";
        display.style.color = "var(--success-color, #10b981)";
        display.style.fontSize = "0.95rem";
      }
      return;
    }

    const totalSeconds = parseInt(durationLimit, 10) * 60;
    let remainingTime = localStorage.getItem(this.timerKey);

    if (!remainingTime) {
      remainingTime = totalSeconds;
    } else {
      remainingTime = parseInt(remainingTime, 10);
    }

    this.timerInterval = setInterval(() => {
      if (remainingTime <= 0) {
        clearInterval(this.timerInterval);
        localStorage.removeItem(this.timerKey);
        if (display) display.innerText = "00:00";
        alert("Waktu pengerjaan tes telah habis! Jawaban Anda akan otomatis dikirim.");
        this.submitExam();
        return;
      }

      remainingTime--;
      localStorage.setItem(this.timerKey, remainingTime);

      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;

      if (display) {
        display.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  renderCurrentQuestion() {
    if (this.questions.length === 0) return;

    const q = this.questions[this.currentIndex];
    const qNumberEl = document.getElementById("cbt-question-number");
    const qStatusEl = document.getElementById("cbt-question-status");
    const qTextEl = document.getElementById("cbt-question-text");
    const optsContainer = document.getElementById("cbt-options-container");

    if (qNumberEl) qNumberEl.innerText = `Soal No. ${this.currentIndex + 1} dari ${this.questions.length}`;
    if (qTextEl) qTextEl.innerHTML = q.pertanyaan;

    const hasAnswered = this.isQuestionAnswered(q.id);
    const selectedVal = this.answers[String(q.id)];

    const availableOptions = (q.options && Array.isArray(q.options) && q.options.length > 0) ? q.options : this.options;
    const isForcedChoice = q.type === "forced_choice" || q.type === "ipsative";

    if (qStatusEl) {
      if (hasAnswered) {
        qStatusEl.innerText = "Sudah Dijawab";
        qStatusEl.style.background = "#dcfce7";
        qStatusEl.style.color = "#15803d";
      } else {
        qStatusEl.innerText = isForcedChoice ? "Belum Dijawab (Pilih Most & Least)" : "Belum Dijawab";
        qStatusEl.style.background = "#f1f5f9";
        qStatusEl.style.color = "#64748b";
      }
    }

    if (isForcedChoice) {
      this.renderForcedChoiceOptions(optsContainer, q, availableOptions, selectedVal);
    } else {
      this.renderStandardOptions(optsContainer, q, availableOptions, selectedVal, hasAnswered);
    }

    const btnPrev = document.getElementById("cbt-btn-prev");
    const btnNext = document.getElementById("cbt-btn-next");

    if (btnPrev) {
      btnPrev.style.visibility = this.currentIndex === 0 ? "hidden" : "visible";
      btnPrev.innerHTML = "← Sebelumnya";
    }
    if (btnNext) {
      btnNext.innerHTML = this.currentIndex === this.questions.length - 1 ? "Selesai →" : "Selanjutnya →";
    }

    this.renderNavGrid();
  }

  // --- RENDERER A: Standard / Single Choice (Likert & Pilihan Ganda) ---
  renderStandardOptions(container, q, options, selectedVal, hasAnswered) {
    let optsHtml = "";
    options.forEach(opt => {
      const optStr = this._extractVal(opt.value);
      const selStr = this._extractVal(selectedVal);
      const isChecked = (hasAnswered && selStr === optStr) ? "checked" : "";
      const bgActive = isChecked ? "background-color: #eff6ff; border-color: var(--primary-color, #2563eb);" : "";
      const safeVal = optStr.replace(/'/g, "\\'");

      optsHtml += `
        <label style="display: flex; align-items: center; padding: 12px 16px; border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-sm, 6px); cursor: pointer; transition: all 0.2s; ${bgActive}">
          <input type="radio" name="opt_${q.id}" value="${optStr}" ${isChecked} style="margin-right: 12px; accent-color: var(--primary-color, #2563eb);" onchange="cbtApp.saveAnswer('${q.id}', '${safeVal}')">
          <span style="font-size: 0.95rem; color: var(--text-primary, #1e293b);">${opt.label}</span>
        </label>
      `;
    });
    if (container) container.innerHTML = optsHtml;
  }

  // --- RENDERER B: FORCED-CHOICE IPSATIVE (REVISI SOLVED TOTAL) ---
  renderForcedChoiceOptions(container, q, options, selectedVal) {
    let currentMost = "";
    let currentLeast = "";

    if (selectedVal && typeof selectedVal === "object") {
      currentMost = this._extractVal(selectedVal.most);
      currentLeast = this._extractVal(selectedVal.least);
    }

    let tableHtml = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 10px; text-align: left; color: #1e293b;">Pilihan Pernyataan</th>
              <th style="padding: 10px; text-align: center; width: 140px; color: #10b981;">Paling Efektif<br><small style="font-weight: 400; color: #64748b;">(+2 Poin)</small></th>
              <th style="padding: 10px; text-align: center; width: 140px; color: #ef4444;">Paling Tidak Efektif<br><small style="font-weight: 400; color: #64748b;">(-1 Poin)</small></th>
            </tr>
          </thead>
          <tbody>
    `;

    options.forEach((opt, idx) => {
      const optValStr = this._extractVal(opt.value);
      const isMostChecked = (currentMost !== "" && currentMost === optValStr) ? "checked" : "";
      const isLeastChecked = (currentLeast !== "" && currentLeast === optValStr) ? "checked" : "";
      const safeVal = optValStr.replace(/'/g, "\\'");

      tableHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 10px; color: #1e293b; font-weight: 500;">${opt.label}</td>
          <td style="padding: 12px 10px; text-align: center; background-color: ${isMostChecked ? '#ecfdf5' : 'transparent'};">
            <input type="radio" 
              id="radio_m_${q.id}_${idx}" 
              name="fc_most_${q.id}" 
              value="${optValStr}" 
              ${isMostChecked} 
              style="accent-color: #10b981; transform: scale(1.25); cursor: pointer;" 
              onclick="cbtApp.saveForcedChoiceAnswer('${q.id}', 'most', '${safeVal}')">
          </td>
          <td style="padding: 12px 10px; text-align: center; background-color: ${isLeastChecked ? '#fef2f2' : 'transparent'};">
            <input type="radio" 
              id="radio_l_${q.id}_${idx}" 
              name="fc_least_${q.id}" 
              value="${optValStr}" 
              ${isLeastChecked} 
              style="accent-color: #ef4444; transform: scale(1.25); cursor: pointer;" 
              onclick="cbtApp.saveForcedChoiceAnswer('${q.id}', 'least', '${safeVal}')">
          </td>
        </tr>
      `;
    });

    tableHtml += `
          </tbody>
        </table>
      </div>
      <div style="font-size: 0.8rem; color: #64748b; margin-top: 10px; font-style: italic;">
        *Catatan: Opsi yang tidak dipilih otomatis menjadi Pilihan Netral (0 Poin). Pernyataan yang sama tidak bisa dipilih sebagai Most dan Least sekaligus.
      </div>
    `;

    if (container) container.innerHTML = tableHtml;
  }

  saveAnswer(questionId, value) {
    this.answers[String(questionId)] = this._extractVal(value);
    localStorage.setItem(this.storageKey, JSON.stringify(this.answers));
    this.renderCurrentQuestion();
  }

  /**
   * Logika Penanganan Forced Choice Tanpa Mengganggu DOM Native
   */
  saveForcedChoiceAnswer(questionId, targetType, valueStr) {
    const qKey = String(questionId);
    let currentAns = this.answers[qKey];

    if (!currentAns || typeof currentAns !== "object") {
      currentAns = { most: "", least: "" };
    } else {
      currentAns = {
        most: this._extractVal(currentAns.most),
        least: this._extractVal(currentAns.least)
      };
    }

    const cleanVal = this._extractVal(valueStr);

    if (targetType === "most") {
      currentAns.most = cleanVal;
      // Guard: Jika opsi yang sama dipilih pada least, bersihkan least
      if (currentAns.least === cleanVal) {
        currentAns.least = "";
      }
    } else if (targetType === "least") {
      currentAns.least = cleanVal;
      // Guard: Jika opsi yang sama dipilih pada most, bersihkan most
      if (currentAns.most === cleanVal) {
        currentAns.most = "";
      }
    }

    // Simpan ke state memori & localStorage
    this.answers[qKey] = currentAns;
    localStorage.setItem(this.storageKey, JSON.stringify(this.answers));

    // Render ulang tampilan soal aktif agar status centang & warna background konsisten penuh
    this.renderCurrentQuestion();
  }

  renderNavGrid() {
    const gridContainer = document.getElementById("cbt-nav-grid");
    if (!gridContainer) return;

    let gridHtml = "";
    this.questions.forEach((q, idx) => {
      const isCurrent = idx === this.currentIndex;
      const isAnswered = this.isQuestionAnswered(q.id);

      let style = "padding: 8px 0; font-size: 0.85rem; font-weight: 700; border-radius: 6px; cursor: pointer; text-align: center; border: 1px solid #e2e8f0;";

      if (isCurrent) {
        style += " background-color: var(--primary-color, #2563eb); color: #ffffff; border-color: var(--primary-color, #2563eb);";
      } else if (isAnswered) {
        style += " background-color: #10b981; color: #ffffff; border-color: #10b981;";
      } else {
        style += " background-color: #f8fafc; color: #64748b;";
      }

      gridHtml += `<button onclick="cbtApp.jumpToQuestion(${idx})" style="${style}">${idx + 1}</button>`;
    });

    gridContainer.innerHTML = gridHtml;
  }

  jumpToQuestion(index) {
    if (index >= 0 && index < this.questions.length) {
      this.currentIndex = index;
      this.renderCurrentQuestion();
    }
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.renderCurrentQuestion();
    } else {
      this.confirmSubmit();
    }
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderCurrentQuestion();
    }
  }

  confirmSubmit() {
    let answeredCount = 0;
    this.questions.forEach(q => {
      if (this.isQuestionAnswered(q.id)) answeredCount++;
    });

    const totalCount = this.questions.length;

    let confirmMsg = `Anda telah menjawab ${answeredCount} dari ${totalCount} soal. Apakah Anda yakin ingin mengirimkan jawaban?`;
    if (answeredCount < totalCount) {
      confirmMsg = `Masih ada ${totalCount - answeredCount} soal yang belum dijawab lengkap. Yakin ingin langsung mengirimkan jawaban sekarang?`;
    }

    if (confirm(confirmMsg)) {
      this.submitExam();
    }
  }

  confirmExit() {
    if (confirm("Apakah Anda yakin ingin keluar dari tes? Progress jawaban Anda tersimpan sementara.")) {
      this.stopTimer();
      this.onExit();
    }
  }

  submitExam() {
    this.stopTimer();
    
    sessionStorage.setItem(`pats_answers_${this.testCode}`, JSON.stringify(this.answers));

    if (typeof PATS_AUTH !== "undefined") {
      const currentUserName = this.userSession ? this.userSession.nama_lengkap : "";
      PATS_AUTH.markAsCompleted(this.testCode, currentUserName);
    }

    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.timerKey);

    this.onSubmit(this.answers);
  }
}
