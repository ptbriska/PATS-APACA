/* ==========================================================================
   PATS PORTAL - PDF EXPORTER (THE "ONCLONE" METHOD - ZERO OFFSET FIX)
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

      // 1. SIMPAN GAMBAR CHART
      const canvasElements = Array.from(element.querySelectorAll("canvas"));
      const canvasData = canvasElements.map(c => {
        return {
          dataUrl: c.toDataURL('image/png', 1.0),
          width: c.offsetWidth,
          height: c.offsetHeight,
          cssText: c.style.cssText
        };
      });

      // 2. KONFIGURASI HTML2PDF
      const opt = {
        margin:       [10, 10, 10, 10], 
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          logging: false,
          windowWidth: 1024,
          x: 0, // Kunci kamera di titik paling kiri
          y: 0, // Kunci kamera di titik paling atas
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            const clonedTarget = clonedDoc.getElementById(elementId);
            if (!clonedTarget) return;

            // PERBAIKAN FATAL: Buang semua margin tengah agar elemen nempel di titik 0,0
            clonedDoc.body.style.margin = '0';
            clonedDoc.body.style.padding = '0';
            clonedDoc.documentElement.style.margin = '0';
            clonedDoc.documentElement.style.padding = '0';

            clonedTarget.style.margin = '0'; // Rata Kiri Mutlak (Menghindari Cut-Off)
            clonedTarget.style.padding = '20px';
            clonedTarget.style.width = '1000px'; // Paksa jadi lebar desktop agar tabel muat lega
            clonedTarget.style.maxWidth = '1000px';
            clonedTarget.style.position = 'relative';
            clonedTarget.style.left = '0';
            clonedTarget.style.top = '0';

            // Ganti canvas dengan gambar
            const clonedCanvases = Array.from(clonedTarget.querySelectorAll("canvas"));
            clonedCanvases.forEach((c, index) => {
              if (canvasData[index]) {
                const img = clonedDoc.createElement('img');
                img.src = canvasData[index].dataUrl;
                img.style.cssText = canvasData[index].cssText;
                img.style.width = canvasData[index].width + 'px';
                img.style.height = canvasData[index].height + 'px';
                img.style.display = 'block';
                c.parentNode.replaceChild(img, c);
              }
            });
          }
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { 
          mode: ['css', 'legacy'], 
          avoid: ['tr', '.report-section', '.chart-box', '.sign-box', '.report-section-title', 'h1', 'h2', 'h3', 'h4', 'h5'] 
        }
      };

      // 3. EKSEKUSI RENDER
      const pdfBase64Uri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
      const cleanBase64 = pdfBase64Uri.split(',')[1];

      // 4. UPLOAD KE GOOGLE DRIVE
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
  }, 3500); 
});
