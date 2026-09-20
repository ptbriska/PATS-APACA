/* ==========================================================================
   PATS PORTAL - AUTHENTICATION MODULE (assets/js/auth.js)
   Sistem Verifikasi Triple-Track (Hybrid Auth):
   - Track 1 (VIP): Token Khusus Ujian dari soal.json (Sekali Pengerjaan)
   - Track 2 (Eceran): Google Apps Script API (Spreadsheet Real-time Check)
   - Track 3 (Master): Token Master Admin/Tester dari soal.json (Bebas Retake)
   ========================================================================== */

const PATS_AUTH = {
  GAS_AUTH_ENDPOINT: "https://script.google.com/macros/s/AKfycbxhJ29sqa5M92O6Xfh1UOo1W7TfKh8BiM2BEnaGtgCPMG4OcBLX7C1rGCTrVtn4au6_/exec",
  SESSION_KEY: "pats_user_session",

  /**
   * Verifikasi Triple-Track
   * @param {string} namaLengkap - Nama Lengkap Peserta / Tester
   * @param {string} kodeInput - Kode Akses / Token Ujian / Token Master
   * @param {string} currentTestCode - Kode Modul Tes saat ini (misal: KK2)
   * @param {object} testInfoFromSoalJson - Object test_info dari file soal.json lokal
   * @returns {Promise<{success: boolean, message: string, data?: object}>}
   */
  async verifyParticipant(namaLengkap, kodeInput, currentTestCode, testInfoFromSoalJson = {}) {
    try {
      const inputNama = (namaLengkap || "").trim();
      const inputKode = (kodeInput || "").trim();

      if (!inputNama || !inputKode) {
        return { success: false, message: "Nama Lengkap dan Kode Akses / Token wajib diisi!" };
      }

      const tokenVip = testInfoFromSoalJson.token_ujian || "";
      const tokenMaster = testInfoFromSoalJson.token_master || "";

      // =========================================================================
      // TRACK 3: JALUR MASTER / TESTER ADMIN (Bebas Retake Berkali-kali)
      // =========================================================================
      if (tokenMaster && inputKode.toUpperCase() === tokenMaster.trim().toUpperCase()) {
        const masterUserData = {
          nama_lengkap: inputNama,
          kode_akses: "MASTER-" + currentTestCode,
          jenis_kelamin: "-",
          asal_daerah: "Umum",
          asal_instansi: "Umum",
          modul_diizinkan: [currentTestCode],
          is_vip: true,
          is_master: true // Marker internal untuk bypass penguncian retake
        };

        // Hapus flag status selesai khusus untuk akun master agar bisa re-take kapan saja
        localStorage.removeItem(`pats_completed_${currentTestCode}`);
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(masterUserData));

        return {
          success: true,
          message: "Login Berhasil via Token Master!",
          data: masterUserData
        };
      }

      // Cek apakah modul ini sudah pernah diselesaikan sebelumnya (Khusus Non-Master)
      const isCompleted = localStorage.getItem(`pats_completed_${currentTestCode}`);
      if (isCompleted === "true") {
        return {
          success: false,
          message: "Anda sudah pernah menyelesaikan tes ini. Tes hanya dapat dikerjakan 1 kali."
        };
      }

      // =========================================================================
      // TRACK 1: JALUR VIP / KOLEKTIF SEKOLAH (Sekali Pengerjaan)
      // =========================================================================
      if (tokenVip && inputKode.toUpperCase() === tokenVip.trim().toUpperCase()) {
        const vipUserData = {
          nama_lengkap: inputNama,
          kode_akses: "VIP-" + currentTestCode,
          jenis_kelamin: "-",
          asal_daerah: "Jalur Kolektif/VIP",
          asal_instansi: "Peserta Kolektif/VIP",
          modul_diizinkan: [currentTestCode],
          is_vip: true,
          is_master: false
        };

        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(vipUserData));
        return {
          success: true,
          message: "Login Berhasil via Token VIP!",
          data: vipUserData
        };
      }

      // =========================================================================
      // TRACK 2: JALUR ECERAN / INDIVIDUAL (Real-time GAS API)
      // =========================================================================
      const endpoint = `${this.GAS_AUTH_ENDPOINT}?nama=${encodeURIComponent(inputNama)}&kode=${encodeURIComponent(inputKode)}&testCode=${encodeURIComponent(currentTestCode)}`;
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Gagal terhubung ke server verifikasi API.");

      const result = await response.json();

      if (result.status === "SUCCESS") {
        result.user.is_master = false;
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(result.user));
        return {
          success: true,
          message: result.message || "Verifikasi berhasil!",
          data: result.user
        };
      } else {
        return {
          success: false,
          message: result.message || "Kombinasi Nama Lengkap atau Kode Akses tidak valid."
        };
      }

    } catch (error) {
      console.error("Auth Error:", error);
      return {
        success: false,
        message: "Terjadi kesalahan sistem atau masalah koneksi internet saat memverifikasi data."
      };
    }
  },

  /**
   * Menandai bahwa modul tes telah diselesaikan (dipanggil saat Submit CBT)
   * @param {string} currentTestCode 
   */
  markAsCompleted(currentTestCode) {
    const user = this.getSession();
    // Akun Master tidak akan dikunci agar bisa terus dites
    if (user && !user.is_master) {
      localStorage.setItem(`pats_completed_${currentTestCode}`, "true");
    }
  },

  getSession() {
    const sessionData = sessionStorage.getItem(this.SESSION_KEY);
    return sessionData ? JSON.parse(sessionData) : null;
  },

  protectCbtPage(currentTestCode) {
    const user = this.getSession();
    if (!user) {
      alert("Sesi pengerjaan tidak ditemukan. Silakan login terlebih dahulu!");
      window.location.href = "index.html";
      return null;
    }

    const allowedList = user.modul_diizinkan || [];
    if (!allowedList.includes(currentTestCode) && !allowedList.includes("ALL")) {
      alert("Akses ditolak! Anda tidak terdaftar untuk modul tes " + currentTestCode);
      window.location.href = "index.html";
      return null;
    }

    return user;
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
  }
};
