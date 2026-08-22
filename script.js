// ==========================================================
// CAT KIBI Versi 1.3.0 - Core Engine (Isolated CAT System)
// Fitur: Verifikasi 2 Langkah (Cek Verifikasi -> Auto-Fill -> Lanjut)
// ==========================================================

// Variable Global
let WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxmbv39mAlkNHNVb_wf2FMYJj211LVFmtmv-3oc_SknwgbR1MjD_IhIA_XqED2Q020/exec"; 
let questionsDataConfig = {};
let questionsData = [];
let validToken = "";
let timerDurationMinutes = 60;
let currentIndex = 0;
let userAnswers = {}; 
let userIdentitas = {};
let timerInterval = null;
let currentKodeUjian = "";

// State Verifikasi Peserta
let isVerified = false;
let verifiedPesertaData = null;

// Variable Mode Ujian & Verifikasi Peserta Versi 1.3.0
let modeUjian = "LATIHAN"; // Default
let daftarPesertaValid = [];

// Variable Anti-Kecurangan & Submit Lock
let isExamStarted = false;
let isExamSubmitted = false;
let warningCount = 0;
const MAX_WARNINGS = 3;

// ==========================================================
// HELPER: UTILS VERIFIKASI PESERTA (VERSI 1.3.0 - UX REVISION)
// ==========================================================
async function loadDaftarPeserta() {
  try {
    const response = await fetch("peserta.json");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        daftarPesertaValid = data;
      } else {
        daftarPesertaValid = [];
        console.warn("Format peserta.json bukan array.");
      }
    } else {
      daftarPesertaValid = [];
      console.warn("File peserta.json tidak ditemukan.");
    }
  } catch (err) {
    daftarPesertaValid = [];
    console.error("Gagal membaca peserta.json:", err);
  }
}

// Auto-Fill Form Identitas berdasarkan data peserta terverifikasi
function autoFillIdentitas(dataPeserta) {
  const setInputValue = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };

  setInputValue("sekolah", dataPeserta["Asal Instansi"]);
  setInputValue("kelas", dataPeserta["Pekerjaan / Jurusan"]);
  setInputValue("nisn", dataPeserta["NIK / NISN / NIM"]);
  setInputValue("daerah", `${dataPeserta["Asal Kabupaten"] || ''}, ${dataPeserta["Asal Provinsi"] || ''}`.replace(/^,\s*|,\s*$/g, ''));
  setInputValue("email", dataPeserta["Email (Terverifikasi)"]);
  setInputValue("hp", dataPeserta["No HP / WA"]);
}

// ==========================================================
// 1. TAHAP 1: CEK VERIFIKASI PESERTA (BUTTON CLICK)
// ==========================================================
async function cekVerifikasiPeserta() {
  const kodeInput = document.getElementById("kode-ujian-input").value.trim().toUpperCase();
  const inputNamaRaw = document.getElementById("nama").value.trim();
  const inputNama = inputNamaRaw.toUpperCase();
  
  // Format tampilan input nama di form menjadi UPPERCASE secara otomatis
  document.getElementById("nama").value = inputNama;

  const errorElement = document.getElementById("pesan-error-login");
  const btnLanjut = document.getElementById("btn-lanjut-info");
  const btnCek = document.getElementById("btn-cek-verifikasi");

  if (!inputNama) {
    errorElement.className = "text-danger mt-2 alert alert-danger";
    errorElement.innerHTML = "Silakan masukkan Nama Lengkap Anda!";
    return;
  }
  if (!kodeInput) {
    errorElement.className = "text-danger mt-2 alert alert-danger";
    errorElement.innerHTML = "Silakan masukkan Kode Ujian / Kode Kegiatan!";
    return;
  }

  if (btnCek) btnCek.disabled = true;
  errorElement.className = "text-info mt-2 alert alert-info";
  errorElement.innerHTML = "Memeriksa database peserta.json...";

  try {
    await loadDaftarPeserta();

    if (!daftarPesertaValid || daftarPesertaValid.length === 0) {
      throw new Error("Sistem tidak dapat memverifikasi peserta: Database peserta.json tidak ditemukan atau kosong!");
    }

    // Mencari match data: Kode Ujian === Kode Kegiatan DAN Nama Lengkap === Nama Input
    const pesertaMatch = daftarPesertaValid.find(p => {
      const kodeMatch = String(p["Kode Kegiatan"] || "").trim().toUpperCase() === kodeInput;
      const namaMatch = String(p["Nama Lengkap"] || "").trim().toUpperCase() === inputNama;
      return kodeMatch && namaMatch;
    });

    if (pesertaMatch) {
      isVerified = true;
      verifiedPesertaData = pesertaMatch;

      // Auto-fill field pendukung jika elemen ada di DOM
      autoFillIdentitas(pesertaMatch);

      // Notifikasi Sukses
      errorElement.className = "text-success mt-2 alert alert-success";
      errorElement.innerHTML = "<strong>Selamat Anda Terverifikasi</strong>";

      // Tampilkan / Aktifkan tombol Lanjut ke Petunjuk
      if (btnLanjut) {
        btnLanjut.style.display = "inline-block";
        btnLanjut.disabled = false;
      }
    } else {
      isVerified = false;
      verifiedPesertaData = null;

      if (btnLanjut) btnLanjut.style.display = "none";

      // Notifikasi Gagal + Simbol WA Link Admin
      errorElement.className = "text-danger mt-2 alert alert-danger";
      errorElement.innerHTML = `
        Maaf, <strong>VERIFIKASI GAGAL</strong>: Kombinasi Nama '<b>${inputNama}</b>' dan Kode Kegiatan '<b>${kodeInput}</b>' tidak ditemukan dalam sistem!, 
        Silahkan Hubungi Admin <a href="https://wa.me/6285711000363" target="_blank" style="color: #25D366; font-weight: bold; text-decoration: underline;">
          <i class="fab fa-whatsapp"></i> wa.me/6285711000363
        </a> untuk Pendaftaran
      `;
    }
  } catch (err) {
    console.error(err);
    isVerified = false;
    verifiedPesertaData = null;
    if (btnLanjut) btnLanjut.style.display = "none";

    errorElement.className = "text-danger mt-2 alert alert-danger";
    errorElement.innerHTML = err.message;
  } finally {
    if (btnCek) btnCek.disabled = false;
  }
}

// Event Listener tombol Cek Verifikasi jika menggunakan ID terpisah
document.addEventListener("DOMContentLoaded", () => {
  const btnCek = document.getElementById("btn-cek-verifikasi");
  if (btnCek) {
    btnCek.addEventListener("click", function(e) {
      e.preventDefault();
      cekVerifikasiPeserta();
    });
  }
});

// ==========================================================
// 2. TAHAP 2: PROSES KELANJUTAN KE PETUNJUK (SUBMIT FORM)
// ==========================================================
document.getElementById("form-identitas").addEventListener("submit", async function(e) {
  e.preventDefault();
  
  const kodeInput = document.getElementById("kode-ujian-input").value.trim().toUpperCase();
  const inputToken = document.getElementById("token-input").value.trim();
  const inputNama = document.getElementById("nama").value.trim().toUpperCase();
  
  const errorElement = document.getElementById("pesan-error-login");
  const btnSubmit = document.getElementById("btn-lanjut-info");

  // Jika belum klik Cek Verifikasi atau status belum match
  if (!isVerified || !verifiedPesertaData) {
    await cekVerifikasiPeserta();
    if (!isVerified) return;
  }

  if (!inputToken) {
    errorElement.className = "text-danger mt-2 alert alert-danger";
    errorElement.innerHTML = "Silakan masukkan Token Ujian!";
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Memuat Soal Ujian...";

  const targetJsonFile = `${kodeInput}-Soal.json`;

  try {
    const pesertaMatch = verifiedPesertaData;

    // LOAD FILE SOAL
    const res = await fetch(targetJsonFile);
    if (!res.ok) {
      throw new Error(`Kode Ujian '${kodeInput}' tidak ditemukan atau belum dipublikasikan!`);
    }
    
    const data = await res.json();

    if (inputToken !== data.token) {
      throw new Error("Token Ujian salah atau tidak berlaku untuk paket ini!");
    }

    // Tetapkan Config
    questionsDataConfig = data;
    currentKodeUjian = kodeInput;
    validToken = data.token || "";
    timerDurationMinutes = data.timer_menit || 60;
    questionsData = data.questions || [];
    modeUjian = (data.mode_ujian || "LATIHAN").toUpperCase();

    // PROTEKSI SEKALI SUBMIT (KHUSUS MODE SIMULASI)
    if (modeUjian === "SIMULASI") {
      const lockKey = `SUBMITTED_${currentKodeUjian}_${inputNama}`;
      if (localStorage.getItem(lockKey) === "TRUE") {
        throw new Error("AKSES DITOLAK: Anda sudah pernah menyelesaikan ujian CAT ini!");
      }
    }

    // Simpan Identitas Peserta (Lengkap dengan data hasil verifikasi)
    const getVal = id => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : "";
    };

    userIdentitas = {
      nama: pesertaMatch["Nama Lengkap"] || inputNama,
      sekolah: getVal("sekolah") || pesertaMatch["Asal Instansi"] || "-",
      kelas: getVal("kelas") || pesertaMatch["Pekerjaan / Jurusan"] || "-",
      nisn: getVal("nisn") || pesertaMatch["NIK / NISN / NIM"] || "-",
      daerah: getVal("daerah") || `${pesertaMatch["Asal Kabupaten"] || ''}, ${pesertaMatch["Asal Provinsi"] || ''}`.replace(/^,\s*|,\s*$/g, '') || "-",
      email: pesertaMatch["Email (Terverifikasi)"] || "-",
      no_hp: pesertaMatch["No HP / WA"] || "-",
      skema_tarif: pesertaMatch["Skema Tarif"] || "-",
      bidang_kategori: pesertaMatch["Bidang / Kategori"] || "-",
      kode_ujian: currentKodeUjian,
      mode_ujian: modeUjian
    };

    // Update Sambutan & Header Lembaga (UX v1.3 Revision)
    const dispHeaderTitle = document.getElementById("disp-header-title");
    const dispHeaderSub = document.getElementById("disp-header-sub");
    if (dispHeaderTitle) dispHeaderTitle.textContent = "Selamat Datang di Sistem Tes Berbasis Komputer (CAT)";
    if (dispHeaderSub) dispHeaderSub.textContent = "Briska Corporation";

    if (data.logo) {
      const logoInfo = document.getElementById("logo-lembaga-info");
      const logoCbt = document.getElementById("logo-lembaga-cbt");
      if (logoInfo) logoInfo.src = data.logo;
      if (logoCbt) logoCbt.src = data.logo;
    }
    if (data.lembaga) {
      const dispLembagaInfo = document.getElementById("disp-lembaga-info");
      const dispLembagaCbt = document.getElementById("disp-lembaga-cbt");
      if (dispLembagaInfo) dispLembagaInfo.textContent = data.lembaga;
      if (dispLembagaCbt) dispLembagaCbt.textContent = data.lembaga;
    }
    if (data.sub_lembaga) {
      const dispSub = document.getElementById("disp-sub-lembaga");
      const dispSubInfo = document.getElementById("disp-sub-lembaga-info");
      const dispSubCbt = document.getElementById("disp-sub-lembaga-cbt");
      if (dispSub) dispSub.textContent = data.sub_lembaga;
      if (dispSubInfo) dispSubInfo.textContent = data.sub_lembaga;
      if (dispSubCbt) dispSubCbt.textContent = data.sub_lembaga;
    }

    document.getElementById("disp-kode-ujian").textContent = `${currentKodeUjian} (${modeUjian})`;
    document.getElementById("disp-durasi").textContent = timerDurationMinutes;
    document.getElementById("disp-jumlah-soal").textContent = questionsData.length;

    document.getElementById("page-login").classList.add("hidden");
    document.getElementById("page-info").classList.remove("hidden");
    window.scrollTo(0, 0);

  } catch (err) {
    console.error(err);
    errorElement.className = "text-danger mt-2 alert alert-danger";
    errorElement.textContent = err.message;
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Lanjut ke Petunjuk >>";
  }
});

// ==========================================================
// 3. PAGE 2: CONTROLLER KETENTUAN & TOMBOL MULAI
// ==========================================================
function toggleMulaiButton() {
  const isChecked = document.getElementById("check-setuju").checked;
  const btnMulai = document.getElementById("btn-mulai-ujian");
  
  if (isChecked) {
    btnMulai.disabled = false;
    btnMulai.classList.remove("btn-start-disabled");
  } else {
    btnMulai.disabled = true;
    btnMulai.classList.add("btn-start-disabled");
  }
}

function kembaliKePage1() {
  document.getElementById("page-info").classList.add("hidden");
  document.getElementById("page-login").classList.remove("hidden");
  window.scrollTo(0, 0);
}

function mulaiUjianPenuh() {
  document.getElementById("page-info").classList.add("hidden");
  document.getElementById("page-cbt").classList.remove("hidden");

  document.getElementById("disp-nama").textContent = userIdentitas.nama;
  document.getElementById("disp-nisn").textContent = `${userIdentitas.nisn} (${userIdentitas.kelas})`;

  initCBT();
}

// ==========================================================
// 4. PAGE 3: INISIALISASI CAT, ANTI-CHEAT & TIMER
// ==========================================================
function initCBT() {
  isExamStarted = true;
  renderNumberGrid();
  loadQuestion(currentIndex);
  startTimer(timerDurationMinutes * 60);

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleWindowBlur);
}

function startTimer(totalSeconds) {
  let timerSeconds = totalSeconds;
  const timerDisplay = document.getElementById("timer");

  timerInterval = setInterval(() => {
    const hours = Math.floor(timerSeconds / 3600);
    const minutes = Math.floor((timerSeconds % 3600) / 60);
    const seconds = timerSeconds % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    if (timerDisplay) {
      timerDisplay.textContent = `${hh}:${mm}:${ss}`;
    }

    if (--timerSeconds < 0) {
      clearInterval(timerInterval);
      playVoiceWarning("Waktu ujian telah habis. Jawaban Anda otomatis dikirim.");
      alert("⏱️ Waktu Ujian Telah Habis!\nJawaban Anda secara otomatis disimpan dan dikirim ke sistem.");
      submitJawaban();
    }
  }, 1000);
}

function playVoiceWarning(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

function handleVisibilityChange() {
  if (isExamStarted && !isExamSubmitted && document.hidden) {
    prosesPeringatanKecurangan();
  }
}

function handleWindowBlur() {
  if (isExamStarted && !isExamSubmitted) {
    prosesPeringatanKecurangan();
  }
}

function prosesPeringatanKecurangan() {
  warningCount++;
  
  if (warningCount >= MAX_WARNINGS) {
    const pesanTerakhir = "Batas toleransi habis! Ujian Anda otomatis diakhiri.";
    playVoiceWarning(pesanTerakhir);
    
    alert(`⚠️ PERINGATAN KE-${warningCount} (BATAS MAKSIMAL)!\nAnda kedapatan meninggalkan halaman ujian. Ujian Anda otomatis diakhiri dan jawaban langsung dikirim.`);
    submitJawaban();
  } else {
    const pesanTeguran = `Peringatan ke ${warningCount}. Dilarang membuka tab atau aplikasi lain saat ujian!`;
    playVoiceWarning(pesanTeguran);

    alert(`⚠️ PERINGATAN KECURANGAN (${warningCount}/${MAX_WARNINGS})!\nDilarang membuka tab, jendela, atau aplikasi lain selama ujian berlangsung! Jika mencapai ${MAX_WARNINGS} kali, ujian akan terhenti otomatis.`);
  }
}

// ==========================================================
// 5. RENDER SOAL & NAVIGASI 
// ==========================================================
function loadQuestion(index) {
  const q = questionsData[index];
  if (!q) return;

  const displayNo = index + 1; 

  document.getElementById("q-num").textContent = displayNo;
  document.getElementById("q-text").innerHTML = q.Soal;

  const imgContainer = document.getElementById("q-image-container");
  const gambarVal = (q.Gambar && typeof q.Gambar === "string") ? q.Gambar.trim() : "";
  
  if (gambarVal !== "" && gambarVal !== "-" && gambarVal.toLowerCase() !== "none" && gambarVal.toLowerCase() !== "null") {
    imgContainer.innerHTML = `<img src="${gambarVal}" class="img-soal" alt="Gambar Soal">`;
  } else {
    imgContainer.innerHTML = "";
  }

  const optionsBox = document.getElementById("options-box");
  optionsBox.innerHTML = "";

  const optionsKeys = ["A", "B", "C", "D", "E"];
  optionsKeys.forEach(key => {
    if (q[key] && String(q[key]).trim() !== "") {
      const isSelected = userAnswers[displayNo] === key;
      
      const optionRow = document.createElement("div"); 
      optionRow.className = `option-row ${isSelected ? 'selected' : ''}`;
      
      optionRow.innerHTML = `
        <input type="radio" name="option_${displayNo}" value="${key}" ${isSelected ? 'checked' : ''} style="pointer-events: none;">
        <span class="opt-key">${key}.</span>
        <span class="opt-val">${q[key]}</span>
      `;

      optionRow.onclick = function() {
        pilihJawaban(displayNo, key);
      };

      optionsBox.appendChild(optionRow);
    }
  });

  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([
      document.getElementById("q-text"),
      document.getElementById("options-box")
    ]).catch(err => console.error("MathJax error:", err));
  }

  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  if (btnPrev) btnPrev.disabled = (index === 0);
  if (btnNext) btnNext.disabled = (index === questionsData.length - 1);

  updateGridStatus();
}

function pilihJawaban(displayNo, key) {
  userAnswers[displayNo] = key;
  loadQuestion(currentIndex);
}

function navigasi(direction) {
  const newIndex = currentIndex + direction;
  if (newIndex >= 0 && newIndex < questionsData.length) {
    currentIndex = newIndex;
    loadQuestion(currentIndex);
  }
}

function renderNumberGrid() {
  const grid = document.getElementById("number-grid");
  if (!grid) return;
  grid.innerHTML = "";

  questionsData.forEach((q, idx) => {
    const circle = document.createElement("div");
    circle.id = `circle-num-${idx}`;
    circle.className = "circle-btn unanswered";
    circle.textContent = idx + 1;

    circle.onclick = () => {
      currentIndex = idx;
      loadQuestion(currentIndex);
    };

    grid.appendChild(circle);
  });
}

function updateGridStatus() {
  questionsData.forEach((q, idx) => {
    const circle = document.getElementById(`circle-num-${idx}`);
    if (!circle) return;

    const displayNo = idx + 1;
    circle.className = "circle-btn";

    if (userAnswers[displayNo]) {
      circle.classList.add("answered");
    } else {
      circle.classList.add("unanswered");
    }

    if (idx === currentIndex) {
      circle.classList.add("active");
    }
  });
}

function konfirmasiSubmit() {
  const total = questionsData.length;
  const dijawab = Object.keys(userAnswers).length;

  if (confirm(`Anda telah menjawab ${dijawab} dari ${total} soal.\nYakin ingin mengakhiri ujian CAT?`)) {
    submitJawaban();
  }
}

function konfirmasiKeluar() {
  if (confirm("Apakah Anda yakin ingin keluar dari halaman ujian CAT? Seluruh progres ujian Anda akan terhenti.")) {
    location.reload();
  }
}

// ==========================================================
// 6. SUBMIT JAWABAN & ENGINE KOREKSI CAT (BOBOT OPSI & KATEGORI)
// ==========================================================
function submitJawaban() {
  if (isExamSubmitted) return;
  isExamSubmitted = true;

  clearInterval(timerInterval);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("blur", handleWindowBlur);

  // Kunci browser jika mode SIMULASI
  if (modeUjian === "SIMULASI") {
    const lockKey = `SUBMITTED_${currentKodeUjian}_${userIdentitas.nama}`;
    localStorage.setItem(lockKey, "TRUE");
  }

  let totalSkor = 0;
  let jumlahBenar = 0;
  let jumlahSalah = 0;
  let jumlahKosong = 0;
  let catBreakdown = {};

  // CORE ENGINE KOREKSI CAT
  questionsData.forEach((q, idx) => {
    const displayNo = idx + 1;
    const ans = userAnswers[displayNo];
    const kunci = q.Kunci ? String(q.Kunci).trim().toUpperCase() : "";
    const catCategory = q.CAT ? String(q.CAT).trim().toUpperCase() : "GENERAL";

    if (!catBreakdown[catCategory]) {
      catBreakdown[catCategory] = 0;
    }

    const hasBobot = q.Bobot && typeof q.Bobot === "object" && Object.keys(q.Bobot).length > 0;

    if (hasBobot) {
      if (!ans) {
        jumlahKosong++;
      } else if (q.Bobot[ans] !== undefined) {
        const poinDapat = Number(q.Bobot[ans]);
        totalSkor += poinDapat;
        catBreakdown[catCategory] += poinDapat;

        const maxBobot = Math.max(...Object.values(q.Bobot));
        if (poinDapat === maxBobot) jumlahBenar++;
        else jumlahSalah++;
      }
    } else {
      if (!ans) {
        jumlahKosong++;
      } else if (ans === kunci) {
        jumlahBenar++;
        totalSkor += 5;
        catBreakdown[catCategory] += 5;
      } else {
        jumlahSalah++;
      }
    }
  });

  const totalSoal = questionsData.length;
  const skorAkhir = Number(totalSkor.toFixed(2));

  const detailHasil = {
    benar: jumlahBenar,
    salah: jumlahSalah,
    kosong: jumlahKosong,
    totalSoal: totalSoal,
    skor: skorAkhir,
    catBreakdown: catBreakdown
  };

  document.getElementById("page-cbt").innerHTML = `
    <div style="text-align:center; padding: 60px 20px; font-family: sans-serif;">
      <h2 style="color: #4a3e56; margin-bottom: 10px;">Mengirimkan Jawaban...</h2>
      <p style="color: #7d756d;">Mohon tunggu sebentar, jawaban Anda sedang disimpan dan diproses oleh sistem CAT.</p>
    </div>
  `;

  const payload = {
    kode_soal: currentKodeUjian,
    sistem_ujian: "CAT",
    mode_ujian: modeUjian,
    mode_penilaian: "INTEGRATED_CAT",
    identitas: userIdentitas,
    jawaban: userAnswers,
    total_dijawab: Object.keys(userAnswers).length,
    total_soal: totalSoal,
    skor_total: skorAkhir,
    skor: skorAkhir,
    benar: jumlahBenar,
    salah: jumlahSalah,
    kosong: jumlahKosong,
    cat_twk: catBreakdown["TWK"] !== undefined ? catBreakdown["TWK"] : "-",
    cat_tiu: catBreakdown["TIU"] !== undefined ? catBreakdown["TIU"] : "-",
    cat_tkp: catBreakdown["TKP"] !== undefined ? catBreakdown["TKP"] : "-",
    jumlah_benar: jumlahBenar,
    jumlah_salah: jumlahSalah,
    jumlah_kosong: jumlahKosong,
    skor_akhir: skorAkhir,
    breakdown_cat: catBreakdown
  };

  if (WEBHOOK_URL && WEBHOOK_URL.trim() !== "") {
    fetch(WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
    .then(() => tampilkanLayarSelesai(detailHasil))
    .catch(err => {
      console.error("Error Webhook:", err);
      tampilkanLayarSelesai(detailHasil);
    });
  } else {
    tampilkanLayarSelesai(detailHasil);
  }
}

// ==========================================================
// 7. PANEL PENGUMUMAN SKOR AKHIR (KHUSUS CAT)
// ==========================================================
function tampilkanLayarSelesai(detail) {
  let catRowsHTML = "";
  for (const [kategori, skorKat] of Object.entries(detail.catBreakdown)) {
    catRowsHTML += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 8px;">
        <span style="font-weight: bold; color: #333; font-size: 15px;">Skor ${kategori}</span>
        <span style="font-size: 18px; font-weight: bold; color: #1976d2;">${skorKat}</span>
      </div>
    `;
  }

  const htmlContent = `
    <div style="text-align:center; padding: 30px 15px; font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #2e7d32; margin-bottom: 5px;">✅ Ujian CAT Selesai!</h2>
      <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Hasil Pengumuman Skor Resmi [Kode: <strong>${currentKodeUjian}</strong>]</p>
      
      <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; text-align: left; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
        <h3 style="color: #4a3e56; margin-top: 0; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; font-size: 16px;">📊 Akumulasi Skor Per Kategori</h3>
        
        <div style="margin-bottom: 20px;">
          ${catRowsHTML}
        </div>

        <div style="background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 10px; padding: 15px; text-align: center; margin-bottom: 20px;">
          <span style="font-size: 12px; color: #2e7d32; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Total Skor Akumulasi</span>
          <div style="font-size: 42px; font-weight: bold; color: #1b5e20; margin-top: 2px;">${detail.skor}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 13px; text-align: center; background: #fafafa; padding: 10px; border-radius: 8px;">
          <div>✔️ Benar: <strong style="color: #2e7d32;">${detail.benar}</strong></div>
          <div>❌ Salah: <strong style="color: #c62828;">${detail.salah}</strong></div>
          <div>⚪ Kosong: <strong style="color: #f57c00;">${detail.kosong}</strong></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("page-cbt").innerHTML = htmlContent;
}

function toggleNavigator() {
  const sidebar = document.querySelector(".sidebar-nav");
  if (sidebar) {
    sidebar.classList.toggle("hidden");
  }
}
