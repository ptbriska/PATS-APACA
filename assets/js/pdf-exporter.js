/* ==========================================================================
   PATS PORTAL - PDF EXPORTER & AUTO DRIVE ARCHIVER UTILITY
   (assets/js/pdf-exporter.js)
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const PATS_PDF = {
  /**
   * Helper untuk membentuk format penamaan berkas standar:
   * (Kode Tes)_(Nama Lengkap)_(Asal Instansi)_(Timestamp)
   */
  generateStandardFileName(user = {}) {
    const rawKode = user.kode_modul || user.kode_akses || user.kode_kegiatan || "TES";
    const rawNama = user.nama_lengkap || user.nama || "Siswa";
    const rawInstansi = user.asal_instansi || user.sekolah || "Instansi";

    // Bersihkan karakter khusus/spasi agar aman sebagai nama berkas
    const cleanStr = (str) => str.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").trim();

    // Format Timestamp: YYYYMMDD_HHmm
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${YYYY}${MM}${DD}_${hh}${mm}`;

    return `${cleanStr(rawKode)}_${cleanStr(rawNama)}_${cleanStr(rawInstansi)}_${timestamp}.pdf`;
  },

  /**
   * Memicu dialog cetak bawaan browser
   */
  printReport() {
    window.print();
  },

  /**
   * Unduh PDF Manual via Tombol UI
   */
  exportToPDF(elementId = "report-paper") {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error("Elemen laporan tidak ditemukan:", elementId);
      alert("Gagal memproses cetak: Elemen dokumen laporan tidak ditemukan.");
      return;
    }

    const triggerBtn = event && event.target ? event.target : null;
    let originalText = "";
    if (triggerBtn) {
      originalText = triggerBtn.innerText;
      triggerBtn.innerText = "Memproses PDF...";
      triggerBtn.disabled = true;
    }

    const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
    const fileName = this.generateStandardFileName(user);

    const options = {
      margin:       [10, 10, 10, 10],
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(options).from(element).save().then(() => {
        if (triggerBtn) {
          triggerBtn.innerText = originalText;
          triggerBtn.disabled = false;
        }
      }).catch(err => {
        console.error("Gagal mengeksport PDF via html2pdf:", err);
        if (triggerBtn) {
          triggerBtn.innerText = originalText;
          triggerBtn.disabled = false;
        }
        this.printReport();
      });
    } else {
      if (triggerBtn) {
        triggerBtn.innerText = originalText;
        triggerBtn.disabled = false;
      }
      this.printReport();
    }
  },

  /**
   * PROSES SILUMAN: Auto Generate & Upload PDF ke Drive
   */
  async autoArchiveToDrive(elementId = "report-paper") {
    // 1. Cek flag agar tidak diunggah berulang dalam 1 sesi
    if (sessionStorage.getItem("pats_pdf_drive_archived") === "true") {
      console.log("[DRIVE ARCHIVE]: PDF laporan tes ini sudah diarsip ke Google Drive sebelumnya.");
      return;
    }

    const element = document.getElementById(elementId);
    if (!element || typeof html2pdf === 'undefined') return;

    try {
      console.log("[DRIVE ARCHIVE]: Memulai pembuatan arsip PDF otomatis...");

      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
      const fileName = this.generateStandardFileName(user);

      const options = {
        margin:       [10, 10, 10, 10],
        image:        { type: 'jpeg', quality: 0.85 }, // Kompresi ringan agar upload cepat
        html2canvas:  { scale: 1.5, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // Generate PDF Base64 string
      const pdfBase64 = await html2pdf().set(options).from(element).outputPdf('datauristring');
      const cleanBase64 = pdfBase64.split(',')[1];

      // Kirim payload ke Apps Script
      await fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_pdf_to_drive",
          kode_akses: user.kode_akses || user.kode_kegiatan || "TES",
          nama_lengkap: user.nama_lengkap || user.nama || "Siswa",
          filename: fileName,
          pdf_base64: cleanBase64
        })
      });

      // Tandai pengarsipan sukses
      sessionStorage.setItem("pats_pdf_drive_archived", "true");
      console.log(`[DRIVE ARCHIVE SUCCESS]: File ${fileName} berhasil tersimpan di Google Drive.`);

    } catch (err) {
      console.warn("[DRIVE ARCHIVE ERROR]:", err);
    }
  }
};

// AUTO-TRIGGER SILUMAN:
// Berjalan otomatis 2.5 detik setelah halaman result dimuat sempurna
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    PATS_PDF.autoArchiveToDrive("report-paper");
  }, 2500);
});
