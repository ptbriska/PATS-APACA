/* ==========================================================================
   PATS PORTAL - PDF EXPORTER (THE CLONE METHOD)
   Solusi 100% Bebas Distorsi Web & Bebas Potongan Samping
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
      const originalElement = document.getElementById(elementId);
      
      if (!originalElement) throw new Error("Elemen report tidak ditemukan.");

      // 1. BUAT KOTAK KLONING RAHASIA DI POJOK KIRI ATAS (KOORDINAT 0,0)
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '800px'; // Lebar absolut setara kertas A4 Potrait
      container.style.zIndex = '-9999';
      container.style.backgroundColor = '#ffffff';

      // 2. KLONING ELEMEN ASLI KE DALAM KOTAK RAHASIA
      const clone = originalElement.cloneNode(true);
      
      // Hapus margin auto agar menempel ke sisi kiri kotak rahasia
      clone.style.margin = '0';
      clone.style.maxWidth = '100%';
      clone.style.width = '100%';
      clone.style.boxShadow = 'none';

      // 3. BEKUKAN CANVAS MENJADI GAMBAR PADA ELEMEN KLONING (Agar Chart Muncul)
      const origCanvases = originalElement.querySelectorAll('canvas');
      const cloneCanvases = clone.querySelectorAll('canvas');
      
      origCanvases.forEach((canvas, i) => {
        if(cloneCanvases[i]) {
          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/png', 1.0);
          img.style.cssText = cloneCanvases[i].style.cssText;
          img.style.width = canvas.offsetWidth + 'px';
          img.style.height = canvas.offsetHeight + 'px';
          cloneCanvases[i].replaceWith(img);
        }
      });

      // Masukkan kloning ke body
      container.appendChild(clone);
      document.body.appendChild(container);

      // 4. KONFIGURASI HTML2PDF (Fokus membidik kotak rahasia)
      const opt = {
        margin:       [10, 10, 10, 10],
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          logging: false,
          x: 0,           // Kunci ke sumbu X = 0
          y: 0,           // Kunci ke sumbu Y = 0
          scrollX: 0,
          scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { 
          mode: ['css', 'legacy'], 
          avoid: ['tr', '.report-section', '.chart-box', '.sign-box', '.report-section-title', 'h2', 'h3'] 
        }
      };

      // 5. RENDER DARI ELEMEN KLONING
      const pdfBase64Uri = await html2pdf().set(opt).from(container).outputPdf('datauristring');
      const cleanBase64 = pdfBase64Uri.split(',')[1];

      // 6. HAPUS KOTAK RAHASIA (Selesai, web utama sama sekali tidak tersentuh dari awal)
      document.body.removeChild(container);

      // 7. UPLOAD KE GOOGLE DRIVE
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
      // Bersihkan jika gagal di tengah jalan
      const leftover = document.querySelector('div[style*="width: 800px"][style*="z-index: -9999"]');
      if (leftover) leftover.remove();
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    PATS_PDF.autoArchiveToDrive("report-paper");
  }, 3500); 
});
