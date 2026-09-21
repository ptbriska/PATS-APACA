/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS12: APACA Learning Cognitive Process Inventory (LCPI)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS12_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Indeks Persentase Dimensi (Pdim), Cognitive Processing Index (CPI),
   * Kategorisasi Norma, Deteksi Cognitive Bottleneck, dan Rekomendasi Beban Kognitif.
   */
  evaluate(answers, soalData, rubrikData) {
    // 1. Invariance Response Check (Pengerjaan 108 item)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 108 && uniqueAnswers.size === 1) {
      return {
        isInvalid: true,
        message: "Flag: INVALID - INATTENTIVE RESPONDING (Jawaban terdeteksi seragam pada seluruh 108 butir soal)."
      };
    }

    const mainDimensions = [
      "Attention",
      "Encoding",
      "Working Memory",
      "Comprehension",
      "Elaboration",
      "Reasoning",
      "Critical Thinking",
      "Transfer",
      "Creativity"
    ];

    const rawScores = {};
    const itemCounts = {};

    mainDimensions.forEach(dim => {
      rawScores[dim] = 0;
      itemCounts[dim] = 0;
    });

    // 2. Akumulasi Skor Mentah Per Dimensi (12 Item per Dimensi, Likert 1..4)
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const val = Number(answers[q.id]) || 1;
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

      let levelText = "Terbatas (0% - 40%)";
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
        operasi_mental: dimAnalisis.operasi_mental || "-",
        dampak_akademik: dimAnalisis.dampak_akademik || "-",
        mitigasi_kognitif: dimAnalisis.mitigasi_kognitif || "-"
      });
    });

    // 4. Hitung Cognitive Processing Index (CPI) Global
    const cpiIndex = Math.round(totalPercentageSum / mainDimensions.length);

    // 5. Norma & Kategorisasi Global CPI
    const globalNorms = (rubrikData && rubrikData.norma_kategorisasi_global) 
      ? rubrikData.norma_kategorisasi_global 
      : [];

    let matchedNorm = {
      kategori: "Moderat (Developing)",
      label_status: "BERKEMBANG",
      deskripsi_kondisi: "Cukup mampu memproses materi pelajaran standar. Namun, operasi kognitif mengalami perlambatan pada materi abstrak.",
      dampak_akademik: "Hasil belajar sangat bergantung pada pola penyajian materi dari guru.",
      tindakan_lanjutan: "Gunakan teknik pemecahan materi (chunking) dan alat bantu representasi visual."
    };

    if (cpiIndex >= 81) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "81% - 100%") || matchedNorm;
    } else if (cpiIndex >= 61) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "61% - 80%") || matchedNorm;
    } else if (cpiIndex >= 41) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "41% - 60%") || matchedNorm;
    } else if (cpiIndex >= 21) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "21% - 40%") || matchedNorm;
    } else {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "0% - 20%") || matchedNorm;
    }

    // 6. Deteksi Matriks Cognitive Bottleneck
    const bottleneckList = (rubrikData && rubrikData.analisis_cognitive_bottleneck) 
      ? rubrikData.analisis_cognitive_bottleneck 
      : [];
    const detectedBottlenecks = [];

    const attPct = dimensionPercentages["Attention"] || 0;
    const encPct = dimensionPercentages["Encoding"] || 0;
    const wmPct = dimensionPercentages["Working Memory"] || 0;
    const compPct = dimensionPercentages["Comprehension"] || 0;
    const reasPct = dimensionPercentages["Reasoning"] || 0;
    const critPct = dimensionPercentages["Critical Thinking"] || 0;
    const transPct = dimensionPercentages["Transfer"] || 0;

    // Pola 1: Working Memory Overload
    if ((compPct >= 65 || reasPct >= 65) && wmPct <= 40) {
      const item = bottleneckList.find(b => b.nama_pola.includes("Working Memory Overload"));
      if (item) detectedBottlenecks.push(item);
    }
    // Pola 2: Encoding Deficit with High Attention
    if (attPct >= 65 && encPct <= 40) {
      const item = bottleneckList.find(b => b.nama_pola.includes("Encoding Deficit"));
      if (item) detectedBottlenecks.push(item);
    }
    // Pola 3: Low Transfer Agility
    if (compPct >= 65 && transPct <= 40) {
      const item = bottleneckList.find(b => b.nama_pola.includes("Low Transfer"));
      if (item) detectedBottlenecks.push(item);
    }
    // Pola 4: Critical Thinking Disconnect
    if (reasPct >= 65 && critPct <= 40) {
      const item = bottleneckList.find(b => b.nama_pola.includes("Critical Thinking Disconnect"));
      if (item) detectedBottlenecks.push(item);
    }

    return {
      isInvalid: false,
      cpiIndex: cpiIndex,
      globalNorm: matchedNorm,
      rawScores: rawScores,
      dimensionPercentages: dimensionPercentages,
      dimensionLevels: dimensionLevels,
      dimensionRows: dimensionRows,
      detectedBottlenecks: detectedBottlenecks
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
      kode_modul: "KS12",
      skor_mentah: `CPI: ${evaluationResult.cpiIndex}%`,
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
      console.log("Sistem Rekap KS12: Data pengerjaan LCPI berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS12:", error);
    }
  }
};
