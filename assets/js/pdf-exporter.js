/* ==========================================================================
   PATS PORTAL - PDF EXPORTER (ULTIMATE ISOLATION + FIT TO PAGE)
   Memperbaiki Grafik Blank & Tabel Menyempit agar 100% Identik Native Print
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

      // 1. Kloning HTML dan bekukan Chart.js menjadi gambar absolut (Mencegah Grafik Blank)
      const clone = source.cloneNode(true);
      const liveCanvases = source.querySelectorAll("canvas");
      const clonedCanvases = clone.querySelectorAll("canvas");
      
      liveCanvases.forEach((liveCanvas, i) => {
        if(clonedCanvases[i]) {
            const img = document.createElement("img");
            // Paksa latar belakang putih saat render canvas ke base64
            img.src = liveCanvas.toDataURL("image/png", 1.0);
            
            // Aturan ketat agar gambar tidak collapse di dalam Paged.js
            img.style.cssText = clonedCanvases[i].style.cssText;
            img.style.width = "100%";
            img.style.maxWidth = liveCanvas.width + "px";
            img.style.height = "auto";
            img.style.display = "block";
            img.style.margin = "0 auto";
            
            clonedCanvases[i].replaceWith(img);
        }
      });

      // 2. Ambil semua CSS asli
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href).filter(Boolean);
      const styles = Array.from(document.querySelectorAll('style')).map(s => s.innerHTML);

      // 3. Setup Iframe
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "1200px"; 
      iframe.style.height = "100vh";
      iframe.style.visibility = "hidden"; 
      iframe.style.zIndex = "-9999";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;

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

      // 4. HTML Iframe (Trik "Fit to Page")
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${links.map(l => `<link rel="stylesheet" href="${l}">`).join('\n')}
          ${styles.map(s => `<style>${s}</style>`).join('\n')}
          
          <script>window.PagedConfig = { auto: false };<\/script>
          <script src="https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.polyfill.js"><\/script>
          <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
          <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"><\/script>
          
          <style>
            /* SCALING TRICK: Buat ukuran kertas Paged.js 20% lebih besar dari A4.
               Ini memberi ruang luas untuk tabel agar tidak menyempit/terpotong. 
               Nanti jsPDF akan menciutkannya kembali ke A4 persis seperti fitur "Fit to Page" browser. */
            @page {
              size: 252mm 356mm; 
              margin: 15mm;
            }

            body { 
              margin: 0; 
              padding: 0; 
              background: #fff; 
              font-family: system-ui, -apple-system, sans-serif;
            }

            .report-paper { 
              margin: 0 auto !important; 
              width: 100% !important; 
              max-width: none !important; 
              padding: 0 !important; 
              box-shadow: none !important;
            }

            /* Hapus paksaan break pada tabel agar kolom bernapas lega */
            table { 
              width: 100% !important; 
              border-collapse: collapse; 
            }
            th, td { 
              word-wrap: normal !important; 
            }

            /* Cegah gambar/grafik terbelah di batas kertas */
            img, .chart-box {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .portal-header, .portal-footer, .btn-primary, .no-print { display: none !important; }
          </style>
        </head>
        <body>
          <div id="source-content" style="display:none;">${clone.outerHTML}</div>
          <div id="render-target"></div>
          
          <script>
            window.onload = async function() {
              try {
                // Beri waktu lebih agar aset, font, dan ukuran kontainer terbaca sempurna
                await new Promise(r => setTimeout(r, 1500));
                
                const sourceHtml = document.getElementById("source-content").innerHTML;
                const target = document.getElementById("render-target");
                
                const previewer = new window.Paged.Previewer();
                await previewer.preview(sourceHtml, [], target);
                
                const pages = target.querySelectorAll(".pagedjs_page");
                if (!pages || pages.length === 0) throw new Error("Paged.js gagal membagi halaman.");
                
                // Siapkan dokumen akhir tetap berukuran A4 murni
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
                
                for (let i = 0; i < pages.length; i++) {
                  const canvas = await window.html2canvas(pages[i], { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    backgroundColor: "#ffffff"
                  });
                  
                  if (i > 0) pdf.addPage();
                  // Ajaibnya di sini: Gambar kertas besar (252x356) dipaksa masuk ke bingkai A4 (210x297)
                  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
                }
                
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

      const cleanBase64 = await getPdfBase64;
      document.body.removeChild(iframe);

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
      const leftoverIframe = document.querySelector("iframe[style*='1200px']");
      if (leftoverIframe) leftoverIframe.remove();
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Waktu tunggu dinaikkan ke 3.5 detik untuk memastikan animasi Chart.js selesai 100% sebelum difoto
  setTimeout(() => {
    PATS_PDF.autoArchiveToDrive("report-paper");
  }, 3500);
});
