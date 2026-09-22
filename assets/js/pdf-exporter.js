/* ==========================================================================
   PATS PORTAL - PDF EXPORTER & AUTO DRIVE ARCHIVER UTILITY
   Isolasi Iframe Murni (100% Aman dari Distorsi CSS & Bebas Error Layout)
   ========================================================================== */

const GAS_PDF_DRIVE_URL = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const PATS_PDF = {
  _dependenciesLoadedPromise: null,

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Gagal memuat script: ${src}`));
      document.head.appendChild(script);
    });
  },

  async ensureDependencies() {
    if (this._dependenciesLoadedPromise) return this._dependenciesLoadedPromise;
    this._dependenciesLoadedPromise = (async () => {
      // jsPDF tetap dimuat di halaman utama karena hanya bertugas membungkus gambar
      await this._loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
    })();
    return this._dependenciesLoadedPromise;
  },

  _getAbsoluteStylesheets() {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const stylesheets = links
      .map(link => link.href)
      .filter(href => href && !href.includes('font-awesome'));
    
    if (stylesheets.length === 0) {
      stylesheets.push(new URL("assets/css/print-pdf.css", document.baseURI).href);
    }
    return stylesheets;
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

  printReport() {
    window.print();
  },

  async _renderInSandbox(elementId, callback) {
    await this.ensureDependencies();

    const source = document.getElementById(elementId);
    if (!source) throw new Error(`Elemen #${elementId} tidak ditemukan.`);

    // 1. Buat Ruang Isolasi Iframe
    const iframe = document.createElement("iframe");
    iframe.id = "pats-pdf-sandbox";
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px"; // Jauhkan dari layar agar tidak terlihat
    iframe.style.top = "0";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    // 2. Bekukan Chart Canvas menjadi Gambar
    const clone = source.cloneNode(true);
    const liveCanvases = source.querySelectorAll("canvas");
    const clonedCanvases = clone.querySelectorAll("canvas");
    liveCanvases.forEach((liveCanvas, i) => {
      const clonedCanvas = clonedCanvases[i];
      if (!clonedCanvas) return;
      const img = document.createElement("img");
      img.src = liveCanvas.toDataURL("image/png");
      img.style.cssText = clonedCanvas.style.cssText;
      img.className = clonedCanvas.className;
      img.width = liveCanvas.width;
      img.height = liveCanvas.height;
      clonedCanvas.replaceWith(img);
    });

    const stylesheets = this._getAbsoluteStylesheets();
    const styleLinks = stylesheets.map(href => `<link rel="stylesheet" href="${href}">`).join("\n");

    // 3. Suntik Library dan CSS khusus DI DALAM iframe saja
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <script>window.PagedConfig = { auto: false };</script>
        <script src="https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.polyfill.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
        ${styleLinks}
      </head>
      <body style="margin:0; padding:0; background:#fff;">
        <div id="pagedjs-render-target"></div>
      </body>
      </html>
    `);
    iframeDoc.close();

    // 4. Tunggu Paged.js dan html2canvas menyala di dalam Iframe
    await new Promise((resolve, reject) => {
      let attempt = 0;
      const check = setInterval(() => {
        if (iframe.contentWindow && iframe.contentWindow.Paged && iframe.contentWindow.html2canvas) {
          clearInterval(check);
          resolve();
        }
        if (attempt++ > 150) { // Timeout 15 detik
          clearInterval(check);
          reject(new Error("Timeout memuat library Paged.js di dalam Sandbox."));
        }
      }, 100);
    });

    // Jeda sejenak agar CSS selesai merender ukuran
    await new Promise(r => setTimeout(r, 1000));

    const targetEl = iframeDoc.getElementById("pagedjs-render-target");
    
    // 5. EKSEKUSI UTAMA: Panggil Paged.js dari dalam window iframe (Mengatasi error null)
    const previewer = new iframe.contentWindow.Paged.Previewer();
    await previewer.preview(clone.outerHTML, stylesheets, targetEl);

    try {
      return await callback(iframe, iframeDoc, targetEl);
    } finally {
      // 6. Buang Iframe setelah selesai, kembalikan memori
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }
  },

  async exportToPDF(elementId = "report-paper") {
    const triggerBtn = typeof event !== "undefined" && event && event.target ? event.target : null;
    let originalText = "";
    if (triggerBtn) {
      originalText = triggerBtn.innerText;
      triggerBtn.innerText = "Memproses PDF...";
      triggerBtn.disabled = true;
    }

    try {
      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
      const fileName = this.generateStandardFileName(user);

      await this._renderInSandbox(elementId, async (iframe) => {
        const originalTitle = document.title;
        document.title = fileName.replace(/\.pdf$/i, "");
        
        // Murni hanya mencetak dokumen Iframe, web utama tidak akan berkedip/melar
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        document.title = originalTitle;
      });

    } catch (err) {
      console.error("Gagal export PDF:", err);
      this.printReport();
    } finally {
      if (triggerBtn) {
        triggerBtn.innerText = originalText;
        triggerBtn.disabled = false;
      }
    }
  },

  async autoArchiveToDrive(elementId = "report-paper") {
    try {
      console.log("[DRIVE ARCHIVE]: Memproses konversi PDF...");
      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
      const fileName = this.generateStandardFileName(user);

      await this._renderInSandbox(elementId, async (iframe, iframeDoc, targetEl) => {
        const pages = targetEl.querySelectorAll(".pagedjs_page");
        if (!pages.length) throw new Error("Paged.js tidak menghasilkan halaman apa pun.");

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

        for (let i = 0; i < pages.length; i++) {
          // Panggil html2canvas milik Iframe agar akurasi pemotongan 100% sempurna
          const canvas = await iframe.contentWindow.html2canvas(pages[i], { 
            scale: 1.5, 
            useCORS: true, 
            logging: false 
          });
          const imgData = canvas.toDataURL("image/jpeg", 0.85);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
        }

        const cleanBase64 = pdf.output("datauristring").split(",")[1];

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
      });

    } catch (err) {
      console.error("[DRIVE ARCHIVE ERROR]:", err);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  PATS_PDF.ensureDependencies();
  setTimeout(() => { PATS_PDF.autoArchiveToDrive("report-paper"); }, 3500);
});
