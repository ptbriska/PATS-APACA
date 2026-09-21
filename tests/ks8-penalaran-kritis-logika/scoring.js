/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS8: APACA Work Critical Thinking Test (WCTL)
   Modul Penilaian Kognitif Objektif & Automated Corporate Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS8_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Critical Thinking Index (CTI %), T-Score,
   * Performa 5 Sub-Kompetensi, dan Kelayakan Cut-Off Jabatan
   * @param {object} answers - Objek jawaban { questionId: selectedValue }
   * @param {object} soalData - Master data dari soal.json (KS8)
   * @param {object} rubrikData - Master data dari rubrik.json (KS8)
   */
  evaluate(answers, soalData, rubrikData) {
    const rawScores = {
      "Inference": 0,
      "Recognition of Assumptions": 0,
      "Deduction": 0,
      "Interpretation": 0,
      "Evaluation of Arguments": 0
    };

    const itemCounts = {
      "Inference": 0,
      "Recognition of Assumptions": 0,
      "Deduction": 0,
      "Interpretation": 0,
      "Evaluation of Arguments": 0
    };

    let grandRawScore = 0;
    const totalQuestions = (soalData && soalData.questions) ? soalData.questions.length : 50;

    // 1. Skoring Dikotomus (Benar = 1, Salah = 0)
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const userAns = Number(answers[q.id]);
        const keyAns = Number(q.kunci_jawaban);
        const isCorrect = userAns === keyAns;

        if (rawScores[q.kategori] !== undefined) {
          itemCounts[q.kategori] += 1;
          if (isCorrect) {
            rawScores[q.kategori] += 1;
            grandRawScore += 1;
          }
        }
      });
    }

    // 2. Hitung Critical Thinking Index (CTI %) & Standard T-Score
    // Formula CTI (%) = (Grand RS / 50) * 100
    const cti = Math.round((grandRawScore / totalQuestions) * 100);
    const safeCTI = Math.max(0, Math.min(100, cti));

    // Formula T-Score Norma Populasi (Mean RS = 30, SD RS = 7)
    // T = 50 + 10 * ((RS - 30) / 7)
    const tScore = Math.round(50 + 10 * ((grandRawScore - 30) / 7));

    // 3. Kalkulasi Performa per Dimensi Sub-Tes (10 item per dimensi)
    const dimensionRows = [];
    const dimensionDetails = [];
    const dimensionScoresMap = {};
    const dimRubrik = (rubrikData && rubrikData.rubrik_deskripsi_dimensi) ? rubrikData.rubrik_deskripsi_dimensi : {};

    for (const [kategori, rs] of Object.entries(rawScores)) {
      const totalDimItems = itemCounts[kategori] || 10;
      const accuracyPct = Math.round((rs / totalDimItems) * 100);
      dimensionScoresMap[kategori] = accuracyPct;

      let dimLevel = "Sangat Rendah";
      if (accuracyPct >= 80) dimLevel = "Sangat Tinggi";
      else if (accuracyPct >= 70) dimLevel = "Tinggi";
      else if (accuracyPct >= 55) dimLevel = "Sedang";
      else if (accuracyPct >= 40) dimLevel = "Rendah";

      dimensionRows.push({
        dimensi: kategori,
        rs: rs,
        totalItems: totalDimItems,
        accuracy: accuracyPct,
        level: dimLevel
      });

      const dimInfo = dimRubrik[kategori] || {};
      dimensionDetails.push({
        kategori: kategori,
        judul_dimensi: dimInfo.judul_dimensi || kategori,
        rs: rs,
        accuracy: accuracyPct,
        level: dimLevel,
        deskripsi_umum: dimInfo.deskripsi_umum || "-",
        dampak_profesional: dimInfo.dampak_profesional || "-",
        rekomendasi_pengembangan: dimInfo.rekomendasi_pengembangan || "-"
      });
    }

    // 4. Pencocokan Norma & Kategorisasi Global CTI
    const normaList = (rubrikData && rubrikData.norma_kategorisasi_global) ? rubrikData.norma_kategorisasi_global : [];
    let matchedNorm = {
      kategori_kognitif: "Sedang (Average)",
      label_status: "OPERATIONAL SPECIALIST FIT",
      deskripsi_profil: "Mampu melakukan penalaran logis standar dan mengikuti SOP dengan akurat.",
      rekomendasi_rekrutmen: "DIPERTIMBANGKAN DENGAN CATATAN (CONDITIONAL)."
    };

    if (safeCTI >= 86) {
      matchedNorm = normaList.find(n => n.rentang_cti === "86% - 100%") || matchedNorm;
    } else if (safeCTI >= 72) {
      matchedNorm = normaList.find(n => n.rentang_cti === "72% - 85%") || matchedNorm;
    } else if (safeCTI >= 56) {
      matchedNorm = normaList.find(n => n.rentang_cti === "56% - 71%") || matchedNorm;
    } else if (safeCTI >= 40) {
      matchedNorm = normaList.find(n => n.rentang_cti === "40% - 55%") || matchedNorm;
    } else {
      matchedNorm = normaList.find(n => n.rentang_cti === "0% - 39%") || matchedNorm;
    }

    // 5. Penilaian Kelayakan Cut-Off Jabatan Organisasi
    const isManagerialFit = safeCTI >= 72;
    const isOperationalFit = safeCTI >= 56;

    return {
      isInvalid: false,
      grandRawScore: grandRawScore,
      totalQuestions: totalQuestions,
      cti: safeCTI,
      tScore: tScore,
      globalNorm: matchedNorm,
      isManagerialFit: isManagerialFit,
      isOperationalFit: isOperationalFit,
      rawScores: rawScores,
      dimensionScoresMap: dimensionScoresMap,
      dimensionRows: dimensionRows,
      dimensionDetails: dimensionDetails
    };
  },

  /**
   * Menyusun Payload dan Mengirimkan Hasil Rekap ke Google Sheets via GAS
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const skorMentahStr = Object.entries(evaluationResult.rawScores)
      .map(([kat, val]) => `${kat}: ${val}/10`)
      .join(", ");

    const akurasiDimensiStr = Object.entries(evaluationResult.dimensionScoresMap)
      .map(([kat, val]) => `${kat}: ${val}%`)
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
      asal_instansi: userSession.asal_instansi || "Perusahaan Korporat",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KS8",
      skor_mentah: `RS Total: ${evaluationResult.grandRawScore}/50 | (${skorMentahStr})`,
      standard_score: `CTI: ${evaluationResult.cti}% | T-Score: ${evaluationResult.tScore} | (${akurasiDimensiStr})`,
      kategori_hasil: `${evaluationResult.globalNorm.label_status} - ${evaluationResult.globalNorm.kategori_kognitif}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KS8: Data pengerjaan WCTL berhasil terkirim ke Spreadsheet.");
    } catch (error) {
      console.error("Sistem Rekap Error KS8:", error);
    }
  }
};
