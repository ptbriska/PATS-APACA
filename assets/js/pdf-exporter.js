/* ==========================================================================
   PATS PORTAL - PDF EXPORTER (WIDTH-LOCK & AUTO-WRAP METHOD)
   Memperbaiki Tabel Terpotong di Kanan & Baris Terbelah
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

      // 1. KUNCI SCROLL KE ATAS (Mencegah Blank Putih)
      window.scrollTo(0, 0);

      // 2. SIMPAN STYLE ASLI UNTUK DIKEMBALIKAN NANTI
      const originalElementStyle = element.style.cssText;
      const tables = element.querySelectorAll('table');
      const tableStyles = [];

      // 3. UBAH CANVAS JADI GAMBAR & PAKSA UKURAN A4
      const originalCanvases = Array.from(element.querySelectorAll("canvas"));
      const canvasReplacements = originalCanvases.map(canvas => {
        const img = document.createElement("img");
        img.src = canvas.toDataURL("image/png", 1.0);
        img.style.cssText = canvas.style.cssText;
        img.style.width = canvas.offsetWidth + "px";
        img.style.height = canvas.offsetHeight + "px";
        canvas.parentNode.replaceChild(img, canvas);
        return { canvas, img };
      });

      // PAKSA ELEMEN MENJADI UKURAN KERTAS A4 (794px) AGAR TIDAK TERPOTONG DI KANAN
      element.style.cssText += "width: 794px !important; max-width: 794px !important; margin: 0 !important; padding: 20px !important; box-sizing: border-box !important;";
      
      // PAKSA TABEL MENYESUAIKAN DIRI (WRAP TEXT)
      tables.forEach(t => {
        tableStyles.push(t.style.cssText);
        t.style.cssText += "table-layout: fixed !important; width: 100% !important; word-wrap: break-word !important;";
      });

      // 4. KONFIGURASI HTML2PDF
      const opt = {
        margin:       [10, 10, 10, 10], 
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          logging: false,
          scrollY: 0,
          windowWidth: 794 // Sinkronisasi kamera dengan lebar elemen
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { 
          mode: ['css', 'legacy'], 
          avoid: ['tr', '.report-section', '.chart-box', '.sign-box', '.report-section-title', 'h2', 'h3'] 
        }
      };

      // 5. RENDER PDF (Hanya butuh 1-2 detik)
      const pdfBase64Uri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
      const cleanBase64 = pdfBase64Uri.split(',')[1];

      // 6. SEGERA KEMBALIKAN SEMUA STYLE KE KONDISI NORMAL SEBELUMNYA
      element.style.cssText = originalElementStyle;
      tables.forEach((t, i) => { t.style.cssText = tableStyles[i]; });
      canvasReplacements.forEach(({ canvas, img }) => { img.parentNode.replaceChild(canvas, img); });

      // 7. UPLOAD KE DRIVE
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
  }, 3000);
});
