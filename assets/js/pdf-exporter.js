/* ==========================================================================
   PATS PORTAL - PDF EXPORTER & AUTO DRIVE ARCHIVER UTILITY
   ========================================================================== */

if (typeof REKAP_GAS_ENDPOINT === "undefined") {
  var REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";
}

const PATS_PDF = {
  generateStandardFileName(user = {}) {
    const rawKode = user.kode_modul || user.kode_akses || user.kode_kegiatan || "TES";
    const rawNama = user.nama_lengkap || user.nama || "Siswa";
    const rawInstansi = user.asal_instansi || user.sekolah || "Instansi";

    const cleanStr = (str) => str.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").trim();

    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${YYYY}${MM}${DD}_${hh}${mm}`;

    return `${cleanStr(rawKode)}_${cleanStr(rawNama)}_${cleanStr(rawInstansi)}_${timestamp}.pdf`;
  },

  printReport() {
    window.print();
  },

  exportToPDF(elementId = "report-paper") {
    const element = document.getElementById(elementId);
    if (!element) return;

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
      }).catch(() => {
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

  async autoArchiveToDrive(elementId = "report-paper") {
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
        image:        { type: 'jpeg', quality: 0.85 },
        html2canvas:  { scale: 1.5, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      const pdfBase64 = await html2pdf().set(options).from(element).outputPdf('datauristring');
      const cleanBase64 = pdfBase64.split(',')[1];

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

      sessionStorage.setItem("pats_pdf_drive_archived", "true");
      console.log(`[DRIVE ARCHIVE SUCCESS]: File ${fileName} berhasil tersimpan di Google Drive.`);

    } catch (err) {
      console.warn("[DRIVE ARCHIVE ERROR]:", err);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    PATS_PDF.autoArchiveToDrive("report-paper");
  }, 2500);
});
