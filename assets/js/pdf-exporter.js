/* ==========================================================================
   PATS PORTAL - PDF EXPORTER & AUTO DRIVE ARCHIVER UTILITY
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

  getCanvasOptions(elementId, isLowRes = false) {
    return {
      margin:       [8, 8, 8, 8],
      image:        { type: 'jpeg', quality: isLowRes ? 0.85 : 0.98 },
      html2canvas:  { 
        scale: isLowRes ? 1.5 : 2, 
        useCORS: true, 
        logging: false,
        windowWidth: 800, // Menyamakan ukuran viewport browser virtual
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById(elementId);
          
          // Reset total gaya pembungkus & body ke rata kiri penuh (0,0)
          clonedDoc.body.style.margin = "0";
          clonedDoc.body.style.padding = "0";
          clonedDoc.body.style.width = "800px";
          clonedDoc.body.style.display = "block";
          clonedDoc.body.style.textAlign = "left";

          if (clonedEl) {
            if (clonedEl.parentElement) {
              clonedEl.parentElement.style.margin = "0";
              clonedEl.parentElement.style.padding = "0";
              clonedEl.parentElement.style.display = "block";
              clonedEl.parentElement.style.textAlign = "left";
            }
            clonedEl.style.margin = "0";
            clonedEl.style.padding = "16px";
            clonedEl.style.width = "760px";
            clonedEl.style.position = "static";
            clonedEl.style.transform = "none";
            clonedEl.style.float = "none";
          }
        }
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };
  },

  exportToPDF(elementId = "report-paper") {
    const element = document.getElementById(elementId);
    if (!element) return;

    const triggerBtn = typeof event !== "undefined" && event && event.target ? event.target : null;
    let originalText = "";
    if (triggerBtn) {
      originalText = triggerBtn.innerText;
      triggerBtn.innerText = "Memproses PDF...";
      triggerBtn.disabled = true;
    }

    const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
    const fileName = this.generateStandardFileName(user);

    const options = {
      ...this.getCanvasOptions(elementId, false),
      filename: fileName
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
      console.log("[DRIVE ARCHIVE]: Memproses konversi PDF...");

      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
      const fileName = this.generateStandardFileName(user);
      const options = this.getCanvasOptions(elementId, true);

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
      console.log(`[DRIVE ARCHIVE SUCCESS]: File ${fileName} tersimpan utuh di Drive.`);

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
