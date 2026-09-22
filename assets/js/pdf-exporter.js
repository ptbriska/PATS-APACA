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
      
      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
      const fileName = this.generateStandardFileName(user);
      const element = document.getElementById(elementId);
      
      if (!element) return;

      // 1. Simpan Style Asli & Ubah Canvas ke Gambar (Untuk Chart)
      const origStyle = element.getAttribute("style") || "";
      const canvases = Array.from(element.querySelectorAll("canvas"));
      const canvasReplacements = canvases.map(canvas => {
        const img = document.createElement("img");
        img.src = canvas.toDataURL("image/png", 1.0);
        img.style.width = canvas.offsetWidth + "px";
        img.style.height = canvas.offsetHeight + "px";
        canvas.parentNode.replaceChild(img, canvas);
        return { canvas, img };
      });

      // 2. Kunci Container TEPAT di Ukuran A4 (794px) agar tidak terpotong
      element.style.setProperty("width", "794px", "important");
      element.style.setProperty("max-width", "794px", "important");
      element.style.setProperty("margin", "0 auto", "important");

      // 3. Konfigurasi Standar
      const opt = {
        margin:       10, // Margin aman 10mm
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true }, // Tanpa setting windowWidth
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: 'css', avoid: ['tr', '.report-section', '.chart-box', '.sign-box', '.report-section-title'] }
      };

      // 4. Render ke PDF
      const pdfBase64Uri = await html2pdf().set(opt).from(element).outputPdf('datauristring');
      const cleanBase64 = pdfBase64Uri.split(',')[1];

      // 5. Kembalikan DOM Seketika
      element.setAttribute("style", origStyle);
      canvasReplacements.forEach(({ canvas, img }) => {
        img.parentNode.replaceChild(canvas, img);
      });

      // 6. Upload
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
