/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS10: APACA Learning Technique Inventory (LTE)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS10_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Persentase Indeks Efektivitas (Psub),
   * Categorization, Chart Data, Top 5 & Bottom 3 Techniques, dan Protokol Coaching.
   */
  evaluate(answers, soalData, rubrikData) {
    // 1. Validation Check (Careless / Rapid Responding)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 120 && uniqueAnswers.size === 1) {
      return {
        isInvalid: true,
        message: "Flag: INVALID - CARELESS RESPONDING (Jawaban terdeteksi seragam pada seluruh 120 butir soal)."
      };
    }

    const dimScores = {};
    const dimCounts = {};
    const subScores = {};
    const subCounts = {};

    // 2. Akumulasi Skor Mentah
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const val = Number(answers[q.id]) || 1; // Likert 1..4 (TP=1, J=2, S=3, SS=4)

        // Akumulasi per Dimensi Utama
        if (!dimScores[q.dimensi]) {
          dimScores[q.dimensi] = 0;
          dimCounts[q.dimensi] = 0;
        }
        dimScores[q.dimensi] += val;
        dimCounts[q.dimensi] += 1;

        // Akumulasi per Sub-Dimensi
        if (!subScores[q.sub_dimensi]) {
          subScores[q.sub_dimensi] = 0;
          subCounts[q.sub_dimensi] = 0;
        }
        subScores[q.sub_dimensi] += val;
        subCounts[q.sub_dimensi] += 1;
      });
    }

    // Fungsi Pembantu Konversi Skor ke Persentase & Kategori Norma
    function getCategoryAndPct(rs, count) {
      const minScore = count * 1;
      const maxScore = count * 4;
      const range = maxScore - minScore;
      const pct = range > 0 ? Math.round(((rs - minScore) / range) * 100) : 0;
      const safePct = Math.max(0, Math.min(100, pct));

      let category = "Sangat Rendah (Absent)";
      let color = "#ef4444"; // Merah

      if (safePct >= 81) {
        category = "Sangat Tinggi (Mastery)";
        color = "#059669"; // Hijau Tua
      } else if (safePct >= 61) {
        category = "Tinggi (Active)";
        color = "#0284c7"; // Biru
      } else if (safePct >= 41) {
        category = "Sedang (Emerging)";
        color = "#d97706"; // Kuning/Amber
      } else if (safePct >= 21) {
        category = "Rendah (Underused)";
        color = "#f97316"; // Oranye
      }

      return { percentage: safePct, category, color, rs, minScore, maxScore };
    }

    // 3. Kalkulasi 8 Dimensi Utama Teknik Belajar
    const mainDimensions = [
      "Retrieval & Memory",
      "Spacing",
      "Elaborasi & Pemahaman",
      "Organisasi Informasi",
      "Reading Techniques",
      "Practice & Problem Solving",
      "Time Management",
      "Monitoring & Metakognisi"
    ];

    const dimensionResults = {};
    const chartLabels = [];
    const chartData = [];
    const chartColors = [];

    mainDimensions.forEach(dimKey => {
      const rs = dimScores[dimKey] || 0;
      const count = dimCounts[dimKey] || 1;
      const res = getCategoryAndPct(rs, count);

      dimensionResults[dimKey] = res;
      chartLabels.push(dimKey);
      chartData.push(res.percentage);
      chartColors.push(res.color);
    });

    // 4. Kalkulasi Sub-Dimensi & Ekstraksi Top 5 / Bottom 3
    const subDimensionResults = {};
    const subListAll = [];

    for (const [subKey, rs] of Object.entries(subScores)) {
      if (subKey === "Konsistensi Teknik") continue; // Abaikan item validasi dari pemeringkatan
      const count = subCounts[subKey] || 3;
      const res = getCategoryAndPct(rs, count);
      subDimensionResults[subKey] = res;

      subListAll.push({
        name: subKey,
        ...res
      });
    }

    // Urutkan dari persentase tertinggi ke terendah
    subListAll.sort((a, b) => b.percentage - a.percentage);

    const top5Techniques = subListAll.slice(0, 5);
    const bottom3Techniques = subListAll.slice(-3).reverse();

    // 5. Evaluasi Protokol Coaching Remediasi
    const retrievalPct = dimensionResults["Retrieval & Memory"] ? dimensionResults["Retrieval & Memory"].percentage : 100;
    const spacingPct = dimensionResults["Spacing"] ? dimensionResults["Spacing"].percentage : 100;

    const needRetrievalCoaching = retrievalPct < 60;
    const needSpacingCoaching = spacingPct < 50;

    return {
      isInvalid: false,
      dimensionResults,
      subDimensionResults,
      chartLabels,
      chartData,
      chartColors,
      top5Techniques,
      bottom3Techniques,
      coachingFlags: {
        needRetrievalCoaching,
        needSpacingCoaching,
        retrievalPct,
        spacingPct
      }
    };
  },

  /**
   * Menyusun Payload Rekap ke Google Sheets
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const top5Str = evaluationResult.top5Techniques.map(t => `${t.name}: ${t.percentage}%`).join(", ");
    const dimStr = Object.entries(evaluationResult.dimensionResults).map(([d, r]) => `${d}: ${r.percentage}%`).join(" | ");

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
      kode_modul: "KS10",
      skor_mentah: `Top 5: ${top5Str}`,
      standard_score: dimStr,
      kategori_hasil: (evaluationResult.coachingFlags.needRetrievalCoaching || evaluationResult.coachingFlags.needSpacingCoaching) ? "Perlu Coaching Remediasi" : "Repertoar Terbentuk",
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KS10: Data pengerjaan LTE berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS10:", error);
    }
  }
};
