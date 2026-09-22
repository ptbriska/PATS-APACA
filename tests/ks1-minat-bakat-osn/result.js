/* ==========================================================================
   PATS PORTAL - REPORT GENERATOR ENGINE (OPTIMIZED RESULT.JS v4.1 - FIXED)
   Mengintegrasikan Total_Scoring dengan 11 Komponen Komprehensif rubrik.json
   ========================================================================== */

// Kamus Pemetaan Kode Bidang Global (Mencegah SyntaxError Redeclaration)
const FIELD_TO_MIN_CODE_MAP = {
  "Matematika": "MIN_MTK",
  "Fisika": "MIN_FIS",
  "Kimia": "MIN_KIM",
  "Biologi": "MIN_BIO",
  "Informatika": "MIN_INF",
  "Astronomi": "MIN_AST",
  "Kebumian": "MIN_KBM",
  "Ekonomi": "MIN_EKO",
  "Geografi": "MIN_GEO",
  "AI & Data Science": "MIN_AI"
};

document.addEventListener("DOMContentLoaded", async () => {
  // Helper aman untuk set innerText/innerHTML
  const setElemText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  };
  const setElemHTML = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };

  // 1. Setup Kop Laporan
  if (typeof PATS_CONFIG !== "undefined" && PATS_CONFIG.organization) {
    const org = PATS_CONFIG.organization;
    setElemText("kop-instansi-nama", org.name || "APACA CONSULTING");
    setElemText("kop-instansi-sub", org.subTitle || "Psychometric & Educational Assessment Center");
    setElemText("kop-instansi-alamat", org.address || "Makassar, Sulawesi Selatan");
    const logoElem = document.getElementById("kop-logo");
    if (logoElem) {
      logoElem.src = org.logoUrl || "../../logo.png";
      logoElem.onerror = () => { logoElem.src = "../../assets/images/logo.png"; };
    }
  }

  // 2. Setup Biodata Peserta
  const user = PATS_AUTH.getSession();
  if (user) {
    setElemText("r-nama", user.nama_lengkap || "Siswa OTM");
    setElemText("r-kode", user.kode_akses || user.kode_kegiatan || "OTM-2026-REG");
    setElemText("r-kelas", user.kelas_jurusan || user.jenis_kelamin || "X / MIPA");
    setElemText("r-instansi", user.asal_instansi || user.sekolah || "SMA Negeri");
    
    if (user.test_info) {
      setElemText("r-psikolog-nama", user.test_info.psikolog_pj || "Dra. Fitriani Rahayu, M.Psi., Psikolog");
      setElemText("r-psikolog-sipp", "SIPP: " + (user.test_info.SIPP || "2026-0819-PSI-01"));
    }
  }
  setElemText("r-tanggal", new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }));

  // 3. Ambil Data Murni dari Session Storage & Total Scoring Engine
  const p1Data = JSON.parse(sessionStorage.getItem("pats_pilar1_results") || "{}");
  const p2Data = JSON.parse(sessionStorage.getItem("pats_pilar2_results") || "{}");
  const p3Data = JSON.parse(sessionStorage.getItem("pats_pilar3_results") || "{}");

  try {
    const resRubrik = await fetch("rubrik.json");
    const rubrikData = await resRubrik.json();

    // Evaluasi Master 3 Pilar
    const evaluation = Total_Scoring.loadAndEvaluateFromSession();
    if (evaluation.isInvalid) {
      alert(evaluation.message);
      return;
    }

    const allRanking = evaluation.all_fields_ranking || [];
    // Deklarasi global top1Field di level fungsi utama agar tidak duplikat
    const top1Field = evaluation.top_recommendation?.bidang || "bidang utama";

    // =========================================================================
    // BAGIAN III: ANALISA PILAR I - IQ APACA OTM & SUB-MODUL KOGNITIF
    // =========================================================================
    let estimasiIQ = 0;
    let iqCategoryLabel = "-";

    if (p1Data && p1Data.module_scores && typeof SCORING_PILAR1 !== "undefined") {
      const iqCalc = SCORING_PILAR1.calculateIQScore(p1Data.module_scores);
      estimasiIQ = iqCalc.iq_score;
      iqCategoryLabel = iqCalc.category;
    } else if (evaluation.iq_summary && evaluation.iq_summary.iq_score) {
      estimasiIQ = evaluation.iq_summary.iq_score;
      iqCategoryLabel = evaluation.iq_summary.category;
    }

    setElemText("r-iq-score", estimasiIQ > 0 ? estimasiIQ : "0");
    setElemText("r-iq-category", iqCategoryLabel);

    const iqNormaList = rubrikData.bagian_03_pilar1_bakat_kognitif?.norma_iq || [];
    const iqObj = iqNormaList.find(k => k.label === iqCategoryLabel);
    setElemText("r-iq-desc", iqObj?.deskripsi || "Kapasitas kognitif murni dalam menyelesaikan tugas penalaran sains.");

    // Tabel Sub-Modul Kognitif
    const modScores = p1Data.module_scores || {};
    const daftarModulRubrik = rubrikData.bagian_03_pilar1_bakat_kognitif?.daftar_modul || {};
    const catatanModulRubrik = rubrikData.bagian_03_pilar1_bakat_kognitif?.matriks_catatan_modul || {};

    setElemHTML("pilar1-table-body", Object.keys(modScores).map(code => {
      const m = modScores[code];
      const modCfg = daftarModulRubrik[code] || {};
      
      let catLabel = "Sedang";
      if (m.final_score >= 80) catLabel = "Sangat Tinggi";
      else if (m.final_score >= 60) catLabel = "Tinggi";
      else if (m.final_score >= 40) catLabel = "Sedang";
      else catLabel = "Kurang";

      const notesObj = catatanModulRubrik[code] || {};
      const noteText = notesObj[catLabel] || notesObj["Cukup"] || modCfg.fokus || "-";

      return `
        <tr>
          <td><strong>${code}</strong></td>
          <td style="text-align: left; font-weight: 600;">${modCfg.nama || code}</td>
          <td>${(m.accuracy_score || 0).toFixed(1)} pts</td>
          <td>${(m.speed_score || 0).toFixed(1)} pts</td>
          <td><strong>${m.final_score || 0}</strong></td>
          <td style="text-align: left; font-size: 0.82rem;">${noteText}</td>
        </tr>
      `;
    }).join(""));

    // Tabel Rekapitulasi Gatekeeper Kognitif OSN
    const implikasiAkademisMap = rubrikData.bagian_03_pilar1_bakat_kognitif?.implikasi_akademis_gatekeeper || {};
    setElemHTML("table-pilar1-gatekeeper", allRanking.map(rec => {
      const skorBakat = rec.skor_pilar1_bakat;
      const isLolos = skorBakat >= 60;
      const statusBadge = isLolos
        ? `<span class="badge-status badge-pass">LOLOS GATEKEEPER</span>`
        : `<span class="badge-status badge-locked">GUGUR</span>`;
      
      let catKognitif = "Kurang";
      if (skorBakat >= 80) catKognitif = "Sangat Tinggi";
      else if (skorBakat >= 60) catKognitif = "Tinggi";
      else if (skorBakat >= 40) catKognitif = "Cukup";

      return `
        <tr>
          <td style="font-weight: 700; text-align: left; color:#1e3a8a;">${rec.bidang}</td>
          <td><strong>${skorBakat}</strong></td>
          <td>${catKognitif}</td>
          <td>${statusBadge}</td>
          <td style="text-align: left; font-size: 0.82rem;">${implikasiAkademisMap[rec.bidang] || "-"}</td>
        </tr>
      `;
    }).join(""));

    // =========================================================================
    // BAGIAN I: RINGKASAN REKOMENDASI 10 BIDANG OSN
    // =========================================================================
    const tindakanKonselingRubrik = rubrikData.bagian_01_ringkasan_rekomendasi?.tindakan_konseling || {};

    setElemHTML("top-3-table-body", allRanking.map((rec, idx) => {
      const isPass = rec.gatekeeper_status === "PASS";
      const gateBadge = isPass 
        ? `<span class="badge-status badge-pass">PASS</span>` 
        : `<span class="badge-status badge-locked">LOCKED</span>`;

      let statusBadge = "";
      let konselingText = "";

      if (!isPass) {
        statusBadge = `<span class="badge-status badge-locked">TIDAK DIREKOMENDASIKAN</span>`;
        konselingText = tindakanKonselingRubrik.locked || "Dilarang Dipilih: Kapasitas kognitif di bawah batas kelayakan minimum.";
      } else if (rec.warning_tag) {
        statusBadge = `<span class="badge-status badge-warning">PERLU PENDAMPINGAN</span>`;
        konselingText = tindakanKonselingRubrik.pendampingan || "Perlu Mentoring: Kognitif lolos tetapi terintimidasi.";
      } else if (idx < 3) {
        statusBadge = `<span style="font-weight: 700; color: #059669;">REKOMENDASI UTAMA (TOP ${idx + 1})</span>`;
        konselingText = tindakanKonselingRubrik.utama || "Pilihan Utama: Kapasitas kognitif, minat, dan resiliensi saling menguatkan.";
      } else {
        statusBadge = `<span style="font-weight: 600; color: #2563eb;">REKOMENDASI ALTERNATIF</span>`;
        konselingText = tindakanKonselingRubrik.alternatif || "Opsi Cadangan: Dapat dipilih jika kuota Top 1–3 di sekolah sudah penuh.";
      }

      return `
        <tr>
          <td><strong>${idx + 1}</strong></td>
          <td style="text-align: left; font-weight: 700; color: #1e3a8a;">${rec.bidang}</td>
          <td><strong>${rec.skor_total}</strong></td>
          <td>${gateBadge}</td>
          <td>${rec.indeks_intimidasi.toFixed(2)}</td>
          <td>${statusBadge}</td>
          <td style="text-align: left; font-size: 0.82rem; line-height: 1.4;">${konselingText}</td>
        </tr>
      `;
    }).join(""));

    // =========================================================================
    // BAGIAN II: VISUALISASI PROFIL COMBINED 3 PILAR
    // =========================================================================
    const chartCanvas = document.getElementById('chartOTM');
    if (chartCanvas) {
      new Chart(chartCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: allRanking.map(r => r.bidang),
          datasets: [
            {
              label: 'Pilar I: Bakat (50%)',
              data: allRanking.map(r => r.skor_pilar1_bakat),
              backgroundColor: '#2563eb',
              borderRadius: 4,
              barPercentage: 0.8,
              categoryPercentage: 0.7
            },
            {
              label: 'Pilar II: Minat (30%)',
              data: allRanking.map(r => r.skor_pilar2_minat),
              backgroundColor: '#059669',
              borderRadius: 4,
              barPercentage: 0.8,
              categoryPercentage: 0.7
            },
            {
              label: 'Pilar III: Comfort (20%)',
              data: allRanking.map(r => r.skor_pilar3_persona),
              backgroundColor: '#d97706',
              borderRadius: 4,
              barPercentage: 0.8,
              categoryPercentage: 0.7
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
                usePointStyle: true,
                padding: 20
              }
            },
            tooltip: {
              padding: 12,
              cornerRadius: 8,
              titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: '700' },
              bodyFont: { family: 'Plus Jakarta Sans', size: 12 }
            }
          },
          scales: {
            x: {
              suggestedMin: 0,
              suggestedMax: 100,
              grid: { color: '#f1f5f9' },
              ticks: { font: { family: 'Plus Jakarta Sans', size: 11 } }
            },
            y: {
              grid: { display: false },
              ticks: { font: { family: 'Plus Jakarta Sans', size: 12, weight: '700' }, color: '#0f172a' }
            }
          }
        }
      });
    }

    // =========================================================================
    // BAGIAN IV: ANALISA PILAR II - MINAT KEILMUAN
    // =========================================================================
    const p2Pure = p2Data.pure_scores || {};
    const p2BidangRubrik = rubrikData.bagian_04_pilar2_minat_keilmuan?.bidang || {};

    setElemHTML("pilar2-table-body", allRanking.map(rec => {
      const skorMinat = rec.skor_pilar2_minat || 0;
      
      const minCode = FIELD_TO_MIN_CODE_MAP[rec.bidang] || rec.field_code || rec.bidang;
      const pureScore = p2Pure[minCode] !== undefined ? p2Pure[minCode] : (p2Pure[rec.bidang] || 0);

      let fitKey = "Rendah";
      let badgeClass = "badge-fit-rendah";
      
      if (skorMinat >= 80.0) {
        fitKey = "Sangat Tinggi";
        badgeClass = "badge-fit-sangat-tinggi";
      } else if (skorMinat >= 65.0) {
        fitKey = "Tinggi";
        badgeClass = "badge-fit-tinggi";
      } else if (skorMinat >= 50.0) {
        fitKey = "Sedang";
        badgeClass = "badge-fit-sedang";
      } else {
        fitKey = "Rendah";
        badgeClass = "badge-fit-rendah";
      }

      const bidangDict = p2BidangRubrik[rec.bidang] || {};
      const infoFit = bidangDict[fitKey] || {};

      return `
        <tr>
          <td style="text-align: left; font-weight: 700; color: #1e3a8a;">${rec.bidang}</td>
          <td>${Number(pureScore).toFixed(1)} pts</td>
          <td><strong>${skorMinat}</strong></td>
          <td><span class="badge-status ${badgeClass}">${infoFit.label || fitKey}</span></td>
          <td style="text-align: left; font-size: 0.82rem; line-height: 1.4;">${infoFit.deskripsi || "-"}</td>
          <td style="text-align: left; font-size: 0.82rem; line-height: 1.4;">${infoFit.implikasi || "-"}</td>
        </tr>
      `;
    }).join(""));

    // =========================================================================
    // BAGIAN V: ANALISA PILAR III - RESILIENSI MENTAL & SCIENCE COMFORT
    // =========================================================================
    const p3Eval = p3Data.field_results || {};
    const p3Rubrik = rubrikData.bagian_05_pilar3_resiliensi?.kategori_resiliensi || {};

    setElemHTML("pilar3-table-body", allRanking.map(rec => {
      const resKey = Object.keys(p3Eval).find(k => p3Eval[k].field_name === rec.bidang || k === rec.bidang || k === rec.field_code);
      const res = resKey ? p3Eval[resKey] : { score_pilar3: rec.skor_pilar3_persona, intimidation_index: rec.indeks_intimidasi };
      
      const scoreP3 = res.score_pilar3 !== undefined ? res.score_pilar3 : (rec.skor_pilar3_persona || 0);
      const intimidationIdx = res.intimidation_index !== undefined ? res.intimidation_index : (rec.indeks_intimidasi || 0);

      let catKey = "Sangat Rentan";
      let statusBadge = `<span class="badge-status badge-warning">[WARNING: BURNOUT]</span>`;

      if (intimidationIdx >= 4.00 && scoreP3 >= 80.0) {
        catKey = "Sangat Siap";
        statusBadge = `<span class="badge-status badge-pass">FIT (HIGH)</span>`;
      } else if (intimidationIdx >= 3.00 && scoreP3 >= 65.0) {
        catKey = "Siap";
        statusBadge = `<span class="badge-status badge-pass">FIT (MODERATE)</span>`;
      } else if (intimidationIdx >= 2.50 && scoreP3 >= 50.0) {
        catKey = "Rentan";
        statusBadge = `<span class="badge-status badge-fit-sedang">FIT (BORDERLINE)</span>`;
      } else {
        catKey = "Sangat Rentan";
        statusBadge = `<span class="badge-status badge-warning">[WARNING: BURNOUT]</span>`;
      }

      const infoResiliensi = p3Rubrik[catKey] || {};

      return `
        <tr>
          <td style="text-align: left; font-weight: 700; color: #1e3a8a;">${rec.bidang}</td>
          <td><strong>${scoreP3}</strong></td>
          <td>${intimidationIdx.toFixed(2)}</td>
          <td>${statusBadge}</td>
          <td style="text-align: left; font-size: 0.82rem; line-height: 1.4;">${infoResiliensi.implikasi || "-"}</td>
        </tr>
      `;
    }).join(""));

    // =========================================================================
    // BAGIAN VI: ANALISA FALSE INTEREST (PROFIL MINAT MURNI VS TERBOBOT)
    // =========================================================================
    const p2PureScores = p2Data.pure_scores || {};
    const profilRubrik = rubrikData.bagian_06_analisa_false_interest?.profil_diagnostik || {};

    const profilGroup = {
      "Genuine Interest": [],
      "Surface Fan": [],
      "Cross-Disciplinary Synergy": []
    };

    allRanking.forEach(rec => {
      const minCode = FIELD_TO_MIN_CODE_MAP[rec.bidang] || rec.field_code || rec.bidang;
      const pureScore = p2PureScores[minCode] !== undefined ? p2PureScores[minCode] : (p2PureScores[rec.bidang] || 0);
      const weightedScore = rec.skor_pilar2_minat || 0;

      if (pureScore >= 65.0 && weightedScore >= 65.0) {
        profilGroup["Genuine Interest"].push(rec.bidang);
      } else if (pureScore >= 65.0 && weightedScore < 65.0) {
        profilGroup["Surface Fan"].push(rec.bidang);
      } else if (pureScore < 65.0 && weightedScore >= 65.0) {
        profilGroup["Cross-Disciplinary Synergy"].push(rec.bidang);
      }
    });

    const urutanProfil = ["Genuine Interest", "Surface Fan", "Cross-Disciplinary Synergy"];

    setElemHTML("table-pilar2-klaster", urutanProfil.map(namaProfil => {
      const bidangTerkait = profilGroup[namaProfil] || [];
      const infoProfil = profilRubrik[namaProfil] || {};

      const fieldBadges = bidangTerkait.length > 0 
        ? bidangTerkait.map(b => `<span class="tag-pill" style="margin-bottom:4px;">${b}</span>`).join(" ")
        : '<em style="font-size:0.78rem; color:#94a3b8;">Tidak ada bidang</em>';

      return `
        <tr>
          <td style="font-weight: 800; color: #0f172a; text-align: left;">
            <div>${infoProfil.label || namaProfil}</div>
            <div style="font-size: 0.74rem; font-weight: 600; color: #64748b; margin-top: 2px;">${infoProfil.sub_label || ''}</div>
          </td>
          <td style="text-align: left;">${fieldBadges}</td>
          <td style="text-align: left; font-size: 0.82rem; line-height: 1.4;">${infoProfil.diagnostik || "-"}</td>
          <td style="text-align: left; font-size: 0.82rem; line-height: 1.4;">${infoProfil.konseling || "-"}</td>
        </tr>
      `;
    }).join(""));

    // =========================================================================
    // BAGIAN VII: ANALISA KARAKTER KEILMUAN SISWA
    // =========================================================================
    const sinergiMap = rubrikData.bagian_07_karakter_keilmuan?.sinergi_kognitif || {};
    setElemHTML("table-karakter-keilmuan", allRanking.slice(0, 5).map(rec => `
      <tr>
        <td style="font-weight: 700; text-align: left; color:#1e3a8a;">${rec.bidang}</td>
        <td style="text-align: left; font-size: 0.85rem; line-height: 1.5;">${sinergiMap[rec.bidang] || "-"}</td>
      </tr>
    `).join(""));

    // =========================================================================
    // BAGIAN VIII: MATRIKS KELAYAKAN PEMBINAAN SEKOLAH (INVESTABILITY INDEX)
    // =========================================================================
    const roiRubrikDef = rubrikData.bagian_08_matriks_kelayakan_roi?.kuadran_definition || {};

    const quadrantFieldsMap = { I: [], II: [], III: [], IV: [] };

    allRanking.forEach(rec => {
      // Menggunakan rumus S-Total (skor_total >= 60.0)
      const isPassTotal = rec.skor_total >= 60.0;
      const isFit = rec.indeks_intimidasi >= 3.0;

      if (isPassTotal && isFit) quadrantFieldsMap.I.push(rec);
      else if (isPassTotal && !isFit) quadrantFieldsMap.II.push(rec);
      else if (!isPassTotal && isFit) quadrantFieldsMap.III.push(rec);
      else quadrantFieldsMap.IV.push(rec);
    });

    ["I", "II", "III", "IV"].forEach(qKey => {
      const qDef = roiRubrikDef[qKey] || {};
      const fieldsInQ = quadrantFieldsMap[qKey] || [];
      const isTop1Here = fieldsInQ.some(r => r.bidang === top1Field);

      let top1PlotBadge = "";
      if (isTop1Here) {
        top1PlotBadge = `
          <div style="background: linear-gradient(135deg, #2563eb, #0284c7); color: #ffffff; padding: 6px 12px; border-radius: 20px; font-weight: 800; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3); margin-bottom: 8px;">
            🎯 PLOT UTAMA TOP 1: ${top1Field}
          </div>
        `;
      }

      const fieldPillsHTML = fieldsInQ.map(r => {
        const isTop1 = r.bidang === top1Field;
        const style = isTop1 
          ? "background: #1e3a8a; color: #ffffff; font-weight: 800; border: 1px solid #1e3a8a;"
          : "background: #ffffff; color: #334155; font-weight: 600; border: 1px solid #cbd5e1;";
        return `<span class="tag-pill" style="${style}">${r.bidang} (${r.skor_total})</span>`;
      }).join(" ");

      setElemHTML(`quadrant-cell-${qKey}`, `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <strong style="font-size: 0.85rem; color: #0f172a;">${qDef.label || 'KUADRAN ' + qKey}</strong>
        </div>
        ${top1PlotBadge}
        <div style="font-size: 0.8rem; color: #475569; margin-bottom: 8px; line-height: 1.4;">
          ${qDef.profil || ''}
        </div>
        <div style="margin-top: 6px;">
          <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Bidang Siswa di Kuadran ini:</div>
          ${fieldPillsHTML || '<em style="font-size: 0.78rem; color: #94a3b8;">Tidak ada bidang</em>'}
        </div>
      `);
    });

    setElemHTML("table-matriks-roi-body", ["I", "II", "III", "IV"].map(qKey => {
      const qDef = roiRubrikDef[qKey] || {};
      const fieldsInQ = quadrantFieldsMap[qKey] || [];
      const fieldListNames = fieldsInQ.map(r => r.bidang).join(", ") || "-";

      return `
        <tr>
          <td><strong>${qKey}</strong></td>
          <td style="font-size: 0.82rem; font-weight: 600;">
            <div>${qDef.sumbu_kognitif || ''}</div>
            <div style="color: #64748b; margin-top: 2px;">${qDef.sumbu_resiliensi || ''}</div>
          </td>
          <td>
            <span class="tag-pill" style="font-weight: 700;">${qDef.label || ''}</span>
          </td>
          <td style="text-align: left; font-size: 0.82rem; line-height: 1.4;">
            <div>${qDef.profil || ''}</div>
            <div style="margin-top: 4px; font-weight: 700; color: #1e3a8a;">
              Bidang: <span style="font-weight: 500; color: #334155;">${fieldListNames}</span>
            </div>
          </td>
          <td style="text-align: left; font-size: 0.82rem; line-height: 1.4;">
            ${qDef.implikasi || ''}
          </td>
        </tr>
      `;
    }).join(""));

    // =========================================================================
    // BAGIAN IX: PROYEKSI PROGRAM STUDI & KARIER MASA DEPAN
    // =========================================================================
    const proyeksiMap = rubrikData.bagian_09_proyeksi_studi_karier?.data_proyeksi || {};
    setElemHTML("career-projection-container", allRanking.slice(0, 3).map(rec => {
      if (!rec) return "";
      const pInfo = proyeksiMap[rec.bidang] || { kuliah: [], karir: [] };

      return `
        <div class="info-box">
          <h5 style="margin:0 0 8px 0; color:#1e3a8a; font-size:0.95rem;">🎯 Proyeksi Bidang ${rec.bidang}</h5>
          <div style="font-size:0.85rem; margin-bottom:6px;"><strong>Proyeksi Program Studi:</strong> ${(pInfo.kuliah || []).join(", ")}</div>
          <div style="font-size:0.85rem;"><strong>Proyeksi Karir Masa Depan:</strong> ${(pInfo.karir || []).join(", ")}</div>
        </div>
      `;
    }).join(""));

    // =========================================================================
    // BAGIAN X: PANDUAN REKOMENDASI AKSI STRATEGIS
    // =========================================================================
    const panduanAksi = rubrikData.bagian_10_panduan_aksi?.rekomendasi || {};

    // Helper merender array/string menjadi bullet list HTML
    const renderBulletList = (dataInput, placeholderField) => {
      if (!dataInput) return "-";
      
      const items = Array.isArray(dataInput) ? dataInput : [dataInput];
      const listHTML = items.map(text => {
        const cleanedText = text.replace(/\[BIDANG_UTAMA\]/g, `<strong>${placeholderField}</strong>`);
        return `<li style="margin-bottom: 6px;">${cleanedText}</li>`;
      }).join("");

      return `<ul style="margin: 4px 0 0 18px; padding: 0; font-size: 0.85rem; color: #334155; line-height: 1.5;">${listHTML}</ul>`;
    };

    setElemHTML("rec-guru", renderBulletList(panduanAksi.guru, top1Field));
    setElemHTML("rec-siswa", renderBulletList(panduanAksi.siswa, top1Field));
    setElemHTML("rec-ortu", renderBulletList(panduanAksi.ortu, top1Field));

    // =========================================================================
    // BAGIAN XI: ROADMAP PEMBINAAN STRATEGIS 8 BULAN (TAKTIK MEDALIS)
    // =========================================================================
    const roadmapMaster = rubrikData.bagian_11_roadmap_8_bulan || {};
    const top1BidangNama = evaluation.top_recommendation?.bidang || "Matematika";
    
    // Ambil data roadmap spesifik bidang Top 1 (fallback ke Matematika jika tidak terdaftar)
    const bidangRoadmapData = roadmapMaster[top1BidangNama] || roadmapMaster["Matematika"] || {};
    const listBulan = bidangRoadmapData.roadmap || [];

    // Render Info Header Karakter Bidang
    setElemText("top1-bidang-title", `BIDANG PRIORITAS UTAMA: ${top1BidangNama.toUpperCase()}`);
    setElemText("top1-bidang-karakter", `Metode pendekatan pembinaan disesuaikan dengan karakter bidang ${top1BidangNama}: "${bidangRoadmapData.karakter || 'Pendekatan Komprehensif Theory & Drill'}"`);

    // Render 8 Kartu Bulan
    const roadmapCardsHTML = listBulan.map(item => `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid #2563eb; border-radius: 10px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <!-- Badge Bulan & Fokus -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="background: #1e3a8a; color: #ffffff; font-size: 0.72rem; font-weight: 800; padding: 3px 10px; border-radius: 12px; text-transform: uppercase;">BULAN ${item.bulan}</span>
            <span style="font-size: 0.72rem; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 6px;">${item.target_to}</span>
          </div>

          <h5 style="margin: 0 0 6px 0; color: #0f172a; font-size: 0.92rem; font-weight: 700;">${item.fokus}</h5>
          
          <div style="font-size: 0.82rem; color: #475569; margin-bottom: 10px; line-height: 1.4;">
            <strong>Materi Kunci:</strong> ${item.materi}
          </div>
        </div>

        <div style="border-top: 1px dashed #e2e8f0; padding-top: 10px; margin-top: 8px;">
          <!-- Target Metric Badges -->
          <div style="font-size: 0.78rem; font-weight: 700; color: #059669; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
            🎯 Target Drill: ${item.target_soal}
          </div>
          <!-- Monthly To-Do -->
          <div style="font-size: 0.78rem; color: #334155; background: #f8fafc; padding: 8px; border-radius: 6px; border-left: 3px solid #059669; line-height: 1.3;">
            <strong>Monthly To-Do:</strong> ${item.todo}
          </div>
        </div>
      </div>
    `).join("");

    setElemHTML("roadmap-8bulan-container", roadmapCardsHTML);

  } catch (err) {
    console.error("Gagal memuat data Laporan OTM:", err);
    alert("Terjadi kesalahan saat menyusun berkas Laporan OTM. Pastikan Anda telah menyelesaikan ketiga pilar.");
  }
});

/* ==========================================================================
   PATS PORTAL - AUTOMATED REKAP SYSTEM (UNIFIED FORMAT_C ADAPTER)
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

(function initAutoArchiveFORMAT_C() {
  async function sendToSpreadsheet() {
    if (sessionStorage.getItem("pats_archived_success")) {
      console.log("[AUTO-ARCHIVE]: Data rekap siswa ini sudah tersimpan di Spreadsheet.");
      return;
    }

    try {
      const user = typeof PATS_AUTH !== "undefined" ? PATS_AUTH.getSession() : null;
      const evaluation = typeof Total_Scoring !== "undefined" ? Total_Scoring.loadAndEvaluateFromSession() : null;

      if (!user || !evaluation || evaluation.isInvalid) {
        console.warn("[AUTO-ARCHIVE]: Data sesi belum lengkap, pengarsipan dibatalkan.");
        return;
      }

      const top1 = evaluation.top_recommendation || {};
      const top2 = evaluation.secondary_recommendation || {};
      const iqSum = evaluation.iq_summary || {};
      const allRanking = evaluation.all_fields_ranking || [];

      // Helper Format Desimal Indonesia (77.35 -> "77,35")
      const fmt = (val) => Number(val || 0).toFixed(2).replace('.', ',');

      // Peta Skor 10 Bidang OSN & AI (Format Desimal Koma)
      const scoreMap = {};
      allRanking.forEach(r => {
        scoreMap[r.bidang] = fmt(r.skor_total);
      });

      // Evaluasi Kuadran & Status Decision Dashboard
      const isPassGatekeeper = top1.gatekeeper_status === "PASS";
      const isPassTotal = (top1.skor_total || 0) >= 60.0 && isPassGatekeeper;
      const isFit = (top1.indeks_intimidasi || 0) >= 3.00 && !top1.warning_tag;

      let kuadran = "KUADRAN I";
      let decisionStatus = "High Priority (High ROI)";

      if (isPassTotal && isFit) {
        kuadran = "KUADRAN I";
        decisionStatus = "High Priority (High ROI)";
      } else if (isPassTotal && !isFit) {
        kuadran = "KUADRAN II";
        decisionStatus = "Mental Mentoring Needed";
      } else if (!isPassTotal && isFit) {
        kuadran = "KUADRAN III";
        decisionStatus = "Kuda Hitam / Matrikulasi";
      } else {
        kuadran = "KUADRAN IV";
        decisionStatus = "High Risk / Low ROI";
      }

      const payload = {
        test_code: "KS1",
        kode_modul: "KS1",
        timestamp: new Date().toISOString(),
        kode_akses: user.kode_akses || user.kode_kegiatan || "OTM-2026-REG",
        nama_lengkap: user.nama_lengkap || "Siswa OTM",
        asal_instansi: user.asal_instansi || user.sekolah || "SMA Negeri",
        daerah: user.kelas_jurusan || user.jenis_kelamin || "-",
        
        // Data IQ APACA OTM
        iq_score: iqSum.iq_score || 0,
        iq_category: iqSum.category || "-",

        // Field Rekomendasi Top 1 & Dashboard
        top_1_bidang: top1.bidang || "-",
        top_1_skor_bakat: fmt(top1.skor_pilar1_bakat),
        top_1_skor_minat: fmt(top1.skor_pilar2_minat),
        top_1_skor_comfort: fmt(top1.skor_pilar3_persona),
        top_1_score: fmt(top1.skor_total),
        top_1_status: isPassGatekeeper ? "PASS" : "LOCKED",
        top_1_indeks_intimidasi: `${fmt(top1.indeks_intimidasi)} (${isFit ? 'FIT' : 'BURNOUT'})`,
        top_1_warning_tag: top1.warning_tag ? "WARNING (BURNOUT)" : "FIT",
        pemetaan_kuadran: kuadran,
        status_decision: decisionStatus,

        // Field Rekomendasi Top 2
        top_2_bidang: top2.bidang || "-",
        top_2_score: fmt(top2.skor_total),

        // Rincian Skor 10 Bidang Individual
        SCORE_MATEMATIKA: scoreMap["Matematika"] || "0,00",
        SCORE_FISIKA: scoreMap["Fisika"] || "0,00",
        SCORE_KIMIA: scoreMap["Kimia"] || "0,00",
        SCORE_BIOLOGI: scoreMap["Biologi"] || "0,00",
        SCORE_INFORMATIKA: scoreMap["Informatika"] || "0,00",
        SCORE_ASTRONOMI: scoreMap["Astronomi"] || "0,00",
        SCORE_KEBUMIAN: scoreMap["Kebumian"] || "0,00",
        SCORE_EKONOMI: scoreMap["Ekonomi"] || "0,00",
        SCORE_GEOGRAFI: scoreMap["Geografi"] || "0,00",
        SCORE_AI_DATA_SCIENCE: scoreMap["AI & Data Science"] || "0,00",

        full_json_dump: JSON.stringify(evaluation)
      };

      await fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      sessionStorage.setItem("pats_archived_success", "true");
      console.log("[AUTO-ARCHIVE SUCCESS]: Rekap gabungan tersimpan di Spreadsheet.", payload);

    } catch (err) {
      console.error("[AUTO-ARCHIVE ERROR]: Gagal mengirim data ke GAS:", err);
    }
  }

  window.addEventListener("load", () => {
    setTimeout(sendToSpreadsheet, 1000);
  });
})();
