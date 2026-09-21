/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KD6: APACA Work Burnout & Stress Indication Test (WBSIT)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KD6_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Indeks Stres per Dimensi, Indeks Stres Global, Kategorisasi, dan Red Flag
   * @param {object} answers - Objek jawaban { questionId: value }
   * @param {object} soalData - Master data dari soal.json (KD6)
   * @param {object} rubrikData - Master data dari rubrik.json (KD6)
   */
  evaluate(answers, soalData, rubrikData) {
    const rawScores = {
      "Work Anxiety": 0,
      "Emotional Exhaustion": 0,
      "Depersonalization / Cynicism": 0,
      "Workplace Pressure Source": 0
    };

    const itemCounts = {
      "Work Anxiety": 0,
      "Emotional Exhaustion": 0,
      "Depersonalization / Cynicism": 0,
      "Workplace Pressure Source": 0
    };

    // 1. Invariance Response Check (Pengerjaan < 2 menit atau jawaban seragam pada 40 item)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 40 && uniqueAnswers.size === 1) {
      return { 
        isInvalid: true, 
        message: "Flag: Potential Careless Responding (Jawaban terdeteksi seragam pada seluruh butir soal)." 
      };
    }

    // 2. Kalkulasi Skor Mentah (RS) dengan Bobot Favorable & Unfavorable
    // Favorable: STS=1, TS=2, S=3, SS=4
    // Unfavorable: STS=4, TS=3, S=2, SS=1
    let grandRawScore = 0;

    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const ansVal = Number(answers[q.id]) || 1;
        let finalItemScore = ansVal;

        if (q.type === "Unfavorable") {
          finalItemScore = 5 - ansVal;
        }

        if (rawScores[q.kategori] !== undefined) {
          rawScores[q.kategori] += finalItemScore;
          itemCounts[q.kategori] += 1;
          grandRawScore += finalItemScore;
        }
      });
    }

    // 3. Hitung Indeks Stres Dimensi (%) & Tentukan Level Risiko per Dimensi
    const dimensionPercentages = {};
    const dimensionLevels = {};
    const dimensionRows = [];
    const dimensionDetails = [];

    const dimRubrik = (rubrikData && rubrikData.rubrik_deskripsi_dimensi) 
      ? rubrikData.rubrik_deskripsi_dimensi 
      : {};

    for (const [kategori, rs] of Object.entries(rawScores)) {
      // Rentang skor per dimensi (10 item: min=10, max=40 -> rentang=30)
      const count = itemCounts[kategori] || 10;
      const minDimScore = count * 1;
      const maxDimScore = count * 4;
      const range = maxDimScore - minDimScore;

      const dimPct = Math.round(((rs - minDimScore) / range) * 100);
      dimensionPercentages[kategori] = dimPct;

      // Kategorisasi Risiko Dimensi
      let levelText = "Rendah";
      let levelKey = "Rendah (0% - 35%)";
      if (dimPct >= 66) {
        levelText = "Tinggi";
        levelKey = "Tinggi (66% - 100%)";
      } else if (dimPct >= 36) {
        levelText = "Sedang";
        levelKey = "Sedang (36% - 65%)";
      }
      dimensionLevels[kategori] = levelText;

      // Baris tabel ringkasan
      dimensionRows.push({
        dimensi: kategori,
        rs: rs,
        percentage: dimPct,
        level: levelText
      });

      // Rincian narasi dimensi dari rubrik.json
      const dimInfo = dimRubrik[kategori] || {};
      const dimAnalisis = (dimInfo.analisis_tingkat_skor && dimInfo.analisis_tingkat_skor[levelKey])
        ? dimInfo.analisis_tingkat_skor[levelKey]
        : {};

      dimensionDetails.push({
        kategori: kategori,
        judul_dimensi: dimInfo.judul_dimensi || kategori,
        percentage: dimPct,
        level: levelText,
        kondisi: dimAnalisis.kondisi || "-",
        deskripsi_spesifik: dimAnalisis.deskripsi_spesifik || "-",
        dampak_organisasional: dimAnalisis.dampak_organisasional || "-",
        rekomendasi_pengembangan: dimAnalisis.rekomendasi_pengembangan || "-"
      });
    }

    // 4. Hitung Indeks Stres Kerja Global (%)
    // Formula Manual Book KD6: Indeks (%) = (RStotal - 40) / 120 * 100
    const globalIndex = Math.round(((grandRawScore - 40) / 120) * 100);
    const safeGlobalIndex = Math.max(0, Math.min(100, globalIndex));

    // 5. Norma & Kategorisasi Global (0-25% Normal, 26-50% Stres Ringan, 51-75% Stres Sedang, 76-100% Stres Berat)
    const normaList = (rubrikData && rubrikData.norma_kategorisasi_global) 
      ? rubrikData.norma_kategorisasi_global 
      : [];

    let matchedNorm = {
      kategori: "Normal (Resiliensi Tinggi)",
      label_status: "OPTIMAL",
      deskripsi_kondisi: "Kondisi kesehatan mental kerja berada dalam taraf optimal.",
      implikasi_klinis_organisasi: "Risiko burnout sangat rendah.",
      tindakan_lanjutan: "Pencegahan rutin melalui pemeliharaan keseimbangan kerja."
    };

    if (safeGlobalIndex >= 76) {
      matchedNorm = normaList.find(n => n.rentang_skor_persen === "76% - 100%") || matchedNorm;
    } else if (safeGlobalIndex >= 51) {
      matchedNorm = normaList.find(n => n.rentang_skor_persen === "51% - 75%") || matchedNorm;
    } else if (safeGlobalIndex >= 26) {
      matchedNorm = normaList.find(n => n.rentang_skor_persen === "26% - 50%") || matchedNorm;
    } else {
      matchedNorm = normaList.find(n => n.rentang_skor_persen === "0% - 25%") || matchedNorm;
    }

    // Protokol Red Flag jika Indeks Global > 75%
    const isRedFlag = safeGlobalIndex >= 76;

    return {
      isInvalid: false,
      grandRawScore: grandRawScore,
      globalIndex: safeGlobalIndex,
      globalNorm: matchedNorm,
      isRedFlag: isRedFlag,
      rawScores: rawScores,
      dimensionPercentages: dimensionPercentages,
      dimensionLevels: dimensionLevels,
      dimensionRows: dimensionRows,
      dimensionDetails: dimensionDetails
    };
  },

  /**
   * Menyusun Payload dan Mengirimkan Hasil Rekap ke Google Sheets via GAS
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    // Formatting string skor mentah & indeks per dimensi
    const skorMentahStr = Object.entries(evaluationResult.rawScores)
      .map(([kat, val]) => `${kat}: ${val}`)
      .join(", ");

    const indeksDimensiStr = Object.entries(evaluationResult.dimensionPercentages)
      .map(([kat, val]) => `${kat}: ${val}%`)
      .join(", ");

    // Format timestamp lokal (YYYY-MM-DD HH:mm:ss)
    const now = new Date();
    const formattedTimestamp = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, '0') + "-" +
      String(now.getDate()).padStart(2, '0') + " " +
      String(now.getHours()).padStart(2, '0') + ":" +
      String(now.getMinutes()).padStart(2, '0') + ":" +
      String(now.getSeconds()).padStart(2, '0');

    // Payload Standar Rekap (FORMAT_A) untuk KD6
    const payload = {
      timestamp: formattedTimestamp,
      kode_akses: userSession.kode_akses || "-",
      nama_lengkap: userSession.nama_lengkap || "-",
      asal_instansi: userSession.asal_instansi || "Khusus",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KD6",
      skor_mentah: `RS Total: ${evaluationResult.grandRawScore} | (${skorMentahStr})`,
      standard_score: `Indeks Global: ${evaluationResult.globalIndex}% | (${indeksDimensiStr})`,
      kategori_hasil: `${evaluationResult.globalNorm.kategori} ${evaluationResult.isRedFlag ? '[RED FLAG]' : ''}`,
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
      console.log("Sistem Rekap: Data pengerjaan KD6 (WBSIT) berhasil terkirim ke Spreadsheet.");
    } catch (error) {
      console.error("Sistem Rekap Error KD6:", error);
    }
  }
};
