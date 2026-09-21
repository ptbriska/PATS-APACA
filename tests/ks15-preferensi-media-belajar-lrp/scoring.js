/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS15: APACA Learning Resource Preference Test (LRP)
   Modul Penilaian & Automated Rekap System (Forced-Choice Ipsative Engine)
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS15_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Relative Preference Index (RPI %),
   * Pemeringkatan 14 Artefak Media, Evaluasi 4 Kategori Utama,
   * Deteksi Pola Resource Stack, dan Rekomendasi Strategi Belajar.
   */
  evaluate(answers, soalData, rubrikData) {
    // 1. Validation & Rapid Clicking Check
    const totalAnswered = Object.keys(answers).length;
    if (totalAnswered < 42) {
      // Peringatan jika belum terisi semua
      console.warn("KS15 Engine: Belum semua blok skenario terisi.");
    }

    // Inisialisasi 14 Artefak Media
    const allResources = [
      "Textbook", "Diagram", "Flashcards",
      "Video", "Lecture", "Podcast",
      "AI", "Internet", "Simulation",
      "Practice Questions", "Real-World Examples", "Tutor", "Peer", "Physical Experiment"
    ];

    const rawScores = {};
    allResources.forEach(r => { rawScores[r] = 0; });

    // 2. Akumulasi Poin Forced Choice (+2 Most, -1 Least, 0 Unchosen)
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const userAns = answers[q.id]; // Format expected: { most: "A", least: "C" } atau { most: "Video", least: "Podcast" }
        
        if (userAns && typeof userAns === 'object') {
          let mostRes = null;
          let leastRes = null;

          q.options.forEach(opt => {
            if (userAns.most === opt.code || userAns.most === opt.resource) {
              mostRes = opt.resource;
            }
            if (userAns.least === opt.code || userAns.least === opt.resource) {
              leastRes = opt.resource;
            }
          });

          if (mostRes && rawScores[mostRes] !== undefined) {
            rawScores[mostRes] += 2;
          }
          if (leastRes && rawScores[leastRes] !== undefined) {
            rawScores[leastRes] -= 1;
          }
        }
      });
    }

    // 3. Kalkulasi Relative Preference Index (RPI %) -> Rentang RS: -6 s.d. +12 (Range: 18)
    const rpiScores = {};
    const globalNorms = (rubrikData && rubrikData.norma_kategorisasi_global) ? rubrikData.norma_kategorisasi_global : [];
    const mediaDetails = (rubrikData && rubrikData.detail_artefak_media) ? rubrikData.detail_artefak_media : {};

    const resourceRows = [];

    allResources.forEach(r => {
      const rs = rawScores[r];
      // Formula RPI (%): ((RS - (-6)) / 18) * 100
      const pct = Math.round(((rs - (-6)) / 18) * 100);
      const safePct = Math.max(0, Math.min(100, pct));
      rpiScores[r] = safePct;

      let normMatch = globalNorms.find(n => safePct >= 81 ? n.rentang_skor_persen === "81% - 100%" :
                                            safePct >= 61 ? n.rentang_skor_persen === "61% - 80%" :
                                            safePct >= 41 ? n.rentang_skor_persen === "41% - 60%" :
                                            safePct >= 21 ? n.rentang_skor_persen === "21% - 40%" :
                                                            n.rentang_skor_persen === "0% - 20%");

      if (!normMatch) {
        normMatch = { kategori: "Tertiary Resource", label_status: "NETRAL" };
      }

      const info = mediaDetails[r] || {};

      resourceRows.push({
        resource: r,
        nama_resmi: info.nama_resmi || r,
        kategori: info.kategori || "Umum",
        rs: rs,
        rpi: safePct,
        kategori_label: normMatch.kategori,
        label_status: normMatch.label_status,
        panduan_orang_tua: info.panduan_orang_tua || "-",
        panduan_sekolah: info.panduan_sekolah || "-"
      });
    });

    // 4. Urutkan Pemeringkatan Hierarchy (Top s.d. Bottom)
    resourceRows.sort((a, b) => b.rpi - a.rpi);

    const top3Primary = resourceRows.slice(0, 3);
    const bottom2Avoided = resourceRows.slice(-2).reverse();

    // 5. Kalkulasi Rerata Skor 4 Kategori Utama
    const categoryMapping = {
      "Textual & Static Visual": ["Textbook", "Diagram", "Flashcards"],
      "Audio & Dynamic Multimedia": ["Video", "Lecture", "Podcast"],
      "Digital, Interactive & Generative": ["AI", "Internet", "Simulation"],
      "Human, Experiential & Applied": ["Practice Questions", "Real-World Examples", "Tutor", "Peer", "Physical Experiment"]
    };

    const categoryScores = {};
    for (const [catName, resList] of Object.entries(categoryMapping)) {
      const sum = resList.reduce((acc, curr) => acc + (rpiScores[curr] || 0), 0);
      categoryScores[catName] = Math.round(sum / resList.length);
    }

    // 6. Deteksi Pola Kombinasi Resource Stack
    const comboRules = (rubrikData && rubrikData.pola_kombinasi_resource_stack) ? rubrikData.pola_kombinasi_resource_stack : [];
    const detectedCombinations = [];

    const pAI = rpiScores["AI"] || 0;
    const pSim = rpiScores["Simulation"] || 0;
    const pPQ = rpiScores["Practice Questions"] || 0;
    const pTB = rpiScores["Textbook"] || 0;
    const pDiag = rpiScores["Diagram"] || 0;
    const pLec = rpiScores["Lecture"] || 0;
    const pExp = rpiScores["Physical Experiment"] || 0;
    const pReal = rpiScores["Real-World Examples"] || 0;
    const pPod = rpiScores["Podcast"] || 0;
    const pPeer = rpiScores["Peer"] || 0;
    const pTut = rpiScores["Tutor"] || 0;
    const pNet = rpiScores["Internet"] || 0;

    // Pola 1: Tech & Applied Interactive
    if ((pAI >= 75 || pSim >= 75) && pPQ >= 75 && pTB <= 35) {
      const c = comboRules.find(r => r.nama_pola.includes("Tech & Applied"));
      if (c) detectedCombinations.push(c);
    }
    // Pola 2: Classical Textual & Theoretical
    if (pTB >= 75 && pDiag >= 75 && pLec >= 65 && pAI <= 35) {
      const c = comboRules.find(r => r.nama_pola.includes("Classical Textual"));
      if (c) detectedCombinations.push(c);
    }
    // Pola 3: Kinesthetic Experiential
    if (pExp >= 75 && pReal >= 75 && pPod <= 35) {
      const c = comboRules.find(r => r.nama_pola.includes("Kinesthetic Experiential"));
      if (c) detectedCombinations.push(c);
    }
    // Pola 4: Social Collaborative Guided
    if (pPeer >= 75 && pTut >= 75 && pNet <= 35) {
      const c = comboRules.find(r => r.nama_pola.includes("Social Collaborative"));
      if (c) detectedCombinations.push(c);
    }

    // 7. Penyusunan Strategy Builder (3-Step Resource Stack)
    const strategyBuilder = {
      opener: top3Primary[0] ? top3Primary[0].nama_resmi : "Video / Pembuka",
      deepDive: top3Primary[1] ? top3Primary[1].nama_resmi : "AI / Diskusi",
      consolidation: (rpiScores["Practice Questions"] >= 60) ? "Practice Questions (Bank Soal)" :
                     (rpiScores["Flashcards"] >= 60) ? "Flashcards (Kartu Kilat)" : "Tutor / Peer Review"
    };

    return {
      isInvalid: false,
      rpiScores: rpiScores,
      resourceRows: resourceRows,
      top3Primary: top3Primary,
      bottom2Avoided: bottom2Avoided,
      categoryScores: categoryScores,
      detectedCombinations: detectedCombinations,
      strategyBuilder: strategyBuilder
    };
  },

  /**
   * Mengirimkan Hasil Rekap KS15 ke Google Apps Script
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const top3Str = evaluationResult.top3Primary.map(m => `${m.resource}: ${m.rpi}%`).join(", ");
    const bot2Str = evaluationResult.bottom2Avoided.map(m => `${m.resource}: ${m.rpi}%`).join(", ");

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
      kode_modul: "KS15",
      skor_mentah: `Top 3: [${top3Str}]`,
      standard_score: `Avoided: [${bot2Str}]`,
      kategori_hasil: `Primary: ${evaluationResult.top3Primary[0] ? evaluationResult.top3Primary[0].resource : 'Netral'}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KS15: Data LRP berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS15:", error);
    }
  }
};
