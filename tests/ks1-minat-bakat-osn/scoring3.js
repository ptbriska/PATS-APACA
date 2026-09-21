/* ==========================================================================
   PATS PORTAL - SCORING ENGINE OTM PILAR III (Science Persona Fit Test)
   Kalkulasi Skor Pilar III (0-100), Indeks Intimidasi / Warning Tag,
   serta Otomatisasi Simpan ke Session Storage
   ========================================================================== */

const Pilar3_Scoring = {
  // Mapping Kode 3 Huruf ke Nama Lengkap Bidang
  codeToNameMap: {
    "MTK": "Matematika", "FIS": "Fisika", "KIM": "Kimia", "BIO": "Biologi",
    "INF": "Informatika", "AST": "Astronomi", "KBM": "Kebumian",
    "EKO": "Ekonomi", "GEO": "Geografi", "AI": "AI & Data Science"
  },

  /**
   * Evaluasi Jawaban Pilar III
   * @param {Object} answersByField - Format: { "MTK": { 1: 5, 2: 4, ... 8: 4 }, ... }
   */
  evaluate(answersByField) {
    if (!answersByField || Object.keys(answersByField).length === 0) {
      return {
        isInvalid: true,
        message: "Data jawaban Pilar III tidak ditemukan atau belum diisi."
      };
    }

    const results = {};

    // Iterasi 10 Bidang Resmi OSN & AI
    Object.keys(this.codeToNameMap).forEach((fieldCode) => {
      const fieldName = this.codeToNameMap[fieldCode];
      
      // Fleksibilitas pencarian jawaban (bisa pakai kode 'MTK' atau nama 'Matematika')
      const fieldAnswers = answersByField[fieldCode] || answersByField[fieldName] || {};
      let totalRaw = 0;

      // 1. Hitung Total Skor Mentah (C1 s.d. C8) -> Maksimal 40
      for (let qId = 1; qId <= 8; qId++) {
        totalRaw += parseInt(fieldAnswers[qId]) || 0;
      }

      // 2. Normalisasi Skor Pilar III ke skala 0-100: (Total / 40) * 100
      const scorePilar3 = parseFloat(((totalRaw / 40) * 100).toFixed(2));

      // 3. Hitung Indeks Intimidasi: (C1 + C2) / 2
      const c1 = parseInt(fieldAnswers[1]) || 0;
      const c2 = parseInt(fieldAnswers[2]) || 0;
      const intimidationIndex = parseFloat(((c1 + c2) / 2).toFixed(2));

      // 4. Penentuan Status Resiliensi & Warning Tag
      let statusResiliensi = "FIT (HIGH)";
      let warningTag = false;
      let evalText = "Sangat siap menghadapi tekanan; stamina mental dan daya juang tinggi.";

      if (intimidationIndex < 3.0) {
        warningTag = true;
        statusResiliensi = "RISK OF OSN BURNOUT";
        evalText = "Terintimidasi oleh tingkat kesulitan soal. Rentan panik dan burnout jika dipaksa ikut pembinaan intensif.";
      } else if (scorePilar3 < 50.0) {
        statusResiliensi = "FIT (LOW / RENTAN)";
        evalText = "Daya tahan mental dan komitmen waktu sangat terbatas terhadap beban latihan bidang ini.";
      } else if (scorePilar3 < 65.0) {
        statusResiliensi = "FIT (BORDERLINE)";
        evalText = "Berada di batas minimum resiliensi mental. Butuh dorongan ekstra agar tidak minder.";
      } else if (scorePilar3 < 80.0) {
        statusResiliensi = "FIT (MODERATE)";
        evalText = "Cukup nyaman dengan rutinitas latihan soal dan analisis studi kasus.";
      }

      results[fieldCode] = {
        field_code: fieldCode,
        field_name: fieldName,
        score_pilar3: scorePilar3,
        intimidation_index: intimidationIndex,
        warning_tag: warningTag,
        status_resiliensi: statusResiliensi,
        evaluasi: evalText
      };
    });

    const finalOutput = {
      isInvalid: false,
      field_results: results,
      timestamp: new Date().toISOString()
    };

    // Auto-sync ke Session Storage untuk langsung dibaca oleh scoring_total.js
    try {
      sessionStorage.setItem("pats_pilar3_results", JSON.stringify(finalOutput));
      console.log("[PILAR 3 SCORING]: Hasil berhasil dievaluasi dan disimpan ke sessionStorage.");
    } catch (e) {
      console.warn("[PILAR 3 SCORING WARNING]: Gagal menyimpan ke sessionStorage:", e);
    }

    return finalOutput;
  }
};
