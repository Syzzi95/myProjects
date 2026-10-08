"use strict";
    (() => {
      /* ---------------- Constants & state ---------------- */
      const STORAGE_KEYS = {
        stats: "pomodoro.stats.v1",
        theme: "pomodoro.theme.v1",
        mode: "pomodoro.mode.v1",
        focusMinutes: "pomodoro.focusMinutes.v1",
      };
      const ALLOWED_FOCUS_MINUTES = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
      const DEFAULT_FOCUS_MINUTES = 25;

      // MODES.focus.minutes is mutable based on user's length selection
      const MODES = {
        focus: { minutes: DEFAULT_FOCUS_MINUTES, label: "Focus" },
        short: { minutes: 5,  label: "Short break" },
        long:  { minutes: 15, label: "Long break" },
      };
      const RING_CIRCUMFERENCE = 2 * Math.PI * 54; // matches r=54 in SVG

      let currentMode = "focus";
      let totalSeconds = MODES.focus.minutes * 60;
      let remainingSeconds = totalSeconds;
      let isRunning = false;
      let endTimestamp = 0;   // wall-clock target time (ms) when running
      let tickHandle = null;

      /* ---------------- DOM ---------------- */
      const digitsEl = document.querySelector("#digits");
      const modeLabelEl = document.querySelector("#modeLabel");
      const progressEl = document.querySelector("#progress");
      const startPauseBtn = document.querySelector("#startPause");
      const startPauseLabel = document.querySelector("#startPauseLabel");
      const resetBtn = document.querySelector("#reset");
      const modesContainer = document.querySelector(".modes");
      const lengthPickerEl = document.querySelector("#lengthPicker");
      const lengthOptionsEl = lengthPickerEl.querySelector(".length-options");
      const statFocusEl = document.querySelector("#statFocus");
      const statShortEl = document.querySelector("#statShort");
      const statLongEl = document.querySelector("#statLong");
      const resetStatsBtn = document.querySelector("#resetStats");
      const themeToggleBtn = document.querySelector("#themeToggle");
      const themeIconEl = document.querySelector("#themeIcon");
      const themeLabelEl = document.querySelector("#themeLabel");
      const toastEl = document.querySelector("#toast");

      /* ---------------- Stats (localStorage) ---------------- */
      const loadStats = () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEYS.stats);
          if (!raw) return { focus: 0, short: 0, long: 0 };
          const parsed = JSON.parse(raw);
          return {
            focus: Number(parsed.focus) || 0,
            short: Number(parsed.short) || 0,
            long:  Number(parsed.long)  || 0,
          };
        } catch { return { focus: 0, short: 0, long: 0 }; }
      };
      let stats = loadStats();

      const saveStats = () => {
        try { localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats)); }
        catch { /* storage may be unavailable; ignore */ }
      };
      const renderStats = () => {
        statFocusEl.textContent = stats.focus;
        statShortEl.textContent = stats.short;
        statLongEl.textContent  = stats.long;
      };

      /* ---------------- Theme ---------------- */
      const applyTheme = (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        const isDark = theme === "dark";
        themeIconEl.textContent = isDark ? "☀️" : "🌙";
        themeLabelEl.textContent = isDark ? "Light" : "Dark";
        themeToggleBtn.setAttribute("aria-label",
          `Switch to ${isDark ? "light" : "dark"} theme`);
      };
      const initTheme = () => {
        let theme = null;
        try { theme = localStorage.getItem(STORAGE_KEYS.theme); } catch {}
        if (!theme) {
          theme = window.matchMedia?.("(prefers-color-scheme: dark)").matches
            ? "dark" : "light";
        }
        applyTheme(theme);
      };
      const toggleTheme = () => {
        const next = document.documentElement.getAttribute("data-theme") === "dark"
          ? "light" : "dark";
        applyTheme(next);
        try { localStorage.setItem(STORAGE_KEYS.theme, next); } catch {}
      };

      /* ---------------- Rendering ---------------- */
      const formatTime = (secs) => {
        const s = Math.max(0, Math.ceil(secs));
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
      };
      const renderTime = () => {
        digitsEl.textContent = formatTime(remainingSeconds);
        document.title = `${formatTime(remainingSeconds)} · ${MODES[currentMode].label}`;
        const ratio = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
        const offset = RING_CIRCUMFERENCE * (1 - ratio);
        progressEl.setAttribute("stroke-dasharray", RING_CIRCUMFERENCE.toFixed(3));
        progressEl.setAttribute("stroke-dashoffset", offset.toFixed(3));
      };
      const renderModeButtons = () => {
        modesContainer.querySelectorAll(".mode-btn").forEach((btn) => {
          const isActive = btn.dataset.mode === currentMode;
          btn.setAttribute("aria-pressed", isActive ? "true" : "false");
          // Keep the focus tab label in sync with current focus length
          if (btn.dataset.mode === "focus") {
            btn.textContent = `Focus · ${MODES.focus.minutes}`;
          }
        });
        modeLabelEl.textContent = MODES[currentMode].label;
        // Hide length picker when not on focus mode
        lengthPickerEl.style.display = currentMode === "focus" ? "" : "none";
      };
      const renderLengthButtons = () => {
        lengthOptionsEl.querySelectorAll(".length-btn").forEach((btn) => {
          const mins = Number(btn.dataset.minutes);
          btn.setAttribute("aria-checked", mins === MODES.focus.minutes ? "true" : "false");
        });
      };

      /* ---------------- Focus length management ---------------- */
      const setFocusLength = (minutes) => {
        const m = Number(minutes);
        if (!ALLOWED_FOCUS_MINUTES.includes(m)) return;
        MODES.focus.minutes = m;
        try { localStorage.setItem(STORAGE_KEYS.focusMinutes, String(m)); } catch {}
        renderLengthButtons();
        if (currentMode === "focus") {
          stopTimer(false);
          totalSeconds = m * 60;
          remainingSeconds = totalSeconds;
          renderModeButtons();
          renderTime();
        } else {
          renderModeButtons();
        }
        showToast(`Focus length set to ${m} min`);
      };

      /* ---------------- Mode management ---------------- */
      const setMode = (mode) => {
        if (!MODES[mode]) return;
        currentMode = mode;
        totalSeconds = MODES[mode].minutes * 60;
        remainingSeconds = totalSeconds;
        try { localStorage.setItem(STORAGE_KEYS.mode, mode); } catch {}
        stopTimer(false);
        renderModeButtons();
        renderTime();
      };

      /* ---------------- Timer engine ---------------- */
      const tick = () => {
        const now = Date.now();
        remainingSeconds = Math.max(0, (endTimestamp - now) / 1000);
        renderTime();
        if (remainingSeconds <= 0) {
          completeSession();
        }
      };
      const startTimer = () => {
        if (isRunning) return;
        isRunning = true;
        endTimestamp = Date.now() + remainingSeconds * 1000;
        tickHandle = setInterval(tick, 250);
        startPauseLabel.textContent = "Pause";
        startPauseBtn.setAttribute("aria-label", "Pause timer");
        startPauseBtn.querySelector(".icon").innerHTML =
          '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
      };
      const pauseTimer = () => {
        if (!isRunning) return;
        isRunning = false;
        clearInterval(tickHandle);
        tickHandle = null;
        remainingSeconds = Math.max(0, (endTimestamp - Date.now()) / 1000);
        startPauseLabel.textContent = "Start";
        startPauseBtn.setAttribute("aria-label", "Start timer");
        startPauseBtn.querySelector(".icon").innerHTML = '<path d="M8 5v14l11-7z"/>';
        renderTime();
      };
      const stopTimer = (resetToTotal = true) => {
        pauseTimer();
        if (resetToTotal) {
          remainingSeconds = totalSeconds;
          renderTime();
        }
      };
      const toggleStartPause = () => (isRunning ? pauseTimer() : startTimer());

      /* ---------------- Session completion ---------------- */
      const completeSession = () => {
        pauseTimer();
        remainingSeconds = 0;
        renderTime();
        stats[currentMode] = (stats[currentMode] || 0) + 1;
        saveStats();
        renderStats();
        beep();
        showToast(`${MODES[currentMode].label} complete! 🎉`);
        const next = currentMode === "focus" ? "short" : "focus";
        setMode(next);
      };

      /* ---------------- Audio beep (WebAudio, no external file) ---------------- */
      let audioCtx = null;
      const beep = () => {
        try {
          audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
          const playTone = (freq, start, duration, gainValue = 0.18) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, audioCtx.currentTime + start);
            gain.gain.linearRampToValueAtTime(gainValue, audioCtx.currentTime + start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + start + duration);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + start);
            osc.stop(audioCtx.currentTime + start + duration + 0.02);
          };
          playTone(880, 0.00, 0.25);
          playTone(1175, 0.28, 0.25);
          playTone(1568, 0.56, 0.40);
        } catch { /* audio not available — fail silently */ }
      };

      /* ---------------- Toast ---------------- */
      let toastTimer = null;
      const showToast = (msg) => {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
      };

      /* ---------------- Event delegation ---------------- */
      modesContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".mode-btn");
        if (!btn) return;
        setMode(btn.dataset.mode);
      });

      lengthOptionsEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".length-btn");
        if (!btn) return;
        setFocusLength(btn.dataset.minutes);
      });

      startPauseBtn.addEventListener("click", toggleStartPause);
      resetBtn.addEventListener("click", () => {
        stopTimer(true);
        showToast("Timer reset");
      });

      resetStatsBtn.addEventListener("click", () => {
        stats = { focus: 0, short: 0, long: 0 };
        saveStats();
        renderStats();
        showToast("Statistics cleared");
      });

      themeToggleBtn.addEventListener("click", toggleTheme);

      // Keyboard shortcuts: Space (start/pause), R (reset), 1/2/3 (modes)
      document.addEventListener("keydown", (e) => {
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (e.code === "Space") { e.preventDefault(); toggleStartPause(); }
        else if (e.key === "r" || e.key === "R") { stopTimer(true); }
        else if (e.key === "1") { setMode("focus"); }
        else if (e.key === "2") { setMode("short"); }
        else if (e.key === "3") { setMode("long"); }
      });

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && isRunning) tick();
      });

      /* ---------------- Init ---------------- */
      initTheme();

      // Restore saved focus length
      try {
        const savedLen = Number(localStorage.getItem(STORAGE_KEYS.focusMinutes));
        if (ALLOWED_FOCUS_MINUTES.includes(savedLen)) {
          MODES.focus.minutes = savedLen;
        }
      } catch {}

      // Restore saved mode
      const savedMode = (() => {
        try { return localStorage.getItem(STORAGE_KEYS.mode); } catch { return null; }
      })();
      if (savedMode && MODES[savedMode]) currentMode = savedMode;

      totalSeconds = MODES[currentMode].minutes * 60;
      remainingSeconds = totalSeconds;
      renderModeButtons();
      renderLengthButtons();
      renderTime();
      renderStats();
    })();