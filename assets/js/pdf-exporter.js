/* ==========================================================================
   PATS PORTAL - PDF EXPORTER (THE "ONCLONE" METHOD)
   100% Aman untuk UI, Chart Tampil, Tidak Terpotong, Tidak Blank
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

      // 1. SIMPAN GAMBAR CHART DULU
      // (Kita ambil foto chart dari layar sebelum html2pdf bekerja)
      const canvasElements = Array.from(element.querySelectorAll("canvas"));
      const canvasData = canvasElements.map(c => {
        return {
          dataUrl: c.toDataURL('image/png', 1.0),
          width: c.offsetWidth,
          height: c.offsetHeight,
          cssText: c.style.cssText
        };
      });

      // 2. KONFIGURASI HTML2PDF DENGAN "ONCLONE"
      const opt = {
        margin:       [10, 10, 10, 10], // Margin aman 1 cm
        filename:     fileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          logging: false,
          windowWidth: 1024, // Anggap layar komputer desktop agar tabel merentang luas
          // FITUR AJAIB ONCLONE: Mengedit DOM HANYA di ruang memori kloning
          // Web asli tidak akan disentuh, tidak akan berkedip, tidak akan melar
          onclone: (clonedDoc) => {
            const clonedTarget = clonedDoc.getElementById(elementId);
            if (!clonedTarget) return;

            // Paksa ukuran dokumen di memori agar pas dengan proporsi A4
            clonedTarget.style.width = '800px';
            clonedTarget.style.maxWidth = '800px';
            clonedTarget.style.margin = '0 auto';

            // Ganti canvas kosong di memori kloning dengan foto Chart yang kita simpan tadi
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
          avoid: ['tr', '.report-section', '.chart-box', '.sign-box', '.report-section-title', 'h2', 'h3', 'h4', 'h5'] 
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
