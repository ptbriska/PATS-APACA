/* ==========================================================================
   PATS PORTAL - PDF EXPORTER (FINAL STABLE - EXTREME TABLE COMPRESSION)
   ========================================================================== */

const GAS_PDF_DRIVE_URL = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const PATS_PDF = {
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  async ensureDependencies() {
    await this._loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js");
  },

  generateStandardFileName(user = {}) {
    const rawKode = user.kode_modul || user.kode_akses || user.kode_kegiatan || "TES";
    const rawNama = user.nama_lengkap || user.nama || "Siswa";
    const rawInstansi = user.asal_instansi || user.sekolah || "Instansi";
    const cleanStr = (str) => str.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").trim();
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    return `${cleanStr(rawKode)}_${cleanStr(rawNama)}_${cleanStr(rawInstansi)}_${timestamp}.pdf`;
  },

  exportToPDF() {
    window.print(); 
  },

  async autoArchiveToDrive(elementId = "report-paper") {
    try {
      await this.ensureDependencies();
      console.log("[DRIVE ARCHIVE]: Memulai pembuatan PDF...");

      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
      const fileName = this.generateStandardFileName(user);
      const element = document.getElementById(elementId);

      if (!element) return;

      window.scrollTo(0, 0);

      // 1. Ubah Chart jadi Gambar
      const originalCanvases = Array.from(element.querySelectorAll("canvas"));
      const canvasReplacements = originalCanvases.map(canvas => {
        const img = document.createElement("img");
        img.src = canvas.toDataURL("image/png", 1.0);
        img.style.width = canvas.style.width || (canvas.offsetWidth + "px");
        img.style.height = canvas.style.height || (canvas.offsetHeight + "px");
        img.style.maxWidth = "100%";
        img.style.display = "block";
        canvas.parentNode.replaceChild(img, canvas);
        return { canvas, img };
      });

      // 2. Setting html2pdf dengan kompresi ekstrem pada tabel
      const opt = {
        margin:       [10, 10, 10, 10], 
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          logging: false,
          scrollY: 0,
          onclone: (clonedDoc) => {
            const target = clonedDoc.getElementById(elementId);
            if (target) {
              // Kunci kontainer utama
              target.style.setProperty('width', '794px', 'important');
              target.style.setProperty('max-width', '794px', 'important');
              target.style.setProperty('margin', '0', 'important');
              target.style.setProperty('padding', '20px', 'important');
              target.style.setProperty('box-sizing', 'border-box', 'important');

              const tables = target.querySelectorAll('table');
              tables.forEach(t => {
                t.style.setProperty('width', '100%', 'important');
                t.style.setProperty('max-width', '100%', 'important');
                t.style.setProperty('table-layout', 'fixed', 'important');
                t.style.setProperty('box-sizing', 'border-box', 'important');
                
                let parent = t.parentElement;
                if (parent) {
                  parent.style.setProperty('width', '100%', 'important');
                  parent.style.setProperty('max-width', '100%', 'important');
                  parent.style.setProperty('overflow', 'hidden', 'important');
                  parent.style.setProperty('box-sizing', 'border-box', 'important');
                }
              });

              // JURUS PAMUNGKAS: Paksa kecilkan teks dan padding agar pasti muat
              const cells = target.querySelectorAll('th, td');
              cells.forEach(c => {
                c.style.removeProperty('width'); 
                c.style.removeProperty('min-width');
                c.removeAttribute('width');
                
                c.style.setProperty('padding', '4px 2px', 'important'); // Padatkan ruang kosong
                c.style.setProperty('font-size', '9px', 'important'); // Teks dikecilkan
                c.style.setProperty('word-wrap', 'break-word', 'important');
                c.style.setProperty('overflow-wrap', 'anywhere', 'important'); // Paksa potong teks yang tidak bisa dibreak
                c.style.setProperty('word-break', 'break-word', 'important');
                c.style.setProperty('white-space', 'normal', 'important');
                c.style.setProperty('box-sizing', 'border-box', 'important');
              });
            }
          }
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { 
          mode: ['css', 'legacy'], 
          avoid: ['tr', '.report-section', '.chart-box', '.sign-box', '.report-section-title'] 
        }
      };

      // 3. Render ke PDF
      const pdfBase64Uri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
      const cleanBase64 = pdfBase64Uri.split(',')[1];

      // 4. Kembalikan Grafik Canvas
      canvasReplacements.forEach(({ canvas, img }) => {
        img.parentNode.replaceChild(canvas, img);
      });

      // 5. Kirim data ke Drive
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
      console.log(`[DRIVE ARCHIVE SUCCESS]: File PDF tersimpan utuh.`);

    } catch (error) {
      console.error("[DRIVE ARCHIVE ERROR]:", error);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    PATS_PDF.autoArchiveToDrive("report-paper");
  }, 3000);
});
