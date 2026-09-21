/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KU8: APACA Leadership & Soft Skills Assessment (ALSA)
   Modul Penilaian 50 Skenario SJT (Bobot 1-4 per Opsi), Kalkulasi 5 Dimensi Utama,
   T-Score Standard Score Conversion, & Leadership Readiness Index
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KU8_Scoring = {
  /**
   * Evaluasi Jawaban KU8:
   * 1. Akumulasi Skor Mentah (RS) per Dimensi (Rentang 10 - 40 Poin per Dimensi)
   * 2. Kalkulasi Total Skor Mentah Kumulatif (Rentang 50 - 200 Poin)
   * 3. Konversi T-Score (Mean = 50, SD = 10)
   * 4. Penentuan Kategori Norma Global & per Dimensi dari rubrik.json
   */
  evaluate(answers, soalData, rubrikData) {
    if (!soalData || !soalData.questions) {
      return { isInvalid: true, message: "Data soal KU8 tidak ditemukan." };
    }

    const dimScores = {
      Decision_Making: 0,
      Time_Management: 0,
      Teamwork: 0,
      Situational_Leadership: 0,
      Conflict_Resolution: 0
    };

    const questionMap = new Map(soalData.questions.map(q => [q.id, q]));
    let answeredCount = 0;

    // Iterasi 50 Skenario SJT
    for (let i = 1; i <= 50; i++) {
      const qObj = questionMap.get(i);
      const chosenCode = answers[i] || answers[`${i}`];

      if (chosenCode && qObj && qObj.options) {
        const opt = qObj.options.find(o => o.code === chosenCode);
        if (opt && typeof opt.points === "number") {
          // Petakan ID ke Dimensi
          let dimKey = "Decision_Making";
          if (i >= 1 && i <= 10) dimKey = "Decision_Making";
          else if (i >= 11 && i <= 20) dimKey = "Time_Management";
          else if (i >= 21 && i <= 30) dimKey = "Teamwork";
          else if (i >= 31 && i <= 40) dimKey = "Situational_Leadership";
          else if (i >= 41 && i <= 50) dimKey = "Conflict_Resolution";

          dimScores[dimKey] += opt.points;
          answeredCount++;
        }
      }
    }

    // Validasi Pengerjaan Lengkap
    if (answeredCount < 50) {
      return {
        isInvalid: true,
        message: `Pengerjaan belum lengkap (${answeredCount}/50 skenario terisi). Silakan lengkapi seluruh jawaban.`
      };
    }

    // Total Skor Mentah Kumulatif
    const totalRawScore = Object.values(dimScores).reduce((a, b) => a + b, 0);

    // Kalkulasi T-Score Total (Mean=125, SD=20 untuk Total 50 Item)
    const totalTScore = Math.round(50 + 10 * ((totalRawScore - 125) / 20));

    // Kalkulasi T-Score per Dimensi (Mean=25, SD=5 untuk 10 Item per Dimensi)
    const dimTScores = {};
    Object.keys(dimScores).forEach(key => {
      dimTScores[key] = Math.round(50 + 10 * ((dimScores[key] - 25) / 5));
    });

    // Penentuan Kategori Norma Global
    let globalCategory = "Capable (Sedang)";
    let globalRec = "Memenuhi standar dasar operasional.";

    if (totalTScore >= 65 || totalRawScore >= 170) {
      globalCategory = "Role Model (Sangat Tinggi)";
      globalRec = "Sangat siap mengemban posisi puncak kepemimpinan dan mengeksekusi keputusan strategis tanpa pengawasan.";
    } else if (totalTScore >= 55 || totalRawScore >= 145) {
      globalCategory = "Proficient (Tinggi)";
      globalRec = "Siap untuk posisi penyelia/supervisor; menunjukkan judgment taktis yang matang.";
    } else if (totalTScore >= 45 || totalRawScore >= 120) {
      globalCategory = "Capable (Sedang)";
      globalRec = "Memenuhi standar dasar kerja sama operasional, butuh coaching pada situasi krisis kompleks.";
    } else if (totalTScore >= 35 || totalRawScore >= 95) {
      globalCategory = "Developing (Rendah)";
      globalRec = "Cenderung kesulitan dalam memprioritaskan tugas atau mengendalikan konflik; butuh intervensi pembimbingan.";
    } else {
      globalCategory = "Needs Intervention (Sangat Rendah)";
      globalRec = "Tindakan yang diambil berisiko merugikan operasional; butuh intervensi pelatihan intensif.";
    }

    // Fungsi Pembantu Ambil Detail Kategori Dimensi dari rubrik.json
    const getDimCategoryDetail = (dimKey, score) => {
      const dimRubrik = (rubrikData && rubrikData.dimensi_utama && rubrikData.dimensi_utama[dimKey])
        ? rubrikData.dimensi_utama[dimKey].kategori_skor
        : null;

      if (!dimRubrik) return { kategori: "Capable", deskripsi_perilaku: "-", saran_pengembangan: "-" };

      if (score >= 35) return dimRubrik.Sangat_Tinggi;
      if (score >= 29) return dimRubrik.Tinggi;
      if (score >= 23) return dimRubrik.Sedang;
      if (score >= 17) return dimRubrik.Rendah;
      return dimRubrik.Sangat_Rendah;
    };

    const dimDetails = {};
    Object.keys(dimScores).forEach(key => {
      dimDetails[key] = getDimCategoryDetail(key, dimScores[key]);
    });

    return {
      isInvalid: false,
      totalRawScore: totalRawScore,
      totalTScore: totalTScore,
      globalCategory: globalCategory,
      globalRec: globalRec,
      dimScores: dimScores,
      dimTScores: dimTScores,
      dimDetails: dimDetails
    };
  },

  /**
   * Mengirimkan Hasil Rekap KU8 ke Google Apps Script (GAS)
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const ds = evaluationResult.dimScores;
    const scoreStr = `DM:${ds.Decision_Making}, TM:${ds.Time_Management}, TW:${ds.Teamwork}, SL:${ds.Situational_Leadership}, CR:${ds.Conflict_Resolution}`;

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
      kode_modul: "KU8",
      skor_mentah: `Leadership Index: ${evaluationResult.totalRawScore}/200 (T-Score: ${evaluationResult.totalTScore})`,
      standard_score: `${scoreStr} | T-Total:${evaluationResult.totalTScore}`,
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
      console.log("Sistem Rekap KU8: Data ALSA berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KU8:", error);
    }
  }
};
