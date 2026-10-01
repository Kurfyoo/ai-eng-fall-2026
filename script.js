(function () {
  "use strict";

  const WORK_TARGETS = { low: 45, medium: 30, high: 20 };
  const SHORT_BREAKS = { low: 5, medium: 10, high: 15 };
  const LONG_BREAKS = { low: 30, medium: 45, high: 60 };
  const ASSIGNMENT_MINUTES = { easy: 30, medium: 45, hard: 60 };
  const MIN_WORK_MINUTES = 15;
  const MAX_WORK_MINUTES = 720;

  function distributeWork(totalMinutes, targetMinutes) {
    if (!Number.isInteger(totalMinutes) || totalMinutes < MIN_WORK_MINUTES || totalMinutes > MAX_WORK_MINUTES) {
      throw new RangeError("Work time must be a whole number from 15 to 720 minutes.");
    }

    const periodCount = Math.min(
      Math.ceil(totalMinutes / targetMinutes),
      Math.floor(totalMinutes / MIN_WORK_MINUTES)
    );
    const workLengths = Array(periodCount).fill(targetMinutes);
    let remaining = totalMinutes - targetMinutes * periodCount;

    if (remaining >= 0) {
      workLengths[workLengths.length - 1] += remaining;
      return workLengths;
    }

    let deficit = -remaining;
    for (let index = workLengths.length - 1; index >= 0 && deficit > 0; index -= 1) {
      const reducible = workLengths[index] - MIN_WORK_MINUTES;
      const reduction = Math.min(deficit, reducible);
      workLengths[index] -= reduction;
      deficit -= reduction;
    }

    if (deficit > 0) throw new Error("Unable to distribute work into valid periods.");
    return workLengths;
  }

  function buildSchedule(totalWorkMinutes, tiredness) {
    if (!Object.prototype.hasOwnProperty.call(WORK_TARGETS, tiredness)) {
      throw new RangeError("Choose a tiredness level to build the schedule.");
    }

    const targetWork = WORK_TARGETS[tiredness];
    const workLengths = distributeWork(totalWorkMinutes, targetWork);
    const longBreakEvery = targetWork >= 35 ? 3 : 4;
    const periods = [];
    let workNumber = 0;

    workLengths.forEach((minutes, index) => {
      workNumber += 1;
      periods.push({ type: "work", label: `Work period ${String(workNumber).padStart(2, "0")}`, minutes });

      if (index === workLengths.length - 1) return;

      const completedCycles = index + 1;
      const isLongBreak = completedCycles % longBreakEvery === 0;
      periods.push({
        type: isLongBreak ? "longBreak" : "shortBreak",
        label: isLongBreak ? "Long break" : "Short break",
        minutes: isLongBreak ? LONG_BREAKS[tiredness] : SHORT_BREAKS[tiredness]
      });
    });

    return { totalWorkMinutes, workCount: workLengths.length, longBreakEvery, periods };
  }

  function validateDigits(value, minimum, maximum) {
    const trimmed = value.trim();
    if (!trimmed) return { error: "Enter a number to continue." };
    if (!/^\d+$/.test(trimmed)) return { error: "Use digits only, with no units or decimal places." };

    const number = Number(trimmed);
    if (number < minimum || number > maximum) {
      return { error: `Enter a number from ${minimum} to ${maximum}.` };
    }

    return { value: number };
  }

  function initializeApp() {
    const form = document.getElementById("session-form");
    const timeFields = document.getElementById("time-fields");
    const assignmentFields = document.getElementById("assignment-fields");
    const workMinutesInput = document.getElementById("work-minutes");
    const assignmentCountInput = document.getElementById("assignment-count");
    const emptyState = document.getElementById("empty-state");
    const sessionContent = document.getElementById("session-content");
    const sessionDisplay = document.querySelector(".timer-display");
    const scheduleList = document.getElementById("schedule-list");
    const startButton = document.getElementById("start-button");
    const pauseButton = document.getElementById("pause-button");
    const resetButton = document.getElementById("reset-button");
    const clock = document.getElementById("timer-clock");
    const progress = document.getElementById("timer-progress");
    const progressFill = document.getElementById("progress-fill");
    const statusLabel = document.getElementById("timer-status");
    const periodLabel = document.getElementById("period-label");
    const periodDetail = document.getElementById("period-detail");
    const totalDetail = document.getElementById("total-detail");
    const scheduleSummary = document.getElementById("schedule-summary");
    const formMessage = document.getElementById("form-message");
    const alarmToggle = document.getElementById("alarm-enabled");
    const themeToggle = document.getElementById("theme-toggle");
    const errorElements = {
      time: document.getElementById("time-error"),
      count: document.getElementById("count-error"),
      difficulty: document.getElementById("difficulty-error"),
      tiredness: document.getElementById("tiredness-error")
    };

    let schedule = null;
    let phaseIndex = 0;
    let timerState = "ready";
    let remainingMs = 0;
    let deadline = 0;
    let timerHandle = null;
    let audioContext = null;

    function activeMode() {
      return form.querySelector('input[name="mode"]:checked').value;
    }

    function clearErrors() {
      Object.values(errorElements).forEach((element) => { element.textContent = ""; });
      [workMinutesInput, assignmentCountInput].forEach((input) => input.removeAttribute("aria-invalid"));
      formMessage.textContent = "";
    }

    function setError(element, message, input) {
      element.textContent = message;
      if (input) input.setAttribute("aria-invalid", "true");
    }

    function toggleMode() {
      const mode = activeMode();
      const timeMode = mode === "time";
      timeFields.hidden = !timeMode;
      assignmentFields.hidden = timeMode;
      workMinutesInput.disabled = !timeMode;
      assignmentCountInput.disabled = timeMode;
      formMessage.textContent = "";
      clearErrors();
    }

    function checkedValue(name) {
      return form.querySelector(`input[name="${name}"]:checked`)?.value ?? "";
    }

    function chosenWorkload() {
      if (activeMode() === "time") {
        const result = validateDigits(workMinutesInput.value, MIN_WORK_MINUTES, MAX_WORK_MINUTES);
        if (result.error) setError(errorElements.time, result.error, workMinutesInput);
        return result.value;
      }

      const countResult = validateDigits(assignmentCountInput.value, 1, 10);
      if (countResult.error) setError(errorElements.count, countResult.error, assignmentCountInput);

      const difficulty = checkedValue("difficulty");
      if (!difficulty) setError(errorElements.difficulty, "Choose an overall difficulty.");
      if (countResult.error || !difficulty) return undefined;
      return countResult.value * ASSIGNMENT_MINUTES[difficulty];
    }

    function renderSchedule() {
      scheduleList.replaceChildren();
      schedule.periods.forEach((period, index) => {
        const item = document.createElement("li");
        item.className = "schedule-item";
        item.dataset.type = period.type;
        item.dataset.index = String(index);

        const number = document.createElement("span");
        number.className = "schedule-index";
        number.textContent = String(index + 1).padStart(2, "0");

        const name = document.createElement("span");
        name.className = "schedule-name";
        const dot = document.createElement("span");
        dot.className = "period-dot";
        dot.setAttribute("aria-hidden", "true");
        name.append(dot, document.createTextNode(period.label));

        const duration = document.createElement("span");
        duration.className = "schedule-duration";
        duration.textContent = `${period.minutes} min`;

        item.append(number, name, duration);
        scheduleList.append(item);
      });

      scheduleSummary.textContent = `${schedule.workCount} work · ${schedule.periods.length - schedule.workCount} breaks`;
      totalDetail.textContent = `${schedule.totalWorkMinutes} min work total`;
      emptyState.hidden = true;
      sessionContent.hidden = false;
      phaseIndex = 0;
      timerState = "ready";
      remainingMs = schedule.periods[0].minutes * 60_000;
      updateDisplay(remainingMs);
      statusLabel.textContent = "READY";
      startButton.querySelector("span:first-child").textContent = "Start session";
      startButton.hidden = false;
      pauseButton.hidden = true;
      resetButton.disabled = false;
      sessionDisplay.classList.remove("is-running");
      formMessage.textContent = "Session built. Start when you’re ready.";
    }

    function formatTime(milliseconds) {
      const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
      const minutes = Math.floor(seconds / 60);
      return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }

    function updateDisplay(milliseconds) {
      if (timerState === "complete") {
        clock.textContent = "00:00";
        periodLabel.textContent = "SESSION COMPLETE";
        periodDetail.textContent = "All periods finished";
        progress.setAttribute("aria-valuenow", "100");
        progressFill.style.width = "100%";
        scheduleList.querySelectorAll(".schedule-item").forEach((item) => {
          item.classList.remove("is-current");
          item.classList.add("is-done");
        });
        return;
      }

      const period = schedule.periods[phaseIndex];
      const totalMs = period.minutes * 60_000;
      const elapsedRatio = Math.min(1, Math.max(0, 1 - milliseconds / totalMs));
      const percent = Math.round(elapsedRatio * 100);
      clock.textContent = formatTime(milliseconds);
      periodLabel.textContent = period.type === "work"
        ? `WORK PERIOD ${String(period.label.match(/\d+/)[0]).padStart(2, "0")}`
        : period.label.toUpperCase();
      periodDetail.textContent = period.type === "work" ? "Focus time" : "Rest and reset";
      progress.setAttribute("aria-valuenow", String(percent));
      progressFill.style.width = `${percent}%`;

      scheduleList.querySelectorAll(".schedule-item").forEach((item, index) => {
        item.classList.toggle("is-current", index === phaseIndex && timerState !== "complete");
        item.classList.toggle("is-done", index < phaseIndex || timerState === "complete");
      });
    }

    function ringAlarm(offsetSeconds = 0) {
      if (!alarmToggle.checked || !audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startsAt = audioContext.currentTime + offsetSeconds;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(740, startsAt);
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(0.13, startsAt + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.24);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + 0.25);
    }

    function advancePeriod(now) {
      phaseIndex += 1;
      if (phaseIndex >= schedule.periods.length) {
        timerState = "complete";
        clearInterval(timerHandle);
        timerHandle = null;
        remainingMs = 0;
        updateDisplay(0);
        statusLabel.textContent = "COMPLETE";
        sessionDisplay.classList.remove("is-running");
        startButton.hidden = true;
        pauseButton.hidden = true;
        ringAlarm();
        formMessage.textContent = "Session complete. Nicely done.";
        return false;
      }

      const nextPeriod = schedule.periods[phaseIndex];
      remainingMs = nextPeriod.minutes * 60_000;
      deadline += remainingMs;
      updateDisplay(remainingMs);
      ringAlarm();
      return deadline > now;
    }

    function tick() {
      const now = performance.now();
      while (timerState === "running" && now >= deadline) {
        if (!advancePeriod(now)) return;
      }

      if (timerState === "running") {
        remainingMs = Math.max(0, deadline - now);
        updateDisplay(remainingMs);
      }
    }

    async function startSession() {
      if (timerState === "complete" || !schedule) return;

      if (!audioContext && window.AudioContext) audioContext = new window.AudioContext();
      if (audioContext?.state === "suspended") await audioContext.resume();
      if (!schedule) return;

      if (timerState === "paused") {
        deadline = performance.now() + remainingMs;
      } else {
        remainingMs = schedule.periods[phaseIndex].minutes * 60_000;
        deadline = performance.now() + remainingMs;
        ringAlarm();
      }

      timerState = "running";
      statusLabel.textContent = "IN PROGRESS";
      sessionDisplay.classList.add("is-running");
      startButton.hidden = true;
      pauseButton.hidden = false;
      pauseButton.textContent = "Pause";
      timerHandle = window.setInterval(tick, 200);
    }

    function pauseSession() {
      if (timerState !== "running") return;
      remainingMs = Math.max(0, deadline - performance.now());
      clearInterval(timerHandle);
      timerHandle = null;
      timerState = "paused";
      statusLabel.textContent = "PAUSED";
      sessionDisplay.classList.remove("is-running");
      pauseButton.hidden = true;
      startButton.hidden = false;
      startButton.querySelector("span:first-child").textContent = "Resume session";
      updateDisplay(remainingMs);
    }

    function resetSession() {
      if (!schedule) return;
      clearInterval(timerHandle);
      timerHandle = null;
      phaseIndex = 0;
      timerState = "ready";
      remainingMs = schedule.periods[0].minutes * 60_000;
      updateDisplay(remainingMs);
      statusLabel.textContent = "READY";
      sessionDisplay.classList.remove("is-running");
      startButton.querySelector("span:first-child").textContent = "Start session";
      startButton.hidden = false;
      pauseButton.hidden = true;
      formMessage.textContent = "Session reset.";
    }

    function invalidateSchedule() {
      if (!schedule) return;
      clearInterval(timerHandle);
      timerHandle = null;
      schedule = null;
      phaseIndex = 0;
      timerState = "ready";
      remainingMs = 0;
      sessionDisplay.classList.remove("is-running");
      sessionContent.hidden = true;
      emptyState.hidden = false;
      scheduleList.replaceChildren();
      statusLabel.textContent = "READY";
      clock.textContent = "00:00";
      progress.setAttribute("aria-valuenow", "0");
      progressFill.style.width = "0%";
      startButton.hidden = false;
      pauseButton.hidden = true;
      resetButton.disabled = true;
    }

    form.addEventListener("change", (event) => {
      if (event.target.matches('input[name="mode"]')) toggleMode();
      else clearErrors();
      invalidateSchedule();
    });

    form.addEventListener("input", () => {
      clearErrors();
      invalidateSchedule();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      clearErrors();
      const totalWorkMinutes = chosenWorkload();
      const tiredness = checkedValue("tiredness");
      if (!tiredness) setError(errorElements.tiredness, "Choose how tired you are feeling.");

      if (totalWorkMinutes === undefined || !tiredness) {
        formMessage.textContent = "Complete the highlighted choices to build your session.";
        return;
      }

      schedule = buildSchedule(totalWorkMinutes, tiredness);
      renderSchedule();
      document.getElementById("session-title").focus?.();
    });

    startButton.addEventListener("click", startSession);
    pauseButton.addEventListener("click", pauseSession);
    resetButton.addEventListener("click", resetSession);
    themeToggle.addEventListener("change", () => {
      document.body.classList.toggle("dark-mode", themeToggle.checked);
      document.querySelector('meta[name="theme-color"]').content = themeToggle.checked ? "#17201c" : "#f4f7f1";
    });
    toggleMode();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { buildSchedule, distributeWork, validateDigits };
  }

  if (typeof document !== "undefined") initializeApp();
})();