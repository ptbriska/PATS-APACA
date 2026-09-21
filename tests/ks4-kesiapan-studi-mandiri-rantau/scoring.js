/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS4: APACA Overseas & Independent Study Readiness Inventory (AOISRI)
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS4_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Adaptability Index Global, Indeks Dimensi, dan Penilaian Kesiapan KS4
   * @param {object} answers - Objek jawaban { questionId: value }
   * @param {object} soalData - Master data dari soal.json (KS4)
   * @param {object} rubrikData - Master data dari rubrik.json (KS4)
   */
  evaluate(answers, soalData, rubrikData) {
    const rawScores = {
      "Independence": 0,
      "Stress Resilience": 0,
      "Openness": 0,
      "Cultural Intelligence": 0,
      "Academic Self-Reg.": 0
    };

    const itemCounts = {
      "Independence": 0,
      "Stress Resilience": 0,
      "Openness": 0,
      "Cultural Intelligence": 0,
      "Academic Self-Reg.": 0
    };

    // 1. Invariance Response Check (Flag: Too Fast / Response Invariance pada 50 item)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 50 && uniqueAnswers.size === 1) {
      return { 
        isInvalid: true, 
        message: "Flag: Too Fast / Careless Response (Jawaban terdeteksi seragam pada seluruh butir soal)." 
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

    // 3. Hitung Indeks per Dimensi (%)
    const dimensionPercentages = {};
    const dimensionLevels = {};
    const dimensionRows = [];
    const dimensionDetails = [];

    const dimRubrik = (rubrikData && rubrikData.rubrik_deskripsi_dimensi) 
      ? rubrikData.rubrik_deskripsi_dimensi 
      : {};

    for (const [kategori, rs] of Object.entries(rawScores)) {
      const count = itemCounts[kategori] || 10;
      const minDimScore = count * 1;
      const maxDimScore = count * 4;
      const range = maxDimScore - minDimScore;

      const dimPct = Math.round(((rs - minDimScore) / range) * 100);
      dimensionPercentages[kategori] = dimPct;

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

      dimensionRows.push({
        dimensi: kategori,
        rs: rs,
        percentage: dimPct,
        level: levelText
      });

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
        dampak_adaptasi: dimAnalisis.dampak_adaptasi || "-",
        rekomendasi_pengembangan: dimAnalisis.rekomendasi_pengembangan || "-"
      });
    }

    // 4. Formula Adaptability Index Global (%)
    // Formula Manual Book KS4: Index (%) = (RStotal - 50) / 150 * 100
    const globalIndex = Math.round(((grandRawScore - 50) / 150) * 100);
    const safeAdaptabilityIndex = Math.max(0, Math.min(100, globalIndex));

    // 5. Norma Kesiapan (>85% Sangat Siap, 70-84% Siap, 55-69% Cukup Siap, 40-54% Kurang Siap, <40% Tidak Disarankan)
    const normaList = (rubrikData && rubrikData.norma_kategorisasi_global) 
      ? rubrikData.norma_kategorisasi_global 
      : [];

    let matchedNorm = {
      kategori: "Siap (Taraf Aman)",
      label_status: "SIAP",
      deskripsi_kondisi: "Memiliki ketangguhan mental yang cukup untuk survive di rantau.",
      implikasi_pemberangkatan: "Dapat diberangkatkan dengan aman.",
      tindakan_lanjutan: "Penyusunan rencana penyesuaian mandiri."
    };

    if (safeAdaptabilityIndex > 85) {
      matchedNorm = normaList.find(n => n.rentang_skor_persen === "> 85%") || matchedNorm;
    } else if (safeAdaptabilityIndex >= 70) {
      matchedNorm = normaList.find(n => n.rentang_skor_persen === "70% - 84%") || matchedNorm;
    } else if (safeAdaptabilityIndex >= 55) {
      matchedNorm = normaList.find(n => n.rentang_skor_persen === "55% - 69%") || matchedNorm;
    } else if (safeAdaptabilityIndex >= 40) {
      matchedNorm = normaList.find(n => n.rentang_skor_persen === "40% - 54%") || matchedNorm;
    } else {
      matchedNorm = normaList.find(n => n.rentang_skor_persen === "< 40%") || matchedNorm;
    }

    // Critical Flag Triggered jika Adaptability Index < 55%
    const isCritical = safeAdaptabilityIndex < 55;

    return {
      isInvalid: false,
      grandRawScore: grandRawScore,
      adaptabilityIndex: safeAdaptabilityIndex,
      matchedNorm: matchedNorm,
      isCritical: isCritical,
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

    const skorMentahStr = Object.entries(evaluationResult.rawScores)
      .map(([kat, val]) => `${kat}: ${val}`)
      .join(", ");

    const indeksDimensiStr = Object.entries(evaluationResult.dimensionPercentages)
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
      asal_instansi: userSession.asal_instansi || "Khusus",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KS4",
      skor_mentah: `RS Total: ${evaluationResult.grandRawScore} | (${skorMentahStr})`,
      standard_score: `Adaptability Index: ${evaluationResult.adaptabilityIndex}% | (${indeksDimensiStr})`,
      kategori_hasil: `${evaluationResult.matchedNorm.kategori} ${evaluationResult.isCritical ? '[CRITICAL FLAG]' : ''}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap: Data KS4 (AOISRI) berhasil terkirim ke Spreadsheet.");
    } catch (error) {
      console.error("Sistem Rekap Error KS4:", error);
    }
  }
};
