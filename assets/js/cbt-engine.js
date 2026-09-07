/* ==========================================================================
   PATS PORTAL - CBT ENGINE CORE (cbt-engine.js)
   ========================================================================== */

class CBTEngine {
  /**
   * @param {object} config - Konfigurasi CBT ({ testCode, timeLimitMinutes, questions, onTimeout, onSave })
   */
  constructor(config) {
    this.testCode = config.testCode;
    this.timeLimitMinutes = config.timeLimitMinutes;
    this.questions = config.questions || [];
    this.onTimeout = config.onTimeout || (() => {});
    this.onSave = config.onSave || (() => {});

    this.currentIndex = 0;
    this.answers = {};
    this.timerInterval = null;
    this.storageKey = `pats_answers_${this.testCode}`;
    this.timerKey = `pats_timer_${this.testCode}`;

    this.init();
  }

  init() {
    // Restore jawaban tersimpan jika ada
    const savedAnswers = localStorage.getItem(this.storageKey);
    if (savedAnswers) {
      this.answers = JSON.parse(savedAnswers);
    }
  }

  // --- LOGIC TIMER ---
  startTimer(displayElementId) {
    const display = document.getElementById(displayElementId);
    let remainingTime = localStorage.getItem(this.timerKey);

    if (!remainingTime) {
      remainingTime = this.timeLimitMinutes * 60;
    } else {
      remainingTime = parseInt(remainingTime, 10);
    }

    this.timerInterval = setInterval(() => {
      if (remainingTime <= 0) {
        clearInterval(this.timerInterval);
        localStorage.removeItem(this.timerKey);
        if (display) display.innerText = "00:00";
        this.onTimeout();
        return;
      }

      remainingTime--;
      localStorage.setItem(this.timerKey, remainingTime);

      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;

      if (display) {
        display.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  // --- LOGIC NAVIGASI & JAWABAN ---
  saveAnswer(questionId, value) {
    this.answers[questionId] = value;
    localStorage.setItem(this.storageKey, JSON.stringify(this.answers));
    this.onSave(this.answers);
  }

  getAnswers() {
    return this.answers;
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      return true;
    }
    return false;
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return true;
    }
    return false;
  }

  jumpToQuestion(index) {
    if (index >= 0 && index < this.questions.length) {
      this.currentIndex = index;
      return true;
    }
    return false;
  }

  clearSessionData() {
    this.stopTimer();
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.timerKey);
  }
}
