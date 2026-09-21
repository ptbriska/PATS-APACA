/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS11: APACA Learning Strategy Inventory (LSI)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS11_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Indeks Persentase Dimensi (Pdim), Indeks Global SRLI,
   * Kategorisasi, Deteksi Matriks Bottleneck, dan Protokol Coaching Eksekutif.
   */
  evaluate(answers, soalData, rubrikData) {
    // 1. Validation Check (Invariance & Rapid Responding)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 96 && uniqueAnswers.size === 1) {
      return {
        isInvalid: true,
        message: "Flag: INVALID - CARELESS RESPONDING (Jawaban terdeteksi seragam pada seluruh 96 butir soal)."
      };
    }

    const mainDimensions = [
      "Goal Setting",
      "Planning",
      "Execution",
      "Monitoring",
      "Evaluation",
      "Adaptation",
      "Resource Management",
      "Help-Seeking"
    ];

    const rawScores = {};
    const itemCounts = {};

    mainDimensions.forEach(dim => {
      rawScores[dim] = 0;
      itemCounts[dim] = 0;
    });

    // 2. Akumulasi Skor Mentah
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const val = Number(answers[q.id]) || 1; // Likert 1..4 (STS=1, TS=2, S=3, SS=4)
        const dimKey = q.dimensi;

        if (rawScores[dimKey] !== undefined) {
          rawScores[dimKey] += val;
          itemCounts[dimKey] += 1;
        }
      });
    }

    // 3. Kalkulasi Persentase Dimensi Pdim = (RS - 12) / 36 * 100
    const dimensionPercentages = {};
    const dimensionLevels = {};
    const dimensionRows = [];
    let totalPercentageSum = 0;

    const dimRubrik = (rubrikData && rubrikData.rubrik_dimensi) ? rubrikData.rubrik_dimensi : {};

    mainDimensions.forEach(dimKey => {
      const rs = rawScores[dimKey] || 12;
      const count = itemCounts[dimKey] || 12;
      const minScore = count * 1;
      const maxScore = count * 4;
      const range = maxScore - minScore;

      const pct = range > 0 ? Math.round(((rs - minScore) / range) * 100) : 0;
      const safePct = Math.max(0, Math.min(100, pct));
      
      dimensionPercentages[dimKey] = safePct;
      totalPercentageSum += safePct;

      let levelText = "Rendah (0% - 40%)";
      if (safePct >= 61) {
        levelText = "Tinggi (61% - 100%)";
      } else if (safePct >= 41) {
        levelText = "Sedang (41% - 60%)";
      }
      dimensionLevels[dimKey] = levelText;

      const dimInfo = dimRubrik[dimKey] || {};
      const dimAnalisis = (dimInfo.analisis_tingkat_skor && dimInfo.analisis_tingkat_skor[levelText])
        ? dimInfo.analisis_tingkat_skor[levelText]
        : {};

      dimensionRows.push({
        dimensi: dimKey,
        judul_dimensi: dimInfo.judul_dimensi || dimKey,
        rs: rs,
        percentage: safePct,
        level: levelText,
        kondisi: dimAnalisis.kondisi || "-",
        karakteristik: dimAnalisis.karakteristik || "-",
        dampak_akademik: dimAnalisis.dampak_akademik || "-",
        rekomendasi_taktis: dimAnalisis.rekomendasi_taktis || "-"
      });
    });

    // 4. Hitung Indeks Global SRL (SRLI)
    const srliIndex = Math.round(totalPercentageSum / mainDimensions.length);

    // 5. Normalisasi & Kategorisasi Global SRLI
    const globalNorms = (rubrikData && rubrikData.norma_kategorisasi_global) 
      ? rubrikData.norma_kategorisasi_global 
      : [];

    let matchedNorm = {
      kategori: "Moderat (Developing SRL)",
      label_status: "BERKEMBANG",
      deskripsi_kondisi: "Kapasitas regulasi belajar cukup berkembang, namun penerapannya masih sering inkonsisten.",
      dampak_akademik: "Hasil akademik cenderung berfluktuasi naik-turun.",
      tindakan_lanjutan: "Perlu pendampingan khusus pada fase eksekusi dan penyederhanaan jadwal harian."
    };

    if (srliIndex >= 81) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "81% - 100%") || matchedNorm;
    } else if (srliIndex >= 61) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "61% - 80%") || matchedNorm;
    } else if (srliIndex >= 41) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "41% - 60%") || matchedNorm;
    } else if (srliIndex >= 21) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "21% - 40%") || matchedNorm;
    } else {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "0% - 20%") || matchedNorm;
    }

    // 6. Matriks Identifikasi Bottleneck (Titik Kebocoran Siklus SRL)
    const bottleneckList = (rubrikData && rubrikData.matriks_pola_bottleneck) ? rubrikData.matriks_pola_bottleneck : [];
    const detectedBottlenecks = [];

    const planPct = dimensionPercentages["Planning"] || 0;
    const execPct = dimensionPercentages["Execution"] || 0;
    const goalPct = dimensionPercentages["Goal Setting"] || 0;
    const adaptPct = dimensionPercentages["Adaptation"] || 0;
    const helpPct = dimensionPercentages["Help-Seeking"] || 0;
    const monPct = dimensionPercentages["Monitoring"] || 0;
    const evalPct = dimensionPercentages["Evaluation"] || 0;

    // Pola 1: The Planner without Execution
    if (planPct >= 65 && execPct <= 45) {
      const item = bottleneckList.find(b => b.nama_pola.includes("Planner"));
      if (item) detectedBottlenecks.push(item);
    }
    // Pola 2: The Busy Doer without Direction
    if (execPct >= 65 && (goalPct <= 45 || planPct <= 45)) {
      const item = bottleneckList.find(b => b.nama_pola.includes("Busy Doer"));
      if (item) detectedBottlenecks.push(item);
    }
    // Pola 3: The Rigid Executor
    if (execPct >= 65 && adaptPct <= 45) {
      const item = bottleneckList.find(b => b.nama_pola.includes("Rigid Executor"));
      if (item) detectedBottlenecks.push(item);
    }
    // Pola 4: The Isolated Struggler
    if (helpPct <= 40 && (monPct <= 45 || evalPct <= 45)) {
      const item = bottleneckList.find(b => b.nama_pola.includes("Isolated Struggler"));
      if (item) detectedBottlenecks.push(item);
    }

    // 7. Evaluasi Protokol Coaching Eksekutif
    const needExecutionCoaching = execPct < 45;
    const needMonitoringCoaching = monPct < 45;

    return {
      isInvalid: false,
      srliIndex: srliIndex,
      globalNorm: matchedNorm,
      rawScores: rawScores,
      dimensionPercentages: dimensionPercentages,
      dimensionLevels: dimensionLevels,
      dimensionRows: dimensionRows,
      detectedBottlenecks: detectedBottlenecks,
      coachingFlags: {
        needExecutionCoaching,
        needMonitoringCoaching,
        execPct,
        monPct
      }
    };
  },

  /**
   * Menyusun Payload dan Mengirimkan Hasil Rekap ke Google Sheets via GAS
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const dimStr = Object.entries(evaluationResult.dimensionPercentages)
      .map(([d, p]) => `${d}: ${p}%`)
      .join(" | ");

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
      asal_instansi: userSession.asal_instansi || "Sekolah / Perguruan Tinggi",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KS11",
      skor_mentah: `SRLI: ${evaluationResult.srliIndex}%`,
      standard_score: dimStr,
      kategori_hasil: `${evaluationResult.globalNorm.kategori} ${evaluationResult.detectedBottlenecks.length > 0 ? '[BOTTLENECK DETECTED]' : ''}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KS11: Data pengerjaan LSI berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS11:", error);
    }
  }
};
