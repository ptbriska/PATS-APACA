/* ==========================================================================
   PATS PORTAL - PDF EXPORTER & AUTO DRIVE ARCHIVER UTILITY
   Paged.js edition with Auto-Dependency Injector
   ========================================================================== */

const GAS_PDF_DRIVE_URL = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const PATS_PDF_STYLESHEETS = [
  "assets/css/print-pdf.css"
];

// 1. SET KONFIGURASI PAGED.JS DI AWAL SKRIP
window.PagedConfig = window.PagedConfig || { auto: false };

const PATS_PDF = {
  _pagedPreviewer: null,
  _dependenciesLoadedPromise: null,

  // Helper untuk inject tag <script> secara otomatis ke HTML
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Gagal memuat script: ${src}`));
      document.head.appendChild(script);
    });
  },

  // Mengunduh semua library CDN jika belum ada di HTML
  async ensureDependencies() {
    if (this._dependenciesLoadedPromise) return this._dependenciesLoadedPromise;

    this._dependenciesLoadedPromise = (async () => {
      const scripts = [
        "https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.polyfill.js",
        "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
        "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
      ];

      for (const src of scripts) {
        await this._loadScript(src);
      }
    })();

    return this._dependenciesLoadedPromise;
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

  async _paginate(elementId) {
    await this.ensureDependencies();

    if (typeof Paged === "undefined") {
      throw new Error("Paged.js gagal diunduh dari CDN.");
    }
    const source = document.getElementById(elementId);
    if (!source) throw new Error(`Elemen #${elementId} tidak ditemukan.`);

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

    this._pagedPreviewer = new Paged.Previewer();

    let renderTarget = document.getElementById("pagedjs-render-target");
    if (!renderTarget) {
      renderTarget = document.createElement("div");
      renderTarget.id = "pagedjs-render-target";
      document.body.appendChild(renderTarget);
    }
    renderTarget.innerHTML = "";

    const flow = await this._pagedPreviewer.preview(clone.outerHTML, PATS_PDF_STYLESHEETS, renderTarget);
    return { flow, renderTarget };
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

      const { renderTarget } = await this._paginate(elementId);

      document.body.classList.add("pagedjs-printing");

      const originalTitle = document.title;
      document.title = fileName.replace(/\.pdf$/i, "");

      window.print();

      const cleanup = () => {
        document.title = originalTitle;
        document.body.classList.remove("pagedjs-printing");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      setTimeout(cleanup, 5000);

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
      await this.ensureDependencies();
      console.log("[DRIVE ARCHIVE]: Memproses konversi PDF...");

      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
      const fileName = this.generateStandardFileName(user);

      const { renderTarget } = await this._paginate(elementId);
      const pages = renderTarget.querySelectorAll(".pagedjs_page");
      if (!pages.length) throw new Error("Paged.js tidak menghasilkan halaman apa pun.");

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 1.5, useCORS: true, logging: false });
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

    } catch (err) {
      console.error("[DRIVE ARCHIVE ERROR]:", err);
    }
  }
};

// Pre-load library secara diam-diam di background begitu halaman selesai dibuka
document.addEventListener("DOMContentLoaded", () => {
  PATS_PDF.ensureDependencies();

  setTimeout(() => {
    PATS_PDF.autoArchiveToDrive("report-paper");
  }, 3500);
});
