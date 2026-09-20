/* ==========================================================================
   PATS PORTAL - CBT ENGINE CORE (assets/js/cbt-engine.js)
   Engine Utama Panel Pengerjaan Ujian PATS
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
   * Menginjeksi dan merender layout UI CBT secara terpadu di dalam container target
   * @param {string} containerId - ID elemen HTML penampung (misal: 'cbt-app')
   */
  renderApp(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const testTitle = this.testInfo.nama_resmi || this.testInfo.nama_singkat || "Tes Psikometri";
    const userName = this.userSession ? this.userSession.nama_lengkap : "Peserta";
    const userInstansi = this.userSession ? (this.userSession.asal_instansi || "Umum") : "Umum";

    container.innerHTML = `
      <!-- Header Nama Sistem (Rata Tengah) -->
      <div style="text-align: center; padding: 12px 20px; background-color: var(--surface-color, #ffffff); border-bottom: 1px solid var(--border-color, #e2e8f0); margin-bottom: 15px;">
        <h2 style="font-size: 1.15rem; font-weight: 800; color: var(--primary-color, #2563eb); margin: 0;">
          Psikometrik & Aptitude Test System (PATS) Apaca Consulting
        </h2>
      </div>

      <!-- Header Informasi Peserta & Timer -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: var(--surface-color, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-md, 10px); margin-bottom: 20px;">
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

      <!-- Main Panel CBT (Navigasi Kiri + Panel Soal Kanan) -->
      <div style="display: grid; grid-template-columns: 260px 1fr; gap: 20px; align-items: start;">
        
        <!-- Sidebar Navigasi Soal (Kiri) -->
        <div style="background: var(--surface-color, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-md, 10px); padding: 16px;">
          <h4 style="font-size: 0.9rem; margin-bottom: 12px; border-bottom: 1px solid var(--border-color, #e2e8f0); padding-bottom: 8px;">Navigasi Soal</h4>
          <div id="cbt-nav-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; max-height: 320px; overflow-y: auto; padding-right: 4px;">
            <!-- Buttons nomor soal di-generate otomatis -->
          </div>

          <!-- Tombol Aksi Tambahan di Sidebar -->
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

          <div id="cbt-options-container" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px;">
            <!-- Opsi Opsi Pertanyaan -->
          </div>

          <!-- Footer Control Navigasi -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color, #e2e8f0); padding-top: 16px;">
            <button id="cbt-btn-prev" class="btn-primary" style="width: auto; background-color: var(--secondary-color, #64748b);">&larr; Sebelumnya</button>
            <button id="cbt-btn-next" class="btn-primary" style="width: auto;">Selanjutnya &rarr;</button>
          </div>
        </div>

      </div>
    `;

    // Event Listener Tombol Navigasi Utama
    document.getElementById("cbt-btn-prev").addEventListener("click", () => this.prevQuestion());
    document.getElementById("cbt-btn-next").addEventListener("click", () => this.nextQuestion());
    document.getElementById("cbt-btn-submit").addEventListener("click", () => this.confirmSubmit());
    document.getElementById("cbt-btn-exit").addEventListener("click", () => this.confirmExit());

    // Inisialisasi Timer
    this.startTimer("cbt-timer-display");

    // Render Pertanyaan Pertama
    this.renderCurrentQuestion();
  }

  // --- LOGIC TIMER DYNAMIS ---
  startTimer(displayElementId) {
    const display = document.getElementById(displayElementId);
    const durationLimit = this.testInfo.durasi_menit;

    // Cek apakah tes TIDAK MENGGUNAKAN BATAS WAKTU ("off", 0, null, undefined)
    if (durationLimit === "off" || durationLimit === 0 || !durationLimit) {
      if (display) {
        display.innerText = "Tanpa Batas Waktu";
        display.style.color = "var(--success-color, #10b981)";
        display.style.fontSize = "0.95rem";
      }
      return; // Tidak mengaktifkan setInterval
    }

    // Menggunakan Sistem Countdown Timer
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
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  // --- LOGIC RENDER SOAL & NAVIGASI ---
  renderCurrentQuestion() {
    if (this.questions.length === 0) return;

    const q = this.questions[this.currentIndex];
    const qNumberEl = document.getElementById("cbt-question-number");
    const qStatusEl = document.getElementById("cbt-question-status");
    const qTextEl = document.getElementById("cbt-question-text");
    const optsContainer = document.getElementById("cbt-options-container");

    if (qNumberEl) qNumberEl.innerText = `Soal No. ${this.currentIndex + 1} dari ${this.questions.length}`;
    if (qTextEl) qTextEl.innerText = q.pertanyaan;

    const selectedVal = this.answers[q.id];

    if (qStatusEl) {
      if (selectedVal !== undefined) {
        qStatusEl.innerText = "Sudah Dijawab";
        qStatusEl.style.background = "#dcfce7";
        qStatusEl.style.color = "#15803d";
      } else {
        qStatusEl.innerText = "Belum Dijawab";
        qStatusEl.style.background = "#f1f5f9";
        qStatusEl.style.color = "#64748b";
      }
    }

    // Render Pilihan Jawaban
    let optsHtml = "";
    this.options.forEach(opt => {
      const isChecked = selectedVal === opt.value ? "checked" : "";
      const bgActive = selectedVal === opt.value ? "background-color: #eff6ff; border-color: var(--primary-color, #2563eb);" : "";

      optsHtml += `
        <label style="display: flex; align-items: center; padding: 12px 16px; border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-sm, 6px); cursor: pointer; transition: all 0.2s; ${bgActive}">
          <input type="radio" name="opt_${q.id}" value="${opt.value}" ${isChecked} style="margin-right: 12px; accent-color: var(--primary-color, #2563eb);" onchange="cbtApp.saveAnswer(${q.id}, ${opt.value})">
          <span style="font-size: 0.95rem; color: var(--text-primary, #1e293b);">${opt.label}</span>
        </label>
      `;
    });
    if (optsContainer) optsContainer.innerHTML = optsHtml;

    // Update Status Tombol Prev/Next (Penggunaan innerHTML untuk merender entitas HTML)
    const btnPrev = document.getElementById("cbt-btn-prev");
    const btnNext = document.getElementById("cbt-btn-next");

    if (btnPrev) {
      btnPrev.style.visibility = this.currentIndex === 0 ? "hidden" : "visible";
      btnPrev.innerHTML = "← Sebelumnya";
    }
    
    if (btnNext) {
      btnNext.innerHTML = this.currentIndex === this.questions.length - 1 ? "Selesai →" : "Selanjutnya →";
    }

    // Render Ulang Sidebar Grid Nomor Soal
    this.renderNavGrid();
  }

  renderNavGrid() {
    const gridContainer = document.getElementById("cbt-nav-grid");
    if (!gridContainer) return;

    let gridHtml = "";
    this.questions.forEach((q, idx) => {
      const isCurrent = idx === this.currentIndex;
      const isAnswered = this.answers[q.id] !== undefined;

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

  saveAnswer(questionId, value) {
    this.answers[questionId] = value;
    localStorage.setItem(this.storageKey, JSON.stringify(this.answers));
    this.renderCurrentQuestion();
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
    const answeredCount = Object.keys(this.answers).length;
    const totalCount = this.questions.length;

    let confirmMsg = `Anda telah menjawab ${answeredCount} dari ${totalCount} soal. Apakah Anda yakin ingin mengirimkan jawaban?`;
    if (answeredCount < totalCount) {
      confirmMsg = `Masih ada ${totalCount - answeredCount} soal yang belum dijawab. Yakin ingin langsung mengirimkan jawaban sekarang?`;
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
    
    // Simpan data jawaban akhir ke SessionStorage untuk dibaca oleh result.html
    sessionStorage.setItem(`pats_answers_${this.testCode}`, JSON.stringify(this.answers));

    // Tandai status selesai pada PATS_AUTH
    if (typeof PATS_AUTH !== "undefined") {
      PATS_AUTH.markAsCompleted(this.testCode);
    }

    // Clear data sementara
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.timerKey);

    // Jalankan callback penyerahan
    this.onSubmit(this.answers);
  }
}
