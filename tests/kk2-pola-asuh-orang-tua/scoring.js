/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KK2: APACA Parenting Style Inventory (APSI)
   ========================================================================== */

const KK2_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), T-Score, dan Kategorisasi Norma
   * @param {object} answers - Objek jawaban { questionId: value }
   * @param {object} soalData - Master data dari soal.json
   */
  evaluate(answers, soalData) {
    const rawScores = { "Otoritatif": 0, "Otoriter": 0, "Permisif": 0, "Pengabaian": 0 };

    // 1. Invariance Response Check (Validitas Pengerjaan)
    const uniqueAnswers = new Set(Object.values(answers));
    if (Object.keys(answers).length >= 40 && uniqueAnswers.size === 1) {
      return { isInvalid: true, message: "Flag: Invalid Response (Jawaban terdeteksi seragam pada seluruh item)." };
    }

    // 2. Kalkulasi Skor Mentah (RS) dengan Pembobotan Favorable & Unfavorable
    soalData.questions.forEach(q => {
      const ansVal = answers[q.id] || 1;
      let finalItemScore = ansVal;

      // Item Unfavorable: STS=4, TS=3, S=2, SS=1
      if (q.type === "Unfavorable") {
        finalItemScore = 5 - ansVal;
      }

      rawScores[q.kategori] += finalItemScore;
    });

    // 3. Konversi Skor Mentah (RS) ke T-Score (Mean=50, SD=10)
    // Norma Statistik Baku APSI (Mean RS = 25, SD RS = 5)
    const tScores = {};
    const categories = {};

    for (const [kategori, rs] of Object.entries(rawScores)) {
      const meanRS = 25;
      const sdRS = 5;
      const tScore = Math.round(50 + 10 * ((rs - meanRS) / sdRS));
      tScores[kategori] = tScore;

      // Categorization Matrix
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

    // 4. Menentukan Pola Asuh Utama (Dominan)
    let dominantCategory = "Otoritatif";
    let maxT = -1;

    for (const [kategori, tVal] of Object.entries(tScores)) {
      if (tVal > maxT) {
        maxT = tVal;
        dominantCategory = kategori;
      }
    }

    const narrative = soalData.rubrik_deskripsi[dominantCategory];

    return {
      isInvalid: false,
      rawScores: rawScores,
      tScores: tScores,
      categories: categories,
      dominantCategory: dominantCategory,
      narrative: narrative
    };
  }
};
