/* ==========================================================================
   PATS PORTAL - PDF EXPORTER UTILITY (pdf-exporter.js)
   ========================================================================== */

const PATS_PDF = {
  /**
   * Memicu dialog cetak bawaan browser
   */
  printReport() {
    window.print();
  },

  /**
   * Mengeksport elemen HTML Laporan ke PDF menggunakan html2pdf.js (jika library dimuat)
   * @param {string} elementId - ID dari kontainer laporan (.report-paper)
   * @param {string} fileName - Nama file PDF output
   */
  exportToPDF(elementId, fileName = "Laporan_Hasil_Tes_PATS.pdf") {
    const element = document.getElementById(elementId);
    
    if (!element) {
      console.error("Elemen laporan tidak ditemukan.");
      return;
    }

    // Opsi konfigurasi html2pdf
    const options = {
      margin:       [10, 10, 10, 10], // top, left, bottom, right in mm
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Jalankan ekspor jika pustaka html2pdf tersedia
    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(options).from(element).save();
    } else {
      console.warn("html2pdf.js tidak terdeteksi. Mengalihkan ke window.print().");
      this.printReport();
    }
  }
};
