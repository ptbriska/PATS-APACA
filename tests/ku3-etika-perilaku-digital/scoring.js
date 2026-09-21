/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KU3: APACA Youth Digital Behavior & Literacy Inventory (ADLIT-Y)
   Modul Penilaian Hybrid Format, Dual-Score (ILD & IRAD), & Matriks 2D 4-Zona
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KU3_Scoring = {
  /**
   * Menghitung:
   * 1. Indeks Literasi Digital (ILD - Skala 0 - 100%)
   * 2. Indeks Risiko Adiksi Digital (IRAD - Skor Mentah 15 - 60)
   * 3. Penentuan Zona Matriks 2D (Zone A: Bahaya, Zone B: Kerentanan, Zone C: Polos, Zone D: Aman)
   * 4. Breakdown Skor 4 Dimensi Utama
   */
  evaluate(answers, soalData, rubrikData) {
    if (!soalData || !soalData.questions) {
      return { isInvalid: true, message: "Data soal tidak ditemukan." };
    }

    const questionMap = new Map(soalData.questions.map(q => [q.id, q]));

    // 1. Invariance Response Check (40 item)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 40 && uniqueAnswers.size === 1) {
      return {
        isInvalid: true,
        message: "Flag: INVALID - CARELESS RESPONDING (Jawaban terdeteksi seragam pada seluruh 40 butir soal)."
      };
    }

    // Inisialisasi Skor Mentah
    let rsLiterasiTotal = 0; // Item 1 - 25 (Min = 25, Max = 100)
    let rsAdiksiTotal = 0;   // Item 26 - 40 (Min = 15, Max = 60)

    const dimensionRaw = {
      "Etika & Etiket Digital": 0,
      "Berpikir Kritis Informasi": 0,
      "Keamanan & Privasi": 0,
      "Screening Adiksi Screen-Time": 0
    };

    const dimensionMax = {
      "Etika & Etiket Digital": 20,       // 5 item x 4 pt
      "Berpikir Kritis Informasi": 20,   // 5 item x 4 pt
      "Keamanan & Privasi": 60,          // 15 item x 4 pt
      "Screening Adiksi Screen-Time": 60 // 15 item x 4 pt
    };

    // 2. Akumulasi Skor per Item
    for (let i = 1; i <= 40; i++) {
      const userVal = answers[i];
      const qObj = questionMap.get(i);

      if (qObj && userVal !== undefined) {
        let points = 0;

        if (qObj.type === "case_study") {
          // Opsi Studi Kasus (Point Weight: 4, 2, atau 1)
          const selectedOpt = qObj.options.find(opt => opt.code === userVal);
          points = selectedOpt ? selectedOpt.point : 1;
        } else {
          // Opsi Likert (1, 2, 3, 4)
          points = Number(userVal) || 1;
        }

        // Akumulasi Dimensi
        if (dimensionRaw[qObj.dimensi] !== undefined) {
          dimensionRaw[qObj.dimensi] += points;
        }

        // Akumulasi Kluster Utama
        if (i <= 25) {
          rsLiterasiTotal += points;
        } else {
          rsAdiksiTotal += points;
        }
      }
    }

    // 3. KALKULASI INDEKS UTAMA
    // Formula ILD = ((RSlit - 25) / 75) * 100
    const ildScore = Math.max(0, Math.min(100, Math.round(((rsLiterasiTotal - 25) / 75) * 100)));

    // IRAD = Skor Mentah Adiksi (15 - 60)
    const iradScore = Math.max(15, Math.min(60, rsAdiksiTotal));

    // 4. NORMA ILD & IRAD
    const normaILDList = (rubrikData && rubrikData.norma_ild) ? rubrikData.norma_ild : [];
    let matchedILDNorm = normaILDList.find(n => ildScore >= 81 ? n.rentang_skor_persen === "81% - 100%" :
                                                ildScore >= 61 ? n.rentang_skor_persen === "61% - 80%" :
                                                ildScore >= 41 ? n.rentang_skor_persen === "41% - 60%" :
                                                                 n.rentang_skor_persen === "0% - 40%") || {};

    const normaIRADList = (rubrikData && rubrikData.norma_irad) ? rubrikData.norma_irad : [];
    let matchedIRADNorm = normaIRADList.find(n => iradScore >= 40 ? n.rentang_skor_mentah === "40 - 60" :
                                                  iradScore >= 27 ? n.rentang_skor_mentah === "27 - 39" :
                                                                    n.rentang_skor_mentah === "15 - 26") || {};

    // 5. PENENTUAN ZONA MATRIKS 2D (Zone A - D)
    const zoneMatrix = (rubrikData && rubrikData.matriks_zona_profil) ? rubrikData.matriks_zona_profil : {};
    let activeZoneKey = "Zone_D";

    if (ildScore <= 60 && iradScore >= 40) {
      activeZoneKey = "Zone_A"; // BAHAYA
    } else if (ildScore >= 61 && iradScore >= 40) {
      activeZoneKey = "Zone_B"; // KERENTANAN
    } else if (ildScore <= 60 && iradScore <= 39) {
      activeZoneKey = "Zone_C"; // POLOS
    } else {
      activeZoneKey = "Zone_D"; // AMAN
    }

    const activeZone = zoneMatrix[activeZoneKey] || {
      kode_zona: activeZoneKey,
      nama_zona: "Zona Tidak Terdefinisi",
      deskripsi_klinis: "-",
      risiko_utama: "-",
      rekomendasi_penanganan: "-"
    };

    // 6. BREAKDOWN DIMENSI
    const dimensionScores = {};
    const dimensionRows = [];
    const rubrikDim = (rubrikData && rubrikData.rubrik_dimensi) ? rubrikData.rubrik_dimensi : {};

    for (const [dimKey, rs] of Object.entries(dimensionRaw)) {
      const maxPt = dimensionMax[dimKey] || 20;
      const pct = Math.round((rs / maxPt) * 100);
      dimensionScores[dimKey] = pct;

      const dimInfo = rubrikDim[dimKey] || {};

      dimensionRows.push({
        dimensi: dimKey,
        judul: dimInfo.judul || dimKey,
        rs: rs,
        maxRs: maxPt,
        percentage: pct,
        deskripsi: dimInfo.deskripsi || "-"
      });
    }

    return {
      isInvalid: false,
      rsLiterasiTotal: rsLiterasiTotal,
      rsAdiksiTotal: rsAdiksiTotal,
      ildScore: ildScore,
      iradScore: iradScore,
      matchedILDNorm: matchedILDNorm,
      matchedIRADNorm: matchedIRADNorm,
      activeZoneKey: activeZoneKey,
      activeZone: activeZone,
      dimensionScores: dimensionScores,
      dimensionRows: dimensionRows
    };
  },

  /**
   * Mengirimkan Hasil Rekap KU3 ke Google Apps Script
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const dimStr = Object.entries(evaluationResult.dimensionScores)
      .map(([d, p]) => `${d}: ${p}%`)
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
      asal_instansi: userSession.asal_instansi || "Sekolah / Kampus",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KU3",
      skor_mentah: `ILD: ${evaluationResult.ildScore}% | IRAD: ${evaluationResult.iradScore} | Zona: ${evaluationResult.activeZone.kode_zona}`,
      standard_score: `4 Dimensi: (${dimStr})`,
      kategori_hasil: `ILD: ${evaluationResult.matchedILDNorm.label_status} | IRAD: ${evaluationResult.matchedIRADNorm.label_status}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KU3: Data ADLIT-Y berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KU3:", error);
    }
  }
};
