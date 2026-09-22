/* ==========================================================================
   PATS PORTAL - PDF EXPORTER & AUTO DRIVE ARCHIVER UTILITY (FIXED A4 RENDER)
   ========================================================================== */

const GAS_PDF_DRIVE_URL = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const PATS_PDF = {
  generateStandardFileName(user = {}) {
    const rawKode = user.kode_modul || user.kode_akses || user.kode_kegiatan || "TES";
    const rawNama = user.nama_lengkap || user.nama || "Siswa";
    const rawInstansi = user.asal_instansi || user.sekolah || "Instansi";

    const cleanStr = (str) => str.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").trim();

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

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

    // Konfigurasi Presisi A4 Tanpa 'avoid-all' untuk Mencegah Halaman Kosong
    const options = {
      margin:       [8, 8, 8, 8],
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        windowWidth: 800, // Mengunci lebar render canvas persis skala A4
        scrollX: 0,
        scrollY: 0
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] } // LEPAS 'avoid-all'
    };

    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(options).from(element).save().then(() => {
        if (triggerBtn) {
          triggerBtn.innerText = originalText;
          triggerBtn.disabled = false;
        }
      }).catch((err) => {
        console.error("Gagal export PDF:", err);
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
    const element = document.getElementById(elementId);
    if (!element || typeof html2pdf === 'undefined') return;

    try {
      console.log("[DRIVE ARCHIVE]: Memulai konversi PDF presisi...");

      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
      const fileName = this.generateStandardFileName(user);

      const options = {
        margin:       [8, 8, 8, 8],
        image:        { type: 'jpeg', quality: 0.85 },
        html2canvas:  { 
          scale: 1.5, 
          useCORS: true, 
          logging: false,
          windowWidth: 800, // Mengunci lebar render canvas persis skala A4
          scrollX: 0,
          scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'] }
      };

      const pdfBase64Uri = await html2pdf().set(options).from(element).outputPdf('datauristring');
      const cleanBase64 = pdfBase64Uri.split(',')[1];

      await fetch(GAS_PDF_DRIVE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "save_pdf_to_drive",
          kode_akses: user.kode_akses || user.kode_kegiatan || "TES",
          nama_lengkap: user.nama_lengkap || user.nama || "Siswa",
          filename: fileName,
          pdf_base64: cleanBase64
        })
      });

      sessionStorage.setItem("pats_pdf_drive_archived", "true");
      console.log(`[DRIVE ARCHIVE SUCCESS]: File ${fileName} tersimpan rapi di Google Drive.`);

    } catch (err) {
      console.error("[DRIVE ARCHIVE ERROR]:", err);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    PATS_PDF.autoArchiveToDrive("report-paper");
  }, 3000);
});
