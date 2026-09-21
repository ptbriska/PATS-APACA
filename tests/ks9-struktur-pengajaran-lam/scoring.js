/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS9: APACA Learning Approach / Method (LAM)
   Modul Pemetaan Gaya & Metodologi Belajar
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS9_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Persentase Indeks (Psub), Kategorisasi,
   * dan menyusun data laporan untuk 4 Dimensi Utama & 25 Sub-Dimensi.
   */
  evaluate(answers, soalData, rubrikData) {
    const rawScores = {};
    const itemCounts = {};

    // 1. Invariance Response Check (Deteksi Asal Klik)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 100 && uniqueAnswers.size === 1) {
      return { 
        isInvalid: true, 
        message: "Flag: Invalid - Careless Responding (Jawaban terdeteksi seragam pada seluruh 100 item)." 
      };
    }

    // 2. Kalkulasi Skor Mentah Sub-Dimensi
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        if (!rawScores[q.sub_dimensi]) {
          rawScores[q.sub_dimensi] = 0;
          itemCounts[q.sub_dimensi] = 0;
        }
        const val = Number(answers[q.id]) || 1; // Likert 1-4 (Semua Favorable)
        rawScores[q.sub_dimensi] += val;
        itemCounts[q.sub_dimensi] += 1;
      });
    }

    // 3. Konversi ke Persentase Indeks (Psub) dan Kategorisasi
    // Rumus Psub (%) = ((RS - 4) / 12) * 100
    const subDimensiResults = {};
    for (const [subDim, rs] of Object.entries(rawScores)) {
      const pSub = Math.round(((rs - 4) / 12) * 100);
      const safePsub = Math.max(0, Math.min(100, pSub));

      let levelText = "Sangat Rendah";
      let colorCode = "#ef4444"; // Red

      if (safePsub >= 81) {
        levelText = "Sangat Dominan";
        colorCode = "#059669"; // Emerald
      } else if (safePsub >= 61) {
        levelText = "Dominan";
        colorCode = "#0284c7"; // Blue
      } else if (safePsub >= 41) {
        levelText = "Moderat / Adaptif";
        colorCode = "#d97706"; // Amber
      } else if (safePsub >= 21) {
        levelText = "Rendah";
        colorCode = "#f97316"; // Orange
      }

      subDimensiResults[subDim] = {
        rs: rs,
        persentase: safePsub,
        kategori: levelText,
        color: colorCode
      };
    }

    // 4. Pengelompokan Data berdasarkan 4 Dimensi Utama (dari rubrik.json)
    const reportData = {};
    const aktivitasChartData = { labels: [], data: [], colors: [] };
    const topTraits = {}; // Menyimpan sub-dimensi tertinggi dari setiap dimensi

    if (rubrikData && rubrikData.rubrik_dimensi) {
      for (const [dimKey, dimData] of Object.entries(rubrikData.rubrik_dimensi)) {
        reportData[dimKey] = {
          deskripsi: dimData.deskripsi,
          sub_list: []
        };

        for (const [subKey, subInfo] of Object.entries(dimData.sub_dimensi)) {
          // Beberapa key mungkin ditulis berbeda di soal.json vs rubrik.json (ex: Problem-Based Learning)
          // Kita gunakan subKey langsung dari rubrik untuk standarisasi mapping
          const res = subDimensiResults[subKey] || { rs: 4, persentase: 0, kategori: "Sangat Rendah", color: "#ef4444" };
          
          reportData[dimKey].sub_list.push({
            nama: subKey,
            ...res,
            ...subInfo
          });

          // Khusus untuk Chart Aktivitas Utama
          if (dimKey === "Aktivitas_Utama") {
            aktivitasChartData.labels.push(subKey);
            aktivitasChartData.data.push(res.persentase);
            aktivitasChartData.colors.push(res.color);
          }
        }

        // Urutkan dari persentase tertinggi ke terendah
        reportData[dimKey].sub_list.sort((a, b) => b.persentase - a.persentase);
        topTraits[dimKey] = reportData[dimKey].sub_list[0]; // Ambil yang paling tinggi
      }
    }

    return {
      isInvalid: false,
      subDimensiResults: subDimensiResults,
      reportData: reportData,
      aktivitasChartData: aktivitasChartData,
      topTraits: topTraits
    };
  },

  /**
   * Menyusun Payload Rekap ke Google Sheets
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    // Rekap Top 1 dari masing-masing 4 Dimensi
    const topSummary = Object.values(evaluationResult.topTraits)
      .map(t => `${t.nama} (${t.persentase}%)`)
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
      asal_instansi: userSession.asal_instansi || "Sekolah / Universitas",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KS9",
      skor_mentah: "Sub-dimensi tersimpan terpisah",
      standard_score: topSummary,
      kategori_hasil: "Profil LAM Terpetakan",
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KS9: Data pengerjaan LAM berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS9:", error);
    }
  }
};
