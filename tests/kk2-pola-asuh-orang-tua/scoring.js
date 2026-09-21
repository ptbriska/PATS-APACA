/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KK2: APACA Parenting Style Inventory (APSI)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KK2_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), T-Score, Categorization, dan Data Akses Matriks untuk KK2
   * @param {object} answers - Objek jawaban { questionId: value }
   * @param {object} soalData - Master data dari soal.json (KK2)
   * @param {object} rubrikData - Data deskripsi dari rubrik.json (KK2)
   */
  evaluate(answers, soalData, rubrikData) {
    const rawScores = {
      "Otoritatif": 0,
      "Otoriter": 0,
      "Permisif": 0,
      "Pengabaian": 0
    };

    // 1. Invariance Response Check (Validitas Pengerjaan 40 item)
    const uniqueAnswers = new Set(Object.values(answers));
    if (Object.keys(answers).length >= 40 && uniqueAnswers.size === 1) {
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
      // Formulasi T-Score Standar (Mean RS = 25, SD RS = 5)
      const meanRS = 25;
      const sdRS = 5;
      const tScore = Math.round(50 + 10 * ((rs - meanRS) / sdRS));
      tScores[kategori] = tScore;

      // Persentase Dominansi (Rentang RS 10 - 40)
      const pct = Math.round(((rs - 10) / 30) * 100);
      percentages[kategori] = pct;

      // Matriks Kategori Norma T-Score KK2
      let katNorma = "Sangat Rendah";
      if (tScore >= 65) {
        katNorma = "Sangat Dominan";
      } else if (tScore >= 55) {
        katNorma = "Dominan";
      } else if (tScore >= 45) {
        katNorma = "Sedang";
      } else if (tScore >= 35) {
        katNorma = "Rendah";
      }
      categories[kategori] = katNorma;

      // Format data untuk tabel di result.html
      tableRows.push({
        label: kategori,
        categoryKey: kategori,
        rs: rs,
        ts: tScore,
        percentage: pct,
        category: katNorma
      });
    }

    // 4. Kalkulasi Sumbu Dimensi Matriks Baumrind (Demandingness vs Responsiveness)
    // Tuntutan (Control) = Rata-rata T-Score (Otoritatif + Otoriter) / 2
    // Responsivitas (Support) = Rata-rata T-Score (Otoritatif + Permisif) / 2
    const demandingness = Math.round((tScores["Otoritatif"] + tScores["Otoriter"]) / 2);
    const responsiveness = Math.round((tScores["Otoritatif"] + tScores["Permisif"]) / 2);

    // 5. Menentukan Tipologi Pola Asuh Utama (Dominan)
    let dominantCategory = "Otoritatif";
    let maxT = -1;

    for (const [kategori, tVal] of Object.entries(tScores)) {
      if (tVal > maxT) {
        maxT = tVal;
        dominantCategory = kategori;
      }
    }

    // Ambil narasi deskripsi dari rubrikData (rubrik.json KK2)
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
      narrative: narrative,
      baumrindAxes: {
        demandingness: demandingness,
        responsiveness: responsiveness
      }
    };
  },

  /**
   * Menyusun Payload dan Mengirimkan Hasil Rekap ke Google Sheets via GAS
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const skorMentahStr = Object.entries(evaluationResult.rawScores)
      .map(([kat, val]) => `${kat}: ${val}`)
      .join(", ");

    const standardScoreStr = Object.entries(evaluationResult.tScores)
      .map(([kat, val]) => `T-${kat}: ${val}`)
      .join(", ");

    const now = new Date();
    const formattedTimestamp = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, '0') + "-" +
      String(now.getDate()).padStart(2, '0') + " " +
      String(now.getHours()).padStart(2, '0') + ":" +
      String(now.getMinutes()).padStart(2, '0') + ":" +
      String(now.getSeconds()).padStart(2, '0');

    const payload = {
      timestamp: formattedTimestamp,
      kode_akses: userSession.kode_akses || "-",
      nama_lengkap: userSession.nama_lengkap || "-",
      asal_instansi: userSession.asal_instansi || "Umum",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KK2",
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
      console.log("Sistem Rekap: Data pengerjaan KK2 berhasil terkirim ke Spreadsheet.");
    } catch (error) {
      console.error("Sistem Rekap Error KK2:", error);
    }
  }
};
