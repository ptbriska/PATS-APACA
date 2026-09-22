/* ==========================================================================
   PATS PORTAL - PDF EXPORTER UTILITY (assets/js/pdf-exporter.js)
   Optimized Page Break & UI Handling
   ========================================================================== */

const PATS_PDF = {
  /**
   * Memicu dialog cetak bawaan browser
   */
  printReport() {
    window.print();
  },

  /**
   * Mengeksport elemen HTML Laporan ke PDF menggunakan html2pdf.js
   * @param {string} elementId - ID dari kontainer laporan (#report-paper)
   * @param {string} fileName - Nama file PDF output
   */
  exportToPDF(elementId = "report-paper", fileName = "Laporan_Hasil_Tes_PATS.pdf") {
    const element = document.getElementById(elementId);
    
    if (!element) {
      console.error("Elemen laporan tidak ditemukan:", elementId);
      alert("Gagal memproses cetak: Elemen dokumen laporan tidak ditemukan.");
      return;
    }

    // Tangkap tombol pemicu untuk efek indikator loading UI
    const triggerBtn = event && event.target ? event.target : null;
    let originalText = "";
    if (triggerBtn) {
      originalText = triggerBtn.innerText;
      triggerBtn.innerText = "Memproses PDF...";
      triggerBtn.disabled = true;
    }

    // Opsi Konfigurasi Presisi A4 & Penguncian Page-Break
    const options = {
      margin:       [10, 10, 10, 10], // top, left, bottom, right (mm)
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2,             // Kualitas tinggi (HD)
        useCORS: true,        // Memuat logo/gambar eksternal
        letterRendering: true,
        logging: false
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      // KUNCI UTAMA: Cegah pemotongan elemen acak & halaman kosong
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Eksekusi Pembuatan PDF
    if (typeof html2pdf !== 'undefined') {
      html2pdf()
        .set(options)
        .from(element)
        .save()
        .then(() => {
          if (triggerBtn) {
            triggerBtn.innerText = originalText;
            triggerBtn.disabled = false;
          }
        })
        .catch(err => {
          console.error("Gagal mengeksport PDF via html2pdf:", err);
          alert("Terjadi kesalahan teknis saat membuat PDF. Dialihkan ke dialog cetak sistem.");
          if (triggerBtn) {
            triggerBtn.innerText = originalText;
            triggerBtn.disabled = false;
          }
          this.printReport();
        });
    } else {
      console.warn("html2pdf.js tidak terdeteksi. Mengalihkan ke window.print().");
      if (triggerBtn) {
        triggerBtn.innerText = originalText;
        triggerBtn.disabled = false;
      }
      this.printReport();
    }
  }
};
