/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KU9: APACA Work Decision-Making & Judgment Test (WDJT)
   Modul Penilaian 20 Skenario SJT Best-Worst Response Format (CDS & DCI %)
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KU9_Scoring = {
  /**
   * Evaluasi Jawaban KU9:
   * 1. Mengkalkulasi Skor Skenario (S_i = W_Best - W_Worst)
   * 2. Akumulasi Skor Mentah (RS_total) dan per Dimensi
   * 3. Kalkulasi Decision Concordance Index (DCI %) Global & Dimensi
   * 4. Penentuan Kategori DCI dari rubrik.json
   */
  evaluate(answers, soalData, rubrikData) {
    if (!soalData || !soalData.questions) {
      return { isInvalid: true, message: "Data soal KU9 tidak ditemukan." };
    }

    const dimRawScores = {
      Kualitas_Decision_Making: 0,
      Delegasi_Efektif: 0,
      Skala_Prioritas: 0,
      Penanganan_Krisis: 0
    };

    // Peta Maksimum & Minimum Skor untuk Konversi DCI % (5 Skenario per Dimensi, RS_max = 20, RS_min = -20)
    const MAX_DIM_RS = 20.0;
    const MIN_DIM_RS = -20.0;
    const MAX_GLOBAL_RS = 80.0;
    const MIN_GLOBAL_RS = -80.0;

    const questionMap = new Map(soalData.questions.map(q => [q.id, q]));
    let answeredCount = 0;
    let exactBestMatches = 0;

    // Iterasi 20 Skenario SJT
    for (let i = 1; i <= 20; i++) {
      const qObj = questionMap.get(i);
      const userAns = answers[i] || answers[`${i}`];

      if (userAns && userAns.best && userAns.worst && qObj && qObj.options) {
        // Validasi: Best dan Worst tidak boleh opsi yang sama
        if (userAns.best === userAns.worst) {
          return {
            isInvalid: true,
            message: `Flag: INVALID RESPONSE PROTOCOL pada Skenario ${i} (Opsi Best dan Worst tidak boleh memilih jawaban yang sama).`
          };
        }

        const optBest = qObj.options.find(o => o.code === userAns.best);
        const optWorst = qObj.options.find(o => o.code === userAns.worst);

        if (optBest && optWorst) {
          const wBest = optBest.weight || 0;
          const wWorst = optWorst.weight || 0;

          // Formula S_i = W_Best - W_Worst
          const scenarioScore = wBest - wWorst;

          // Cek apakah Best Match sempurna (+2.00)
          if (wBest === 2.00) {
            exactBestMatches++;
          }

          // Petakan ID ke Dimensi
          let dimKey = "Kualitas_Decision_Making";
          if ([1, 5, 9, 13, 17].includes(i)) dimKey = "Kualitas_Decision_Making";
          else if ([2, 6, 10, 14, 18].includes(i)) dimKey = "Delegasi_Efektif";
          else if ([3, 7, 11, 15, 19].includes(i)) dimKey = "Skala_Prioritas";
          else if ([4, 8, 12, 16, 20].includes(i)) dimKey = "Penanganan_Krisis";

          dimRawScores[dimKey] += scenarioScore;
          answeredCount++;
        }
      }
    }

    // Validasi Pengerjaan Lengkap
    if (answeredCount < 20) {
      return {
        isInvalid: true,
        message: `Pengerjaan belum lengkap (${answeredCount}/20 skenario terisi lengkap Best & Worst). Silakan periksa kembali.`
      };
    }

    // Total Skor Mentah Kumulatif
    const totalRawScore = Object.values(dimRawScores).reduce((a, b) => a + b, 0);

    // Formula DCI Global (%)
    const globalDCI = Math.round(((totalRawScore - MIN_GLOBAL_RS) / (MAX_GLOBAL_RS - MIN_GLOBAL_RS)) * 100);

    // Formula DCI per Dimensi (%)
    const dimDCI = {};
    Object.keys(dimRawScores).forEach(key => {
      dimDCI[key] = Math.round(((dimRawScores[key] - MIN_DIM_RS) / (MAX_DIM_RS - MIN_DIM_RS)) * 100);
    });

    // Penentuan Kategori Norma Global
    let globalCategory = "Sedang (Moderate)";
    let globalRec = "Pengambilan keputusan cukup memadai pada situasi rutin.";

    if (globalDCI >= 86) {
      globalCategory = "Sangat Tinggi (Superior Judgment)";
      globalRec = "SANGAT DIREKOMENDASIKAN untuk posisi Manajer Senior, Direktur, atau Pemimpin Krisis Utama.";
    } else if (globalDCI >= 71) {
      globalCategory = "Tinggi (Proficient)";
      globalRec = "DIREKOMENDASIKAN untuk promosi jabatan Manajer/Supervisor.";
    } else if (globalDCI >= 51) {
      globalCategory = "Sedang (Moderate / Developing)";
      globalRec = "DIREKOMENDASIKAN DENGAN CATATAN; perlu pendampingan mentor pada keputusan strategis berisiko tinggi.";
    } else if (globalDCI >= 36) {
      globalCategory = "Rendah (Impaired Judgment)";
      globalRec = "BELUM DIREKOMENDASIKAN untuk posisi pimpinan tim; membutuhkan pelatihan Executive Function.";
    } else {
      globalCategory = "Sangat Rendah (High Risk)";
      globalRec = "TIDAK DIREKOMENDASIKAN; keputusan yang diambil berpotensi menimbulkan kerugian operasional.";
    }

    // Pembantu Ambil Detail Kategori Dimensi dari rubrik.json
    const getDimCategoryDetail = (dimKey, dciVal) => {
      const dimRubrik = (rubrikData && rubrikData.dimensi_utama && rubrikData.dimensi_utama[dimKey])
        ? rubrikData.dimensi_utama[dimKey].kategori_skor
        : null;

      if (!dimRubrik) return { kategori: "Moderate", deskripsi_perilaku: "-", saran_pengembangan: "-" };

      if (dciVal >= 86) return dimRubrik.Sangat_Tinggi;
      if (dciVal >= 71) return dimRubrik.Tinggi;
      if (dciVal >= 51) return dimRubrik.Sedang;
      if (dciVal >= 36) return dimRubrik.Rendah;
      return dimRubrik.Sangat_Rendah;
    };

    const dimDetails = {};
    Object.keys(dimDCI).forEach(key => {
      dimDetails[key] = getDimCategoryDetail(key, dimDCI[key]);
    });

    const matchRatePct = Math.round((exactBestMatches / 20) * 100);

    return {
      isInvalid: false,
      totalRawScore: totalRawScore.toFixed(2),
      globalDCI: globalDCI,
      globalCategory: globalCategory,
      globalRec: globalRec,
      matchRatePct: matchRatePct,
      dimRawScores: dimRawScores,
      dimDCI: dimDCI,
      dimDetails: dimDetails
    };
  },

  /**
   * Mengirimkan Hasil Rekap KU9 ke Google Apps Script (GAS)
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const dci = evaluationResult.dimDCI;
    const scoreStr = `QDM:${dci.Kualitas_Decision_Making}%, DELE:${dci.Delegasi_Efektif}%, PRIO:${dci.Skala_Prioritas}%, CRIS:${dci.Penanganan_Krisis}%`;

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
      kode_modul: "KU9",
      skor_mentah: `DCI: ${evaluationResult.globalDCI}% (RS: ${evaluationResult.totalRawScore})`,
      standard_score: `${scoreStr} | MatchRate:${evaluationResult.matchRatePct}%`,
      kategori_hasil: `Kategori: ${evaluationResult.globalCategory}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KU9: Data WDJT berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KU9:", error);
    }
  }
};
