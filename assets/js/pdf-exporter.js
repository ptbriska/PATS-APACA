/* ==========================================================================
   PATS PORTAL - PDF EXPORTER & AUTO DRIVE ARCHIVER UTILITY
   Paged.js edition - real CSS Paged Media pagination instead of the
   image-slicing approach in html2pdf.js.

   Requires (add to your HTML <head>/<body>, in this order):
     <script>window.PagedConfig = { auto: false };</script>
     <script src="https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.polyfill.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
     <script src="assets/js/pdf-exporter.js"></script>

   html2canvas + jsPDF are only used to turn Paged.js's already-correct
   page boxes into PDF bytes for the silent Drive archive (no user
   gesture available there, so a print dialog isn't possible). The
   user-facing "Export" button uses the browser's real print engine via
   Paged.js + window.print(), which is far more reliable than either.
   ========================================================================== */

const GAS_PDF_DRIVE_URL = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

// Every stylesheet the report's layout/print rules depend on. Paged.js
// does NOT automatically inherit the page's existing <link> tags - list
// them explicitly here (order matters, same as <link> tags would).
const PATS_PDF_STYLESHEETS = [
  "assets/css/print-pdf.css"
];

const PATS_PDF = {
  _pagedPreviewer: null,

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

  // Runs Paged.js against #report-paper and renders real A4 page boxes
  // into #pagedjs-render-target. Returns that target element plus the
  // Paged.js "flow" result (flow.total = page count).
  async _paginate(elementId) {
    if (typeof Paged === "undefined") {
      throw new Error("Paged.js belum ter-load (cek urutan <script> di HTML).");
    }
    const source = document.getElementById(elementId);
    if (!source) throw new Error(`Elemen #${elementId} tidak ditemukan.`);

    // <canvas> content (e.g. a Chart.js bar chart) is drawn pixels, not
    // DOM/HTML, so it doesn't survive cloning. Snapshot every live
    // canvas into a static <img> on a CLONE before handing it to
    // Paged.js, so charts show up correctly on the paginated pages.
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

    // Fresh previewer every run, so re-exporting after data changes works.
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

  // User-facing export: paginate with Paged.js, then hand off to the
  // browser's own print engine (real pagination, not a guess) so the
  // person picks "Save as PDF" from the native print dialog.
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

      // Browsers default the print dialog's "Save as" filename to
      // document.title - swap it in for the duration of the print.
      const originalTitle = document.title;
      document.title = fileName.replace(/\.pdf$/i, "");

      window.print();

      const cleanup = () => {
        document.title = originalTitle;
        document.body.classList.remove("pagedjs-printing");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      setTimeout(cleanup, 5000); // fallback: not every browser fires afterprint reliably

    } catch (err) {
      console.error("Gagal export PDF:", err);
      this.printReport(); // fall back to a plain print of the live page
    } finally {
      if (triggerBtn) {
        triggerBtn.innerText = originalText;
        triggerBtn.disabled = false;
      }
    }
  },

  // Silent background archive: no user gesture is available here, so a
  // print dialog can't be triggered. Instead, screenshot each already
  // correctly-paginated Paged.js page box and stack them into one PDF
  // with jsPDF. Since Paged.js has already solved pagination, each page
  // box holds exactly one A4 page's worth of content - no cut-point
  // guessing, no orphaned headings, nothing left to tune.
  async autoArchiveToDrive(elementId = "report-paper") {
    if (typeof html2canvas === "undefined" || typeof window.jspdf === "undefined") {
      console.warn("[DRIVE ARCHIVE]: html2canvas / jsPDF belum ter-load, archive dilewati.");
      return;
    }

    try {
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
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297); // full A4 bleed; @page margin is already baked into each page box
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

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    PATS_PDF.autoArchiveToDrive("report-paper");
  }, 3000);
});
