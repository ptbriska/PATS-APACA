/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KU7: APACA Work Personality Trait Inventory (WPTI-OCEAN)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KU7_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), T-Score, Categorization, dan Data Tabel untuk KU7
   * @param {object} answers - Objek jawaban { questionId: value }
   * @param {object} soalData - Master data dari soal.json (KU7)
   * @param {object} rubrikData - Data deskripsi dari rubrik.json (KU7)
   */
  evaluate(answers, soalData, rubrikData) {
    const rawScores = {
      "Openness": 0,
      "Conscientiousness": 0,
      "Extraversion": 0,
      "Agreeableness": 0,
      "Neuroticism": 0
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
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const ansVal = answers[q.id] || 1;
        let finalItemScore = ansVal;

        // Item Favorable: STS=1, TS=2, S=3, SS=4
        // Item Unfavorable: STS=4, TS=3, S=2, SS=1
        if (q.type === "Unfavorable") {
          finalItemScore = 5 - ansVal;
        }

        if (rawScores[q.kategori] !== undefined) {
          rawScores[q.kategori] += finalItemScore;
        }
      });
    }

    // 3. Konversi Skor Mentah (RS) ke T-Score & Kategori Norma Psikometri
    const tScores = {};
    const categories = {};
    const percentages = {};
    const tableRows = [];

    for (const [kategori, rs] of Object.entries(rawScores)) {
      // Formulasi T-Score Standar (Mean Norma RS = 25, SD RS = 5)
      const meanRS = 25;
      const sdRS = 5;
      const tScore = Math.round(50 + 10 * ((rs - meanRS) / sdRS));
      tScores[kategori] = tScore;

      // Persentase Dominansi (Rentang RS 10 - 40)
      const pct = Math.round(((rs - 10) / 30) * 100);
      percentages[kategori] = pct;

      // Matriks Kategori Norma T-Score KU7
      let katNorma = "Sangat Rendah";
      if (tScore >= 65) {
        katNorma = "Sangat Tinggi";
      } else if (tScore >= 55) {
        katNorma = "Tinggi";
      } else if (tScore >= 45) {
        katNorma = "Sedang";
      } else if (tScore >= 35) {
        katNorma = "Rendah";
      }
      categories[kategori] = katNorma;

      // Data baris tabel laporan
      tableRows.push({
        label: kategori,
        categoryKey: kategori,
        rs: rs,
        ts: tScore,
        percentage: pct,
        category: katNorma
      });
    }

    // 4. Menentukan Dimensi Kepribadian Utama (Dominan)
    let dominantCategory = "Openness";
    let maxT = -1;

    for (const [kategori, tVal] of Object.entries(tScores)) {
      if (tVal > maxT) {
        maxT = tVal;
        dominantCategory = kategori;
      }
    }

    // Ambil narasi komprehensif dari rubrikData (rubrik.json KU7)
    const rubrikSource = (rubrikData && rubrikData.rubrik_deskripsi) 
      ? rubrikData.rubrik_deskripsi 
      : {};

    const narrative = rubrikSource[dominantCategory] || {};

    return {
      isInvalid: false,
      rawScores: rawScores,
      tScores: tScores,
      percentages: percentages,
      categories: categories,
      dominantCategory: dominantCategory,
      dominantKey: dominantCategory,
      tableRows: tableRows,
      narrative: narrative
    };
  },

  /**
   * Menyusun Payload dan Mengirimkan Hasil Rekap ke Google Sheets via GAS
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    // String format rekap skor mentah dan T-Score
    const skorMentahStr = Object.entries(evaluationResult.rawScores)
      .map(([kat, val]) => `${kat}: ${val}`)
      .join(", ");

    const standardScoreStr = Object.entries(evaluationResult.tScores)
      .map(([kat, val]) => `T-${kat}: ${val}`)
      .join(", ");

    // Timestamp lokal (YYYY-MM-DD HH:mm:ss)
    const now = new Date();
    const formattedTimestamp = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, '0') + "-" +
      String(now.getDate()).padStart(2, '0') + " " +
      String(now.getHours()).padStart(2, '0') + ":" +
      String(now.getMinutes()).padStart(2, '0') + ":" +
      String(now.getSeconds()).padStart(2, '0');

    // Payload Rekap Modal KU7
    const payload = {
      timestamp: formattedTimestamp,
      kode_akses: userSession.kode_akses || "-",
      nama_lengkap: userSession.nama_lengkap || "-",
      asal_instansi: userSession.asal_instansi || "Umum",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KU7",
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
      console.log("Sistem Rekap: Data pengerjaan KU7 berhasil terkirim ke Spreadsheet.");
    } catch (error) {
      console.error("Sistem Rekap Error KU7:", error);
    }
  }
};
