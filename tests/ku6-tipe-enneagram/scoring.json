/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KU6: APACA WPCM (Enneagram Model)
   Modul Penilaian 36 Block Forced-Choice Pairwise (A vs B), Kalkulasi 9 Tipe,
   Wing Dynamic, Triad Distribution, & Path Integration/Disintegration
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KU6_Scoring = {
  /**
   * Evaluasi Jawaban KU6:
   * 1. Skor Mentah Tipe 1 - 9 (0 s.d 8 Poin per Tipe)
   * 2. Main Core Type (Skor Tertinggi)
   * 3. Wing Dynamic (Tipe Bersebelahan Tertinggi Kedua)
   * 4. Triad Centers (Gut, Heart, Head)
   * 5. Penarikan Rincian Diagnostik dari rubrik.json
   */
  evaluate(answers, soalData, rubrikData) {
    if (!soalData || !soalData.questions) {
      return { isInvalid: true, message: "Data soal KU6 tidak ditemukan." };
    }

    const typeScores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const questionMap = new Map(soalData.questions.map(q => [q.id, q]));
    let answeredCount = 0;

    // Iterasi 36 Item Pairwise
    for (let i = 1; i <= 36; i++) {
      const qObj = questionMap.get(i);
      const chosenCode = answers[i] || answers[`${i}`];

      if (chosenCode && qObj && qObj.options) {
        const opt = qObj.options.find(o => o.code === chosenCode);
        if (opt && opt.type) {
          typeScores[opt.type] = (typeScores[opt.type] || 0) + 1;
          answeredCount++;
        }
      }
    }

    // Validasi Pengerjaan Lengkap
    if (answeredCount < 36) {
      return {
        isInvalid: true,
        message: `Pengerjaan belum lengkap (${answeredCount}/36 item terisi). Silakan lengkapi seluruh pilihan.`
      };
    }

    // 1. Penentuan Main Core Type (Skor Maksimal)
    let mainType = 1;
    let maxScore = -1;

    for (let t = 1; t <= 9; t++) {
      if (typeScores[t] > maxScore) {
        maxScore = typeScores[t];
        mainType = t;
      }
    }

    // 2. Penentuan Wing Dynamic (Tipe Bersebelahan Tertinggi)
    const leftWing = mainType === 1 ? 9 : mainType - 1;
    const rightWing = mainType === 9 ? 1 : mainType + 1;

    const scoreLeft = typeScores[leftWing];
    const scoreRight = typeScores[rightWing];

    let wingType = rightWing; // Default fallback
    if (scoreLeft > scoreRight) {
      wingType = leftWing;
    } else if (scoreRight > scoreLeft) {
      wingType = rightWing;
    } else {
      wingType = rightWing;
    }

    const enneagramCode = `${mainType}w${wingType}`;

    // 3. Kalkulasi Triad Centers
    const triadScores = {
      Gut: typeScores[8] + typeScores[9] + typeScores[1],
      Heart: typeScores[2] + typeScores[3] + typeScores[4],
      Head: typeScores[5] + typeScores[6] + typeScores[7]
    };

    // 4. Ambil Rincian Profil dari Rubrik
    const detailsMap = (rubrikData && rubrikData.tipe_detail) ? rubrikData.tipe_detail : {};
    const mainDetail = detailsMap[mainType] || {
      julukan: `Core Type ${mainType}`,
      triad: "-",
      ringkasan_perilaku: "-",
      core_desire: "-",
      core_fear: "-",
      kekuatan_utama: [],
      kelemahan_utama: [],
      gaya_komunikasi: "-",
      gaya_kepemimpinan: "-",
      lingkungan_ideal: "-",
      pemicu_stres: "-",
      potensi_karir: [],
      wings: {},
      disintegration_target: 0,
      disintegration_desc: "-",
      integration_target: 0,
      integration_desc: "-",
      saran_pengembangan: "-"
    };

    const wingDetail = (mainDetail.wings && mainDetail.wings[enneagramCode])
      ? mainDetail.wings[enneagramCode]
      : { nama: enneagramCode, deskripsi: "Dinamika ekspresi kepribadian dengan pengaruh tipe wing bersebelahan." };

    return {
      isInvalid: false,
      mainType: mainType,
      wingType: wingType,
      enneagramCode: enneagramCode,
      rawScores: typeScores,
      triadScores: triadScores,
      mainDetail: mainDetail,
      wingDetail: wingDetail
    };
  },

  /**
   * Mengirimkan Hasil Rekap KU6 ke Google Apps Script (GAS)
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const scores = evaluationResult.rawScores;
    const rawStr = Object.entries(scores).map(([t, val]) => `T${t}:${val}`).join(", ");
    const triadStr = `Gut:${evaluationResult.triadScores.Gut}, Heart:${evaluationResult.triadScores.Heart}, Head:${evaluationResult.triadScores.Head}`;

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
      kode_modul: "KU6",
      skor_mentah: `Enneagram: ${evaluationResult.enneagramCode} (${evaluationResult.mainDetail.julukan})`,
      standard_score: `${rawStr} | ${triadStr}`,
      kategori_hasil: `Profil: ${evaluationResult.mainDetail.julukan}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KU6: Data Enneagram berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KU6:", error);
    }
  }
};
