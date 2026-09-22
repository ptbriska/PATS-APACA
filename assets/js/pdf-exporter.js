/* ==========================================================================
   PATS PORTAL - PDF EXPORTER (ULTIMATE ISOLATION)
   100% Aman untuk Tampilan Web Utama. Tidak ada Library External yang bocor.
   ========================================================================== */

const GAS_PDF_DRIVE_URL = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const PATS_PDF = {
  generateStandardFileName(user = {}) {
    const rawKode = user.kode_modul || user.kode_akses || user.kode_kegiatan || "TES";
    const rawNama = user.nama_lengkap || user.nama || "Siswa";
    const rawInstansi = user.asal_instansi || user.sekolah || "Instansi";

    const cleanStr = (str) => str.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").trim();
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    return `${cleanStr(rawKode)}_${cleanStr(rawNama)}_${cleanStr(rawInstansi)}_${timestamp}.pdf`;
  },

  // Tombol Export milik user cukup memanggil print native (Paling rapi & aman)
  exportToPDF() {
    window.print();
  },

  async autoArchiveToDrive(elementId = "report-paper") {
    try {
      console.log("[DRIVE ARCHIVE]: Memulai pembuatan PDF di ruang isolasi...");
      
      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : {};
      const fileName = this.generateStandardFileName(user);
      const source = document.getElementById(elementId);
      if (!source) throw new Error("Elemen report tidak ditemukan.");

      // 1. Kloning HTML dan bekukan Chart.js menjadi gambar
      const clone = source.cloneNode(true);
      const liveCanvases = source.querySelectorAll("canvas");
      const clonedCanvases = clone.querySelectorAll("canvas");
      liveCanvases.forEach((liveCanvas, i) => {
        if(clonedCanvases[i]) {
            const img = document.createElement("img");
            img.src = liveCanvas.toDataURL("image/png");
            img.style.cssText = clonedCanvases[i].style.cssText;
            img.width = liveCanvas.width;
            img.height = liveCanvas.height;
            clonedCanvases[i].replaceWith(img);
        }
      });

      // 2. Ambil semua CSS dari web utama untuk dipakai di dalam iframe
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href).filter(Boolean);
      const styles = Array.from(document.querySelectorAll('style')).map(s => s.innerHTML);

      // 3. Buat Iframe Tersembunyi (Gunakan visibility: hidden agar getBoundingClientRect tidak error)
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "210mm";
      iframe.style.height = "297mm";
      iframe.style.visibility = "hidden"; 
      iframe.style.zIndex = "-9999";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;

      // 4. Siapkan penangkap sinyal dari dalam Iframe
      const getPdfBase64 = new Promise((resolve, reject) => {
        const listener = (event) => {
          if (event.data && event.data.type === 'pdf_success') {
            window.removeEventListener('message', listener);
            resolve(event.data.base64);
          } else if (event.data && event.data.type === 'pdf_error') {
            window.removeEventListener('message', listener);
            reject(event.data.error);
          }
        };
        window.addEventListener('message', listener);
      });

      // 5. Tulis sistem mandiri murni di dalam Iframe
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${links.map(l => `<link rel="stylesheet" href="${l}">`).join('\n')}
          ${styles.map(s => `<style>${s}</style>`).join('\n')}
          
          <!-- HANYA LOAD LIBRARY DI DALAM IFRAME -->
          <script>window.PagedConfig = { auto: false };<\/script>
          <script src="https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.polyfill.js"><\/script>
          <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
          <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"><\/script>
          
          <style>
            body { margin: 0; padding: 0; background: #fff; }
            .report-paper { margin: 0 auto !important; width: 100% !important; max-width: 100% !important; }
            table { table-layout: fixed !important; width: 100% !important; }
            th, td { word-wrap: break-word !important; }
          </style>
        </head>
        <body>
          <!-- Konten Mentah -->
          <div id="source-content" style="display:none;">${clone.outerHTML}</div>
          
          <!-- Target Render Paged.js -->
          <div id="render-target"></div>
          
          <script>
            window.onload = async function() {
              try {
                // Jeda 1 detik menunggu font & CSS termuat sempurna agar layout akurat
                await new Promise(r => setTimeout(r, 1000));
                
                const sourceHtml = document.getElementById("source-content").innerHTML;
                const target = document.getElementById("render-target");
                
                // 1. Eksekusi Paginasi Paged.js
                const previewer = new window.Paged.Previewer();
                await previewer.preview(sourceHtml, [], target);
                
                const pages = target.querySelectorAll(".pagedjs_page");
                if (!pages || pages.length === 0) throw new Error("Paged.js gagal membagi halaman.");
                
                // 2. Ekspor ke PDF dengan html2canvas + jsPDF
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
                
                for (let i = 0; i < pages.length; i++) {
                  const canvas = await window.html2canvas(pages[i], { scale: 1.5, useCORS: true, logging: false });
                  if (i > 0) pdf.addPage();
                  pdf.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, 210, 297);
                }
                
                // 3. Kirim hasil Base64 ke halaman utama web
                window.parent.postMessage({ type: 'pdf_success', base64: pdf.output("datauristring").split(",")[1] }, '*');
              } catch (err) {
                window.parent.postMessage({ type: 'pdf_error', error: err.toString() }, '*');
              }
            };
          <\/script>
        </body>
        </html>
      `;

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // 6. Tunggu Iframe selesai bekerja
      const cleanBase64 = await getPdfBase64;
      
      // 7. Hancurkan Iframe (Membersihkan Memori)
      document.body.removeChild(iframe);

      // 8. Upload PDF Base64 ke Google Drive
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
      // Hapus iframe jika terjadi error di tengah jalan
      const leftoverIframe = document.querySelector("iframe[style*='210mm']");
      if (leftoverIframe) leftoverIframe.remove();
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    PATS_PDF.autoArchiveToDrive("report-paper");
  }, 2000);
});
