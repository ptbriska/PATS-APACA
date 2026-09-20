/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KK1: APACA Teaching Style Inventory (ATSI)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KK1_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), T-Score, Kategorisasi Norma, dan Narasi untuk KK1
   * @param {object} answers - Objek jawaban { questionId: value }
   * @param {object} soalData - Master data dari soal.json (KK1)
   */
  evaluate(answers, soalData) {
    const rawScores = {
      "Pakar": 0,
      "Otoritas Formal": 0,
      "Model Personal": 0,
      "Fasilitator": 0,
      "Delegator": 0
    };

    // 1. Invariance Response Check (Validitas Pengerjaan 50 item)
    const uniqueAnswers = new Set(Object.values(answers));
    if (Object.keys(answers).length >= 50 && uniqueAnswers.size === 1) {
      return { 
        isInvalid: true, 
        message: "Flag: Invalid Response (Jawaban terdeteksi seragam pada seluruh item)." 
      };
    }

    // 2. Kalkulasi Skor Mentah (RS) dengan Pembobotan Favorable & Unfavorable
    soalData.questions.forEach(q => {
      const ansVal = answers[q.id] || 1;
      let finalItemScore = ansVal;

      // Item Unfavorable: STS=4, TS=3, S=2, SS=1
      if (q.type === "Unfavorable") {
        finalItemScore = 5 - ansVal;
      }

      if (rawScores[q.kategori] !== undefined) {
        rawScores[q.kategori] += finalItemScore;
      }
    });

    // 3. Konversi Skor Mentah (RS) ke T-Score (Mean=50, SD=10)
    // Norma Statistik Baku ATSI (Mean RS = 25, SD RS = 5)
    const tScores = {};
    const categories = {};

    for (const [kategori, rs] of Object.entries(rawScores)) {
      const meanRS = 25;
      const sdRS = 5;
      const tScore = Math.round(50 + 10 * ((rs - meanRS) / sdRS));
      tScores[kategori] = tScore;

      // Categorization Matrix (Sesuai Manual Book ATSI Bab V)
      if (tScore >= 65) {
        categories[kategori] = "Sangat Dominan";
      } else if (tScore >= 55) {
        categories[kategori] = "Dominan";
      } else if (tScore >= 45) {
        categories[kategori] = "Sedang";
      } else if (tScore >= 35) {
        categories[kategori] = "Rendah";
      } else {
        categories[kategori] = "Sangat Rendah";
      }
    }

    // 4. Menentukan Gaya Mengajar Utama (Dominan)
    let dominantCategory = "Pakar";
    let maxT = -1;

    for (const [kategori, tVal] of Object.entries(tScores)) {
      if (tVal > maxT) {
        maxT = tVal;
        dominantCategory = kategori;
      }
    }

    const narrative = (soalData.rubrik_deskripsi && soalData.rubrik_deskripsi[dominantCategory]) 
      ? soalData.rubrik_deskripsi[dominantCategory] 
      : {};

    return {
      isInvalid: false,
      rawScores: rawScores,
      tScores: tScores,
      categories: categories,
      dominantCategory: dominantCategory,
      narrative: narrative
    };
  },

  /**
   * Menyusun Payload dan Mengirimkan Hasil Rekap ke Google Sheets via GAS
   * @param {object} answers - Objek jawaban peserta
   * @param {object} userSession - Data sesi peserta dari sessionStorage
   * @param {object} evaluationResult - Hasil kembalian dari method evaluate()
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    // Formatting string skor mentah & standard score
    const skorMentahStr = Object.entries(evaluationResult.rawScores)
      .map(([kat, val]) => `${kat}: ${val}`)
      .join(", ");

    const standardScoreStr = Object.entries(evaluationResult.tScores)
      .map(([kat, val]) => `${kat}: ${val}`)
      .join(", ");

    // Format timestamp lokal (YYYY-MM-DD HH:mm:ss)
    const now = new Date();
    const formattedTimestamp = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, '0') + "-" +
      String(now.getDate()).padStart(2, '0') + " " +
      String(now.getHours()).padStart(2, '0') + ":" +
      String(now.getMinutes()).padStart(2, '0') + ":" +
      String(now.getSeconds()).padStart(2, '0');

    // Payload Standar Rekap (FORMAT_A) untuk KK1
    const payload = {
      timestamp: formattedTimestamp,
      kode_akses: userSession.kode_akses || "-",
      nama_lengkap: userSession.nama_lengkap || "-",
      asal_instansi: userSession.asal_instansi || "Umum",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KK1",
      skor_mentah: skorMentahStr,
      standard_score: standardScoreStr,
      kategori_hasil: `${evaluationResult.categories[evaluationResult.dominantCategory]} ${evaluationResult.dominantCategory}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap: Data pengerjaan KK1 berhasil terkirim ke Spreadsheet.");
    } catch (error) {
      console.error("Sistem Rekap Error:", error);
    }
  }
};
