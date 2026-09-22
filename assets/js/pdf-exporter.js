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

      // 2. PAKSA UKURAN DESKTOP SESAAT AGAR TABEL TIDAK MENYEMPIT (Mirip Ctrl+P)
      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      const originalMargin = element.style.margin;
      
      element.style.width = '1024px';
      element.style.maxWidth = '1024px';
      element.style.margin = '0'; // Hindari offset ke kanan

      // 3. KONFIGURASI HTML2PDF
      const opt = {
        margin:       [10, 10, 10, 10], // Margin atas, kiri, bawah, kanan (mm)
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          logging: false,
          windowWidth: 1024, // Paksa html2canvas membaca halaman sebagai desktop
          scrollY: 0,
          scrollX: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { 
          mode: ['css', 'legacy'], 
          avoid: ['tr', '.report-section', '.chart-box', '.sign-box', '.report-section-title'] 
        }
      };

      // 4. EKSEKUSI RENDER & AMBIL BASE64
      const pdfBase64Uri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
      const cleanBase64 = pdfBase64Uri.split(',')[1];

      // 5. KEMBALIKAN DOM SEPERTI SEMULA (Sangat Cepat, Layar Tidak Berkedip)
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.margin = originalMargin;
      
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
