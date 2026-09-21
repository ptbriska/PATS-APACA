/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KU2: APACA Work Integrity & Ethics Test (WIET)
   Modul Penilaian, Algoritma Validasi (LSI & CCI), & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KU2_Scoring = {
  /**
   * Pemetaan Pasangan Item Uji Konsistensi Bersilang (CCI Cross-Check Pairs)
   * Pair 1: Item 46 vs Item 5
   * Pair 2: Item 47 vs Item 14
   * Pair 3: Item 48 vs Item 23
   * Pair 4: Item 49 vs Item 32
   * Pair 5: Item 50 vs Item 10
   */
  consistencyPairs: [
    { itemCross: 46, itemTarget: 5 },
    { itemCross: 47, itemTarget: 14 },
    { itemCross: 48, itemTarget: 23 },
    { itemCross: 49, itemTarget: 32 },
    { itemCross: 50, itemTarget: 10 }
  ],

  /**
   * Menghitung Skor Indeks Integritas Kerja Global (0-100%),
   * Evaluasi Validitas (Lie Scale Index / LSI & Consistency Check Index / CCI),
   * Breakdown 4 Dimensi Etika, Matriks Tipologi, dan High Ethical Risk Flag.
   */
  evaluate(answers, soalData, rubrikData) {
    if (!soalData || !soalData.questions) {
      return { isInvalid: true, message: "Data soal tidak ditemukan." };
    }

    const questionMap = new Map(soalData.questions.map(q => [q.id, q]));

    // 1. HITUNG LIE SCALE INDEX (LSI) - Item 41-45 (5 Item)
    let lieCount = 0;
    for (let i = 41; i <= 45; i++) {
      const userChoiceCode = answers[i];
      const qObj = questionMap.get(i);
      if (qObj && userChoiceCode) {
        const selectedOpt = qObj.options.find(opt => opt.code === userChoiceCode);
        if (selectedOpt && selectedOpt.is_lie) {
          lieCount++;
        }
      }
    }
    const lsiIndex = Math.round((lieCount / 5) * 100);

    // 2. HITUNG CONSISTENCY CHECK INDEX (CCI) - 5 Pasang Item Uji Silang
    let consistentMatches = 0;
    this.consistencyPairs.forEach(pair => {
      const choiceCrossCode = answers[pair.itemCross];
      const choiceTargetCode = answers[pair.itemTarget];

      const qCross = questionMap.get(pair.itemCross);
      const qTarget = questionMap.get(pair.itemTarget);

      if (qCross && qTarget && choiceCrossCode && choiceTargetCode) {
        const optCross = qCross.options.find(opt => opt.code === choiceCrossCode);
        const optTarget = qTarget.options.find(opt => opt.code === choiceTargetCode);

        // Jika logika pilihan etisnya bernilai sejalan (keduanya etis atau keduanya kompromistis)
        if (optCross && optTarget && optCross.is_ethical === optTarget.is_ethical) {
          consistentMatches++;
        }
      }
    });
    const cciIndex = Math.round((consistentMatches / 5) * 100);

    // 3. CEK AMBANG BATAS VALIDITAS (VALIDITY CHECKS)
    let isInvalid = false;
    let invalidReason = "";
    let invalidMessage = "";

    if (lsiIndex >= 80) {
      isInvalid = true;
      invalidReason = "FAKING_GOOD";
      invalidMessage = "Flag: INVALID - HIGH SOCIAL DESIRABILITY / FAKING GOOD (Indeks Kebohongan LSI ≥ 80%). Terindikasi memberikan respons tidak realistis demi pencitraan diri.";
    } else if (cciIndex < 60) {
      isInvalid = true;
      invalidReason = "INCONSISTENT";
      invalidMessage = "Flag: INVALID - INCONSISTENT RESPONSES (Indeks Konsistensi CCI < 60%). Terindikasi pengisian acak atau kontradiktif pada skenario etika.";
    }

    // 4. AKUMULASI SKOR 4 DIMENSI UTAMA (Item 1-40)
    const dimensionRaw = {
      "Kejujuran": 0,
      "Keandalan": 0,
      "Kepatuhan Aturan": 0,
      "Risiko Perilaku Kontra-produktif": 0
    };

    let rsIntegrityTotal = 0;

    for (let i = 1; i <= 40; i++) {
      const userChoiceCode = answers[i];
      const qObj = questionMap.get(i);
      if (qObj && userChoiceCode) {
        const selectedOpt = qObj.options.find(opt => opt.code === userChoiceCode);
        if (selectedOpt && selectedOpt.is_ethical) {
          if (dimensionRaw[qObj.dimensi] !== undefined) {
            dimensionRaw[qObj.dimensi] += 1;
          }
          rsIntegrityTotal += 1;
        }
      }
    }

    // Formula Indeks Integritas Global: (RS_integrity / 40) * 100
    const integrityIndex = Math.round((rsIntegrityTotal / 40) * 100);

    // 5. NORMA GLOBAL & KATEGORISASI
    const globalNorms = (rubrikData && rubrikData.norma_kategorisasi_global) ? rubrikData.norma_kategorisasi_global : [];
    let matchedNorm = null;

    if (isInvalid) {
      matchedNorm = globalNorms.find(n => n.status_validitas === "INVALID") || {
        kategori: "Hasil Tidak Valid",
        label_status: "INVALID / UNRELIABLE RESPONSES",
        deskripsi_kondisi: invalidMessage,
        profil_karakter: "-",
        rekomendasi_penempatan: "Diperlukan tes ulang (re-test) atau wawancara mendalam."
      };
    } else {
      matchedNorm = globalNorms.find(n => integrityIndex >= 86 ? n.rentang_skor_persen === "86% - 100%" :
                                          integrityIndex >= 71 ? n.rentang_skor_persen === "71% - 85%" :
                                          integrityIndex >= 51 ? n.rentang_skor_persen === "51% - 70%" :
                                                                n.rentang_skor_persen === "0% - 50%");
    }

    // 6. BREAKDOWN 4 DIMENSI UTAMA (10 Item per Dimensi)
    const dimensionScores = {};
    const dimensionRows = [];
    const rubrikDim = (rubrikData && rubrikData.rubrik_dimensi_utama) ? rubrikData.rubrik_dimensi_utama : {};

    for (const [dimKey, rs] of Object.entries(dimensionRaw)) {
      const pct = Math.round((rs / 10) * 100);
      dimensionScores[dimKey] = pct;

      let levelKey = pct >= 81 ? "Tinggi (81% - 100%)" :
                     pct >= 51 ? "Sedang (51% - 80%)" : "Rendah (0% - 50%)";

      const dimInfo = rubrikDim[dimKey] || {};
      const dimAnalisis = (dimInfo.analisis_tingkat_skor && dimInfo.analisis_tingkat_skor[levelKey])
        ? dimInfo.analisis_tingkat_skor[levelKey]
        : {};

      dimensionRows.push({
        dimensi: dimKey,
        judul_dimensi: dimInfo.judul_dimensi || dimKey,
        rs: rs,
        percentage: pct,
        level: levelKey.split(' ')[0],
        kondisi: dimAnalisis.kondisi || "-",
        interpretasi: dimAnalisis.interpretasi || "-",
        saran_pengembangan: dimAnalisis.saran_pengembangan || "-"
      });
    }

    // 7. DETEKSI HIGH ETHICAL RISK FLAG
    const cwbScore = dimensionScores["Risiko Perilaku Kontra-produktif"] || 0;
    const highEthicalRiskFlag = cwbScore <= 60;

    // 8. DETEKSI TIPOLOGI KARAKTER ETIKA
    const tipologiList = (rubrikData && rubrikData.matriks_tipologi_karakter_etika) ? rubrikData.matriks_tipologi_karakter_etika : [];
    let matchedTipologi = null;

    if (integrityIndex >= 86 && Object.values(dimensionScores).every(s => s >= 80)) {
      matchedTipologi = tipologiList.find(t => t.nama_pola.includes("Stalwart"));
    } else if (dimensionScores["Keandalan"] >= 80 && dimensionScores["Kepatuhan Aturan"] <= 60) {
      matchedTipologi = tipologiList.find(t => t.nama_pola.includes("Pragmatic Executor"));
    } else if (dimensionScores["Kepatuhan Aturan"] >= 80 && dimensionScores["Keandalan"] <= 50) {
      matchedTipologi = tipologiList.find(t => t.nama_pola.includes("Compliant Non-Reliable"));
    } else {
      matchedTipologi = tipologiList.find(t => t.nama_pola.includes("Vulnerability")) || tipologiList[0];
    }

    return {
      isInvalid: isInvalid,
      invalidReason: invalidReason,
      invalidMessage: invalidMessage,
      lsiIndex: lsiIndex,
      cciIndex: cciIndex,
      rsIntegrityTotal: rsIntegrityTotal,
      integrityIndex: integrityIndex,
      globalNorm: matchedNorm,
      dimensionScores: dimensionScores,
      dimensionRows: dimensionRows,
      highEthicalRiskFlag: highEthicalRiskFlag,
      matchedTipologi: matchedTipologi
    };
  },

  /**
   * Menyusun Payload dan Mengirimkan Hasil Rekap KU2 ke Google Sheets via GAS
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
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
      asal_instansi: userSession.asal_instansi || "Sekolah / Perusahaan",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KU2",
      skor_mentah: `Indeks: ${evaluationResult.integrityIndex}% | Validitas: ${evaluationResult.isInvalid ? 'INVALID (' + evaluationResult.invalidReason + ')' : 'VALID'} | LSI: ${evaluationResult.lsiIndex}% | CCI: ${evaluationResult.cciIndex}%`,
      standard_score: `4 Dimensi: (${dimStr})`,
      kategori_hasil: `Status: ${evaluationResult.globalNorm.label_status} | Risk Flag: ${evaluationResult.highEthicalRiskFlag ? 'ACTIVE' : 'NORMAL'}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KU2: Data WIET berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KU2:", error);
    }
  }
};
