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
    // Reset scroll posisi pengguna sejenak saat capturing
    const currentX = window.scrollX;
    const currentY = window.scrollY;

    return {
      margin:       [8, 8, 8, 8],
      image:        { type: 'jpeg', quality: isLowRes ? 0.85 : 0.98 },
      html2canvas:  { 
        scale: isLowRes ? 1.5 : 2, 
        useCORS: true, 
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1024,
        onclone: (clonedDoc) => {
          // 1. Konversi elemen Chart/Canvas ke Gambar PNG di dokumen memori PDF
          const origEl = document.getElementById(elementId);
          const clonedEl = clonedDoc.getElementById(elementId);

          if (origEl && clonedEl) {
            const origCanvases = origEl.querySelectorAll('canvas');
            const clonedCanvases = clonedEl.querySelectorAll('canvas');

            origCanvases.forEach((origCanvas, idx) => {
              if (clonedCanvases[idx]) {
                const img = clonedDoc.createElement('img');
                img.src = origCanvas.toDataURL('image/png');
                img.style.cssText = origCanvas.style.cssText;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                clonedCanvases[idx].parentNode.replaceChild(img, clonedCanvases[idx]);
              }
            });

            // 2. PAKSA tata letak KHUSUS PDF di memori kloning (Web Asli Tidak Terpengaruh)
            clonedDoc.body.style.margin = "0";
            clonedDoc.body.style.padding = "0";
            clonedDoc.body.style.width = "794px";

            // Bersihkan margin auto induk di kloningan
            let parent = clonedEl.parentElement;
            while (parent && parent !== clonedDoc.body) {
              parent.style.margin = "0";
              parent.style.padding = "0";
              parent.style.display = "block";
              parent = parent.parentElement;
            }

            clonedEl.style.margin = "0";
            clonedEl.style.padding = "20px";
            clonedEl.style.width = "754px"; // Presisi lebar A4 dikurangi padding
            clonedEl.style.maxWidth = "none";
            clonedEl.style.transform = "none";
            clonedEl.style.boxSizing = "border-box";
          }
        }
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'], avoid: ['.report-section', '.sign-box', 'tr'] }
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
  }, 3500);
});
