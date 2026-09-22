/* ==========================================================================
   PATS PORTAL - PDF EXPORTER (BACK TO BASICS - HIGH STABILITY)
   Solusi Final: html2pdf.js dengan Desktop Viewport Forcing
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
      
      if (!element) throw new Error("Elemen report tidak ditemukan.");

      // 1. BEKUKAN CANVAS (CHART.JS) MENJADI GAMBAR AGAR TIDAK BLANK
      const originalCanvases = [];
      const canvases = element.querySelectorAll("canvas");
      canvases.forEach(canvas => {
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png', 1.0);
        img.style.width = canvas.style.width || canvas.width + 'px';
        img.style.height = canvas.style.height || canvas.height + 'px';
        img.style.maxWidth = '100%';
        img.className = 'temp-canvas-img';
        
        // Simpan referensi untuk dikembalikan nanti
        originalCanvases.push({ parent: canvas.parentNode, canvas: canvas, img: img });
        canvas.parentNode.replaceChild(img, canvas);
      });

      // (Bagian pembekuan canvas tetap sama seperti kode Anda sebelumnya)

      // 2. Kunci ukuran agar pas dengan A4 (800px adalah rasio ideal A4 potrait)
      const originalMaxWidth = element.style.maxWidth;
      const originalMargin = element.style.margin;
      
      element.style.maxWidth = '800px';
      element.style.margin = '0 auto';

      // 3. KONFIGURASI HTML2PDF (Fokus pada Anti-Terbelah)
      const opt = {
        margin:       [10, 10, 10, 10], // Margin aman (mm)
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, // Resolusi tinggi
          useCORS: true,
          logging: false,
          scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { 
          mode: ['css', 'legacy'], // Menggunakan aturan CSS break-inside: avoid yang kita buat
          avoid: ['tr', '.report-section', '.chart-box', '.sign-box', '.report-section-title', 'h2', 'h3'] 
        }
      };

      // 4. EKSEKUSI RENDER
      const pdfBase64Uri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
      
      // 5. Kembalikan DOM
      element.style.maxWidth = originalMaxWidth;
      element.style.margin = originalMargin;

      // (Lanjutkan ke proses Fetch Google Drive seperti biasa)
      
      originalCanvases.forEach(item => {
        item.parent.replaceChild(item.canvas, item.img);
      });

      // 6. UPLOAD KE GOOGLE DRIVE
      console.log("[DRIVE ARCHIVE]: Mengirim ke server...");
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
  }, 3500); // Tunggu chart.js render sempurna
});
