import { Simulation } from "../core/simulation.js";
import { TuningConfig } from "../core/types.js";
import { GameScene } from "./scene.js";
import { CharacterModel } from "./player.js";
import { SoundManager } from "./audio.js";
import {
  LeaderboardEntry,
  DEFAULT_LEADERBOARD,
  sortAndPruneLeaderboard,
  validatePlayerName,
} from "../core/leaderboard.js";

async function getTuning(): Promise<TuningConfig> {
  const resp = await fetch("/game.contract.json");
  const data = await resp.json();
  return data.tuning;
}

interface NightLore {
  title: string;
  quote: string;
  desc: string;
}

const NIGHT_LORES: Record<number, NightLore> = {
  1: {
    title: "ĐÊM 1 — ĐẢO BẾN",
    quote: '"Mây à, sương đen đã nuốt hết ánh sáng. Con hãy thu thập đom đóm, thắp đèn và giữ lửa sáng tới khi bình minh ló rạng." — Lời Ông Đăng',
    desc: "Nhiệm vụ: Giữ tối thiểu 3/5 Đèn Lồng sáng tới Bình Minh (4 phút). Chú ý châm dầu trước khi đèn tắt và tránh để Bóng Mực hút dầu!",
  },
  2: {
    title: "ĐÊM 2 — ĐẢO CAU",
    quote: '"Đảo Cau được nối bởi cầu tre và các bục nhảy cổ xưa. Hãy cẩn thận Gió Lạc sẽ cướp đom đóm của con!" — Lời Ông Đăng',
    desc: "Nhiệm vụ: Dùng bục nhảy qua lại giữa 2 đảo, thu thập Bùa Gió và giữ tối thiểu 4/6 Đèn Lồng sáng tới Bình Minh (4 phút 30s).",
  },
  3: {
    title: "ĐÊM 3 — ĐẢO CHUÔNG",
    quote: '"Tháp chuông đứng sững sững trên đỉnh cao nhất. Gió giật từng cơn sẽ thổi bạt mọi thứ. Đêm cuối cùng rồi, cố lên con!" — Lời Ông Đăng',
    desc: "Nhiệm vụ: Leo qua 3 tầng địa hình, giữ tối thiểu 5/7 Đèn Lồng sáng tới Bình Minh (5 phút) để xua tan màn đêm vĩnh viễn.",
  },
};

async function initGame(): Promise<void> {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const tuning = await getTuning();

  const sounds = new SoundManager();
  const gameScene = new GameScene(canvas);
  const character = new CharacterModel();
  gameScene.scene.add(character.group);

  let currentNight = 1;
  let totalCampaignScore = 0;
  let sim = new Simulation(tuning, Math.floor(Math.random() * 100000), currentNight);
  gameScene.loadMapGeometry(sim.mapConfig);

  // Mouse sensitivity & Camera state
  let mouseSens = 0.5;
  const savedSens = localStorage.getItem("dao_den_long_sens");
  if (savedSens) mouseSens = parseFloat(savedSens);

  // Camera Mode: "third-person" (default) or "top-down" (fixed isometric)
  let cameraMode: "third-person" | "top-down" =
    (localStorage.getItem("dao_den_long_cam_mode") as any) || "third-person";

  let camYawDeg = 0;
  let camPitchDeg = cameraMode === "top-down" ? 52 : 18;
  let targetCamYawDeg = 0;
  let targetCamPitchDeg = cameraMode === "top-down" ? 52 : 18;
  let camDist = cameraMode === "top-down" ? 18.0 : 7.5;
  let targetCamDist = cameraMode === "top-down" ? 18.0 : 7.5;

  let isDraggingMouse = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let lastMouseMoveTime = 0;

  // Key Rebinding Configuration
  type ActionName =
    | "forward"
    | "backward"
    | "left"
    | "right"
    | "jump"
    | "dash"
    | "interact"
    | "pulse"
    | "pause";

  const ACTION_LABELS: Record<ActionName, string> = {
    forward: "Tiến (Forward)",
    backward: "Lùi (Backward)",
    left: "Sang Trái (Left)",
    right: "Sang Phải (Right)",
    jump: "Nhảy (Jump)",
    dash: "Lướt (Dash)",
    interact: "Nạp / Châm Dầu (Interact)",
    pulse: "Tỏa Sáng (Pulse)",
    pause: "Tạm Dừng (Pause)",
  };

  const DEFAULT_KEYBINDINGS: Record<ActionName, string[]> = {
    forward: ["w", "ArrowUp"],
    backward: ["s", "ArrowDown"],
    left: ["a", "ArrowLeft"],
    right: ["d", "ArrowRight"],
    jump: [" "],
    dash: ["Shift"],
    interact: ["e", "E"],
    pulse: ["q", "Q"],
    pause: ["Escape", "p", "P"],
  };

  let keyBindings: Record<ActionName, string[]> = JSON.parse(
    JSON.stringify(DEFAULT_KEYBINDINGS)
  );

  const savedKeybindings = localStorage.getItem("dao_den_long_keybindings");
  if (savedKeybindings) {
    try {
      const parsed = JSON.parse(savedKeybindings);
      keyBindings = { ...DEFAULT_KEYBINDINGS, ...parsed };
    } catch {}
  }

  const keysPressed = new Set<string>();

  function isActionActive(action: ActionName): boolean {
    const list = keyBindings[action] || [];
    for (const k of list) {
      if (keysPressed.has(k)) return true;
    }
    return false;
  }

  // UI elements
  const flamesBar = document.getElementById("flames-bar")!;
  const nightTitle = document.getElementById("night-title")!;
  const timerVal = document.getElementById("timer-val")!;
  const scoreVal = document.getElementById("score-val")!;
  const lanternsProgress = document.getElementById("lanterns-progress")!;
  const motesCountText = document.getElementById("motes-count-text")!;
  const moteBar = document.getElementById("mote-bar")!;
  const charmIndicator = document.getElementById("charm-indicator")!;
  const charmTimer = document.getElementById("charm-timer")!;
  const interactPrompt = document.getElementById("interact-prompt")!;
  const dashCdOverlay = document.getElementById("dash-cd-overlay")!;
  const pulseCdOverlay = document.getElementById("pulse-cd-overlay")!;

  // Quest Tracker
  const questStep = document.getElementById("quest-step")!;
  const questSubtext = document.getElementById("quest-subtext")!;

  // Minimap
  const minimapCanvas = document.getElementById("minimap-canvas") as HTMLCanvasElement;
  const minimapCtx = minimapCanvas ? minimapCanvas.getContext("2d") : null;

  // Toast Container
  const toastContainer = document.getElementById("toast-container")!;
  let lastToastTime = 0;
  function showToast(msg: string): void {
    const now = performance.now();
    if (now - lastToastTime < 300) return;
    lastToastTime = now;

    const toast = document.createElement("div");
    toast.className = "toast-msg";
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode === toastContainer) {
        toastContainer.removeChild(toast);
      }
    }, 2400);
  }

  // Modals
  const introModal = document.getElementById("intro-modal")!;
  const introTitle = document.getElementById("intro-title")!;
  const introQuote = document.getElementById("intro-quote")!;
  const introDesc = document.getElementById("intro-desc")!;
  const btnStartNight = document.getElementById("btn-start-night")!;
  const btnHowToPlay = document.getElementById("btn-how-to-play")!;

  const tutorialModal = document.getElementById("tutorial-modal")!;
  const btnHelpOpen = document.getElementById("btn-help-open")!;
  const btnCloseTutorial = document.getElementById("btn-close-tutorial")!;

  const gameoverModal = document.getElementById("gameover-modal")!;
  const modalResultTitle = document.getElementById("modal-result-title")!;
  const modalResultMsg = document.getElementById("modal-result-msg")!;
  const modalResultScore = document.getElementById("modal-result-score")!;
  const btnNextAction = document.getElementById("btn-next-action")!;
  const btnRetryNight = document.getElementById("btn-retry-night")!;

  const pauseModal = document.getElementById("pause-modal")!;
  const volSlider = document.getElementById("vol-slider") as HTMLInputElement;
  const sensSlider = document.getElementById("sens-slider") as HTMLInputElement;
  const btnResume = document.getElementById("btn-resume")!;
  const btnRestartFromPause = document.getElementById("btn-restart-from-pause")!;

  const keybindModal = document.getElementById("keybind-modal")!;
  const leaderboardModal = document.getElementById("leaderboard-modal")!;

  // Camera Mode & Pointer Lock Controls
  const btnToggleCamMode = document.getElementById("btn-toggle-cam-mode");
  const btnCenterCam = document.getElementById("btn-center-cam");
  const btnTogglePointerLock = document.getElementById("btn-toggle-pointer-lock");

  function updateCamModeUI(): void {
    if (btnToggleCamMode) {
      btnToggleCamMode.textContent =
        cameraMode === "top-down" ? "🗺️ Top-Down (Cố định)" : "🎥 Góc nhìn 3D";
    }
  }
  updateCamModeUI();

  function toggleCameraMode(): void {
    if (cameraMode === "third-person") {
      cameraMode = "top-down";
      targetCamYawDeg = 0;
      targetCamPitchDeg = 52;
      targetCamDist = 18.0;
      showToast("🗺️ Đã đổi: Góc nhìn Top-Down (Cố định, cực dễ điều khiển!)");
    } else {
      cameraMode = "third-person";
      const facingDeg = (character.group.rotation.y * 180) / Math.PI;
      targetCamYawDeg = facingDeg;
      targetCamPitchDeg = 18;
      targetCamDist = 7.5;
      showToast("🎥 Đã đổi: Góc nhìn 3D Thứ ba (Xoay tự do)");
    }
    localStorage.setItem("dao_den_long_cam_mode", cameraMode);
    updateCamModeUI();
  }

  function centerCameraBehind(): void {
    if (cameraMode === "top-down") {
      targetCamYawDeg = 0;
      targetCamPitchDeg = 52;
      showToast("🗺️ Đã căn giữa góc nhìn Top-Down");
    } else {
      const facingDeg = (character.group.rotation.y * 180) / Math.PI;
      targetCamYawDeg = facingDeg;
      targetCamPitchDeg = 18;
      showToast("📷 Đã căn chỉnh camera sau lưng Mây");
    }
  }

  btnToggleCamMode?.addEventListener("click", () => toggleCameraMode());
  btnCenterCam?.addEventListener("click", () => centerCameraBehind());

  // Opt-in Pointer Lock
  function togglePointerLock(): void {
    if (document.pointerLockElement === canvas) {
      releasePointerLock();
      showToast("🔓 Đã mở khóa chuột");
    } else {
      requestPointerLock();
      showToast("🔒 Đã khóa chuột (Nhấn ESC để thoát)");
    }
  }
  btnTogglePointerLock?.addEventListener("click", () => togglePointerLock());

  function requestPointerLock(): void {
    const isModalActive =
      introModal.classList.contains("active") ||
      gameoverModal.classList.contains("active") ||
      pauseModal.classList.contains("active") ||
      tutorialModal.classList.contains("active") ||
      (keybindModal && keybindModal.classList.contains("active")) ||
      (leaderboardModal && leaderboardModal.classList.contains("active"));

    if (!isModalActive && document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {}
    }
  }

  function releasePointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  let listeningAction: ActionName | null = null;
  const keybindWarning = document.getElementById("keybind-warning");

  function handleKeyRebind(newKey: string): void {
    if (!listeningAction) return;
    if (newKey === "Escape") {
      listeningAction = null;
      if (keybindWarning) keybindWarning.textContent = "";
      renderKeybindTable();
      return;
    }
    // Check conflicts across other actions
    for (const [action, keysList] of Object.entries(keyBindings)) {
      if (action !== listeningAction && keysList.includes(newKey)) {
        if (keybindWarning) {
          keybindWarning.textContent = `⚠ Phím "${newKey}" đã được gán cho ${ACTION_LABELS[action as ActionName]}! Vui lòng chọn phím khác.`;
        }
        return;
      }
    }
    keyBindings[listeningAction] = [newKey];
    localStorage.setItem("dao_den_long_keybindings", JSON.stringify(keyBindings));
    listeningAction = null;
    if (keybindWarning) keybindWarning.textContent = "";
    renderKeybindTable();
    showToast("Đã lưu phím điều khiển mới!");
  }

  window.addEventListener("keydown", (e) => {
    if (listeningAction) {
      handleKeyRebind(e.key);
      e.preventDefault();
      return;
    }

    keysPressed.add(e.key);

    if (isActionActive("pause") && !listeningAction) {
      togglePause();
    }
    if (e.key === "h" || e.key === "H") {
      toggleTutorial();
    }
    // Key C: Center camera behind Mây
    if (e.key === "c" || e.key === "C") {
      centerCameraBehind();
    }
    // Key V: Toggle camera mode (3D Third-person / Top-down Isometric)
    if (e.key === "v" || e.key === "V") {
      toggleCameraMode();
    }
  });

  window.addEventListener("keyup", (e) => {
    keysPressed.delete(e.key);
  });

  // Smooth mouse drag to look (left or right mouse button)
  canvas.addEventListener("mousedown", (e) => {
    if (cameraMode !== "top-down" && document.pointerLockElement !== canvas) {
      isDraggingMouse = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    }
  });

  // Prevent right-click context menu on canvas for smooth right-click camera rotation
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  window.addEventListener("mouseup", () => {
    isDraggingMouse = false;
  });

  window.addEventListener("mousemove", (e) => {
    lastMouseMoveTime = performance.now();

    if (cameraMode === "top-down") {
      targetCamYawDeg = 0;
      targetCamPitchDeg = 52;
      return;
    }

    if (document.pointerLockElement === canvas) {
      // 1. Pointer Lock mode: Free 360 look
      targetCamYawDeg += e.movementX * mouseSens * 0.22;
      targetCamPitchDeg = Math.max(
        -5,
        Math.min(65, targetCamPitchDeg - e.movementY * mouseSens * 0.22)
      );
    } else if (isDraggingMouse) {
      // 2. Drag mode: smooth camera turn when dragging mouse
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetCamYawDeg += dx * mouseSens * 0.28;
      targetCamPitchDeg = Math.max(
        -5,
        Math.min(65, targetCamPitchDeg - dy * mouseSens * 0.28)
      );
    }
  });

  // Mouse wheel zoom
  window.addEventListener(
    "wheel",
    (e) => {
      const minDist = cameraMode === "top-down" ? 10.0 : 3.5;
      const maxDist = cameraMode === "top-down" ? 28.0 : 16.0;
      targetCamDist = Math.max(minDist, Math.min(maxDist, targetCamDist + e.deltaY * 0.008));
    },
    { passive: true }
  );

  volSlider.value = String(sounds.volume * 100);
  volSlider.addEventListener("input", () => {
    sounds.setVolume(parseFloat(volSlider.value) / 100);
  });

  sensSlider.value = String(mouseSens * 10);
  sensSlider.addEventListener("input", () => {
    mouseSens = parseFloat(sensSlider.value) / 10;
    localStorage.setItem("dao_den_long_sens", String(mouseSens));
  });

  // Colorblind Mode toggle
  const cbToggle = document.getElementById("cb-toggle") as HTMLInputElement | null;
  let isColorblind = localStorage.getItem("dao_den_long_cb") === "true";
  if (cbToggle) {
    cbToggle.checked = isColorblind;
    gameScene.setColorblindMode(isColorblind);
    cbToggle.addEventListener("change", () => {
      isColorblind = cbToggle.checked;
      localStorage.setItem("dao_den_long_cb", String(isColorblind));
      gameScene.setColorblindMode(isColorblind);
      showToast(isColorblind ? "👁️ Đã bật Bảng màu dễ phân biệt" : "👁️ Đã tắt Bảng màu dễ phân biệt");
    });
  }

  // 1. Reduced Motion Toggle
  const reducedMotionToggle = document.getElementById("reduced-motion-toggle") as HTMLInputElement | null;
  let isReducedMotion = localStorage.getItem("dao_den_long_reduced_motion") === "true";
  if (reducedMotionToggle) {
    reducedMotionToggle.checked = isReducedMotion;
    if (isReducedMotion) document.body.classList.add("reduced-motion");
    reducedMotionToggle.addEventListener("change", () => {
      isReducedMotion = reducedMotionToggle.checked;
      localStorage.setItem("dao_den_long_reduced_motion", String(isReducedMotion));
      document.body.classList.toggle("reduced-motion", isReducedMotion);
      showToast(isReducedMotion ? "🎬 Đã bật Giảm chuyển động" : "🎬 Đã tắt Giảm chuyển động");
    });
  }

  // 2. Large Font UI Toggle
  const fontLargeToggle = document.getElementById("font-large-toggle") as HTMLInputElement | null;
  let isFontLarge = localStorage.getItem("dao_den_long_font_large") === "true";
  if (fontLargeToggle) {
    fontLargeToggle.checked = isFontLarge;
    if (isFontLarge) document.body.classList.add("font-large");
    fontLargeToggle.addEventListener("change", () => {
      isFontLarge = fontLargeToggle.checked;
      localStorage.setItem("dao_den_long_font_large", String(isFontLarge));
      document.body.classList.toggle("font-large", isFontLarge);
      showToast(isFontLarge ? "🔍 Đã bật Cỡ chữ lớn (×1.25)" : "🔍 Đã tắt Cỡ chữ lớn");
    });
  }

  // 3. Keybind Modal wiring
  const btnOpenKeybinds = document.getElementById("btn-open-keybinds");
  const btnCloseKeybinds = document.getElementById("btn-close-keybinds");
  const btnResetKeybinds = document.getElementById("btn-reset-keybinds");
  const keybindTbody = document.getElementById("keybind-tbody");

  function renderKeybindTable(): void {
    if (!keybindTbody) return;
    keybindTbody.innerHTML = "";
    for (const [action, label] of Object.entries(ACTION_LABELS)) {
      const act = action as ActionName;
      const tr = document.createElement("tr");
      const currentKeys = (keyBindings[act] || []).join(", ");
      tr.innerHTML = `
        <td style="font-weight: 500;">${label}</td>
        <td>
          <button class="key-input-btn ${listeningAction === act ? "listening" : ""}" data-action="${act}">
            ${listeningAction === act ? "Nhấn phím bất kỳ..." : (currentKeys === " " ? "SPACE" : currentKeys.toUpperCase())}
          </button>
        </td>
      `;
      const btn = tr.querySelector(".key-input-btn") as HTMLButtonElement;
      btn.addEventListener("click", () => {
        listeningAction = act;
        if (keybindWarning) keybindWarning.textContent = "";
        renderKeybindTable();
      });
      keybindTbody.appendChild(tr);
    }
  }

  btnOpenKeybinds?.addEventListener("click", () => {
    pauseModal.classList.remove("active");
    renderKeybindTable();
    keybindModal.classList.add("active");
    releasePointerLock();
  });

  btnCloseKeybinds?.addEventListener("click", () => {
    keybindModal.classList.remove("active");
    pauseModal.classList.add("active");
  });

  btnResetKeybinds?.addEventListener("click", () => {
    keyBindings = JSON.parse(JSON.stringify(DEFAULT_KEYBINDINGS));
    localStorage.removeItem("dao_den_long_keybindings");
    if (keybindWarning) keybindWarning.textContent = "";
    renderKeybindTable();
    showToast("Đã khôi phục phím mặc định");
  });

  // 4. Leaderboard Modal wiring
  const btnOpenLeaderboard = document.getElementById("btn-open-leaderboard");
  const btnCloseLeaderboard = document.getElementById("btn-close-leaderboard");
  const leaderboardTbody = document.getElementById("leaderboard-tbody");

  function getLocalLeaderboard(): LeaderboardEntry[] {
    const raw = localStorage.getItem("dao_den_long_leaderboard");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return sortAndPruneLeaderboard(parsed);
      } catch {}
    }
    return DEFAULT_LEADERBOARD;
  }

  function saveLocalLeaderboard(entries: LeaderboardEntry[]): void {
    localStorage.setItem(
      "dao_den_long_leaderboard",
      JSON.stringify(sortAndPruneLeaderboard(entries))
    );
  }

  function renderLeaderboardModal(): void {
    if (!leaderboardTbody) return;
    const entries = getLocalLeaderboard();
    leaderboardTbody.innerHTML = "";
    entries.forEach((e, idx) => {
      const tr = document.createElement("tr");
      const d = new Date(e.achieved_at);
      const dateStr = !isNaN(d.getTime())
        ? `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`
        : "Hôm nay";
      tr.innerHTML = `
        <td style="font-weight: bold; color: ${idx === 0 ? "#FFE58A" : idx === 1 ? "#C9B48A" : idx === 2 ? "#FFB347" : "#FFF"};">${idx + 1}</td>
        <td style="font-weight: bold;">${e.name}</td>
        <td style="color: #20E377; font-weight: bold;">${e.score}</td>
        <td>${e.nights_won} Đêm</td>
        <td style="font-size: 12px; color: #A0C0B5;">${dateStr}</td>
      `;
      leaderboardTbody.appendChild(tr);
    });
  }

  btnOpenLeaderboard?.addEventListener("click", () => {
    pauseModal.classList.remove("active");
    renderLeaderboardModal();
    leaderboardModal.classList.add("active");
    releasePointerLock();
  });

  btnCloseLeaderboard?.addEventListener("click", () => {
    leaderboardModal.classList.remove("active");
    pauseModal.classList.add("active");
  });

  // 5. Save Score in Gameover Modal
  const btnSaveScore = document.getElementById("btn-save-score") as HTMLButtonElement | null;
  const playerNameInput = document.getElementById("player-name-input") as HTMLInputElement | null;
  const saveScoreStatus = document.getElementById("save-score-status");

  btnSaveScore?.addEventListener("click", () => {
    if (!playerNameInput) return;
    const name = playerNameInput.value.trim();
    if (!validatePlayerName(name)) {
      if (saveScoreStatus) {
        saveScoreStatus.style.color = "#FF4422";
        saveScoreStatus.textContent = "Tên phải từ 3–12 ký tự [A-Za-z0-9_]!";
      }
      return;
    }
    const currentEntries = getLocalLeaderboard();
    const newEntry: LeaderboardEntry = {
      name,
      score: totalCampaignScore + sim.score,
      nights_won: Math.max(0, currentNight - 1 + (sim.state === "won" ? 1 : 0)),
      achieved_at: new Date().toISOString(),
      seed: sim.seed,
    };
    currentEntries.push(newEntry);
    saveLocalLeaderboard(currentEntries);
    if (saveScoreStatus) {
      saveScoreStatus.style.color = "#20E377";
      saveScoreStatus.textContent = `✅ Đã lưu thành công cho "${name}"!`;
    }
    btnSaveScore.disabled = true;
  });

  // 6. Subtitles & Threat Alerts
  const subtitleAlert = document.getElementById("subtitle-alert");
  let subtitleTimer: number | null = null;
  function showSubtitle(msg: string, durationMs: number = 3200): void {
    if (!subtitleAlert) return;
    subtitleAlert.textContent = msg;
    subtitleAlert.style.display = "block";
    if (subtitleTimer) clearTimeout(subtitleTimer);
    subtitleTimer = window.setTimeout(() => {
      subtitleAlert.style.display = "none";
    }, durationMs);
  }

  let warned10s = false;
  let warnedWind = false;
  const warnedLowFuelLanterns = new Set<string>();

  function showNightIntro(night: number): void {
    const lore = NIGHT_LORES[night] || NIGHT_LORES[1];
    introTitle.textContent = lore.title;
    introQuote.textContent = lore.quote;
    introDesc.textContent = lore.desc;
    introModal.classList.add("active");
    releasePointerLock();
  }

  function startNight(night: number): void {
    currentNight = night;
    sim = new Simulation(tuning, Math.floor(Math.random() * 100000), currentNight);
    gameScene.loadMapGeometry(sim.mapConfig);
    nightTitle.textContent = `ĐÊM ${currentNight} — ${sim.mapConfig.night === 1 ? "ĐẢO BẾN" : sim.mapConfig.night === 2 ? "ĐẢO CAU" : "ĐẢO CHUÔNG"}`;
    introModal.classList.remove("active");
    gameoverModal.classList.remove("active");
    tutorialModal.classList.remove("active");
    if (keybindModal) keybindModal.classList.remove("active");
    if (leaderboardModal) leaderboardModal.classList.remove("active");

    warned10s = false;
    warnedWind = false;
    warnedLowFuelLanterns.clear();

    camYawDeg = 0;
    targetCamYawDeg = 0;
    camPitchDeg = cameraMode === "top-down" ? 52 : 18;
    targetCamPitchDeg = cameraMode === "top-down" ? 52 : 18;
    camDist = cameraMode === "top-down" ? 18.0 : 7.5;
    targetCamDist = cameraMode === "top-down" ? 18.0 : 7.5;
  }

  btnStartNight.addEventListener("click", () => {
    introModal.classList.remove("active");
  });

  function toggleTutorial(): void {
    if (tutorialModal.classList.contains("active")) {
      tutorialModal.classList.remove("active");
    } else {
      tutorialModal.classList.add("active");
      releasePointerLock();
    }
  }

  btnHelpOpen.addEventListener("click", () => toggleTutorial());
  btnHowToPlay.addEventListener("click", () => {
    introModal.classList.remove("active");
    tutorialModal.classList.add("active");
    releasePointerLock();
  });
  btnCloseTutorial.addEventListener("click", () => {
    tutorialModal.classList.remove("active");
    requestPointerLock();
  });

  function togglePause(): void {
    if (sim.state === "playing") {
      sim.applyInputFrame({ tick: sim.tick, pause: true });
      sim.step();
      pauseModal.classList.add("active");
      releasePointerLock();
    } else if (sim.state === "paused") {
      sim.applyInputFrame({ tick: sim.tick, pause: true });
      sim.step();
      pauseModal.classList.remove("active");
    }
  }

  const btnPauseOpen = document.getElementById("btn-pause-open");
  btnPauseOpen?.addEventListener("click", () => {
    togglePause();
  });

  btnResume.addEventListener("click", () => {
    togglePause();
  });

  btnRestartFromPause.addEventListener("click", () => {
    pauseModal.classList.remove("active");
    startNight(currentNight);
  });

  btnRetryNight.addEventListener("click", () => {
    startNight(currentNight);
  });

  btnNextAction.addEventListener("click", () => {
    if (currentNight < 3) {
      startNight(currentNight + 1);
      showNightIntro(currentNight);
    } else {
      // Replay entire campaign
      totalCampaignScore = 0;
      startNight(1);
      showNightIntro(1);
    }
  });

  // Render Minimap Radar
  function renderMinimap(): void {
    if (!minimapCtx) return;
    const ctx = minimapCtx;
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Save state
    ctx.save();

    // Night-specific scale & center
    let scale = 1.25; // pixels per meter
    let worldCenterX = 0;
    let worldCenterZ = 0;

    if (currentNight === 2) {
      scale = 0.85;
      worldCenterX = 35;
    } else {
      scale = 1.35;
      worldCenterX = 0;
    }

    const worldToMap = (wx: number, wz: number): [number, number] => {
      const mx = cx + (wx - worldCenterX) * scale;
      const my = cy + (wz - worldCenterZ) * scale;
      return [mx, my];
    };

    // Draw Islands
    ctx.fillStyle = "rgba(47, 93, 80, 0.4)";
    ctx.strokeStyle = "rgba(201, 180, 138, 0.5)";
    ctx.lineWidth = 1.5;

    if (currentNight === 1) {
      const [ix, iy] = worldToMap(0, 0);
      ctx.beginPath();
      ctx.arc(ix, iy, 40 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (currentNight === 2) {
      const [iaX, iaY] = worldToMap(0, 0);
      ctx.beginPath();
      ctx.arc(iaX, iaY, 28 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const [ibX, ibY] = worldToMap(70, 0);
      ctx.beginPath();
      ctx.arc(ibX, ibY, 28 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bridge
      const [bStart, bEnd] = [worldToMap(28, 0), worldToMap(42, 0)];
      ctx.strokeStyle = "rgba(107, 74, 47, 0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bStart[0], bStart[1]);
      ctx.lineTo(bEnd[0], bEnd[1]);
      ctx.stroke();
    } else {
      // Night 3 tiers
      const [ix, iy] = worldToMap(0, 0);
      ctx.beginPath();
      ctx.arc(ix, iy, 42 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ix, iy, 26 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(242, 193, 78, 0.3)";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ix, iy, 12 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(242, 193, 78, 0.5)";
      ctx.stroke();
    }

    // Safe zones (6m radius) around lit lanterns with fuel >= 30
    for (const l of sim.lanterns) {
      if (l.lit && l.fuel >= 30) {
        const [lx, ly] = worldToMap(l.pos[0], l.pos[2]);
        ctx.fillStyle = "rgba(242, 193, 78, 0.15)";
        ctx.beginPath();
        ctx.arc(lx, ly, 6 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(242, 193, 78, 0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Motes (small yellow dots)
    ctx.fillStyle = "#FFF6C2";
    for (const m of sim.motes) {
      const [mx, my] = worldToMap(m.pos[0], m.pos[2]);
      ctx.beginPath();
      ctx.arc(mx, my, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lanterns
    const blinkOn = Math.floor(Date.now() / 500) % 2 === 0;
    for (const l of sim.lanterns) {
      const [lx, ly] = worldToMap(l.pos[0], l.pos[2]);
      if (l.lit) {
        if (l.fuel < 30) {
          ctx.fillStyle = blinkOn ? (isColorblind ? "#FFFFFF" : "#FF4422") : "#55FFFF";
        } else {
          ctx.fillStyle = "#55FFFF";
        }
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#F2C14E";
        ctx.fillRect(lx - 3, ly - 3, 6, 6);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1;
        ctx.strokeRect(lx - 3, ly - 3, 6, 6);
      }
    }

    // Shades (Bóng Mực: cyan/white in colorblind mode, purple in normal mode)
    for (const s of sim.shades) {
      const [sx, sy] = worldToMap(s.pos[0], s.pos[2]);
      if (isColorblind) {
        ctx.fillStyle = s.state === "stunned" ? "#5588AA" : "#00B3FF";
      } else {
        ctx.fillStyle = s.state === "stunned" ? "#665588" : "#A033FF";
      }
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player (Mây: bright green dot with facing pointer)
    const [px, py] = worldToMap(sim.player.pos[0], sim.player.pos[2]);
    ctx.fillStyle = "#20E377";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Facing direction pointer
    const facingYaw = character.group.rotation.y;
    const ptrX = px + Math.sin(facingYaw) * 9;
    const ptrY = py + Math.cos(facingYaw) * 9;
    ctx.strokeStyle = "#20E377";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ptrX, ptrY);
    ctx.stroke();

    ctx.restore();
  }

  function updateHUD(): void {
    // 1. Flames
    const flameIcons = flamesBar.querySelectorAll(".flame-icon");
    flameIcons.forEach((icon, i) => {
      if (i < sim.player.flames) {
        icon.classList.remove("lost");
      } else {
        icon.classList.add("lost");
      }
    });

    // 2. Timer
    const mins = Math.floor(sim.timeLeftS / 60);
    const secs = Math.floor(sim.timeLeftS % 60);
    timerVal.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    if (sim.timeLeftS <= 30) {
      timerVal.classList.add("urgent");
    } else {
      timerVal.classList.remove("urgent");
    }

    // 3. Score & Lanterns
    scoreVal.textContent = String(totalCampaignScore + sim.score);
    const litCount = sim.lanterns.filter((l) => l.lit).length;
    const minRequired = Math.ceil(sim.lanterns.length * tuning.win_ratio);
    lanternsProgress.textContent = `Đèn sáng: ${litCount} / ${sim.lanterns.length} (Cần ≥ ${minRequired})`;

    // 4. Mote bar (Dynamic capacity: 10 to 20 cells)
    motesCountText.textContent = `${sim.player.carried}/${sim.player.capacity}`;
    while (moteBar.children.length < sim.player.capacity) {
      const div = document.createElement("div");
      div.className = "mote-cell";
      moteBar.appendChild(div);
    }
    while (moteBar.children.length > sim.player.capacity) {
      moteBar.removeChild(moteBar.lastChild!);
    }
    const cells = moteBar.querySelectorAll(".mote-cell");
    cells.forEach((cell, i) => {
      if (i < sim.player.carried) {
        cell.classList.add("filled");
      } else {
        cell.classList.remove("filled");
      }
    });

    // 5. Charm indicator
    if (sim.player.charm_ticks > 0) {
      charmIndicator.style.display = "block";
      charmTimer.textContent = (sim.player.charm_ticks / 60.0).toFixed(1);
    } else {
      charmIndicator.style.display = "none";
    }

    // 6. Skill Cooldown Overlays
    const dashCdRatio = Math.min(1.0, sim.player.dash_cd_ticks / 90.0);
    dashCdOverlay.style.height = `${dashCdRatio * 100}%`;

    const pulseCdRatio = Math.min(1.0, sim.player.pulse_cd_ticks / 180.0);
    pulseCdOverlay.style.height = `${pulseCdRatio * 100}%`;

    // 7. Interact prompt & Quest Guidance
    // Candidate lantern: unlit or (lit and fuel < 100)
    let candidateLantern: (typeof sim.lanterns)[0] | null = null;
    let nearestCandDist = 99999;
    for (const l of sim.lanterns) {
      const canReceive = !l.lit || (l.lit && l.fuel < 100);
      if (!canReceive) continue;
      const d = Math.hypot(sim.player.pos[0] - l.pos[0], sim.player.pos[2] - l.pos[2]);
      if (d <= tuning.interact_radius) {
        if (d < nearestCandDist || (Math.abs(d - nearestCandDist) < 1e-4 && (!candidateLantern || l.id < candidateLantern.id))) {
          nearestCandDist = d;
          candidateLantern = l;
        }
      }
    }

    if (candidateLantern) {
      interactPrompt.style.display = "block";
      if (!candidateLantern.lit) {
        const cost = candidateLantern.ever_lit ? tuning.relight_cost : tuning.lantern_cost;
        const action = candidateLantern.ever_lit ? "Thắp lại" : "Nạp ánh sáng";
        interactPrompt.textContent = `E — ${action} Đèn ${candidateLantern.id} (${candidateLantern.deposited}/${cost})`;
        questStep.textContent = `Nhấn [E] ${action} Đèn ${candidateLantern.id} (${candidateLantern.deposited}/${cost})`;
        questSubtext.textContent = `Đang mang ${sim.player.carried}/${sim.player.capacity} đom đóm. Cần ${cost - candidateLantern.deposited} để thắp sáng!`;
      } else {
        const needed = Math.ceil((100 - candidateLantern.fuel) / tuning.fuel_per_mote);
        interactPrompt.textContent = `E — Châm dầu Đèn ${candidateLantern.id} (Dầu: ${Math.floor(candidateLantern.fuel)}/100)`;
        questStep.textContent = `Nhấn [E] châm dầu Đèn ${candidateLantern.id} (Dầu: ${Math.floor(candidateLantern.fuel)}/100)`;
        questSubtext.textContent = `Cần tối đa ${needed} đom đóm để đổ đầy bình (100). Đang có ${sim.player.carried}.`;
      }
    } else {
      interactPrompt.style.display = "none";

      const lowFuelLantern = sim.lanterns.find((l) => l.lit && l.fuel < 30);
      if (lowFuelLantern) {
        questStep.textContent = `⚠ Đèn ${lowFuelLantern.id} sắp cạn dầu (${Math.floor(lowFuelLantern.fuel)}%)!`;
        questSubtext.textContent = "Đèn mất vùng an toàn 6m và bị Bóng Mực hút! Hãy chạy tới châm dầu gấp!";
      } else if (sim.player.carried >= sim.player.capacity) {
        questStep.textContent = `2. Túi đã đầy (${sim.player.carried}/${sim.player.capacity})! Đi thắp đèn hoặc châm dầu`;
        questSubtext.textContent = "Nhìn các cột sáng trên trời để tìm đèn cần nạp hoặc tiếp dầu";
      } else if (litCount < minRequired) {
        questStep.textContent = `1. Cần thắp thêm đèn (${litCount}/${minRequired} đèn tối thiểu)`;
        questSubtext.textContent = `Nhặt đom đóm (${sim.player.carried}/${sim.player.capacity}) và thắp sáng các đèn trên đảo`;
      } else {
        questStep.textContent = `✨ Đang giữ đảo an toàn (${litCount}/${sim.lanterns.length} đèn sáng)`;
        questSubtext.textContent = "Châm dầu và bảo vệ các ngọn đèn cho tới khi Bình Minh ló rạng!";
      }
    }

    // Render Minimap
    renderMinimap();
  }

  function handleEvents(events: ReturnType<typeof sim.step>): void {
    for (const ev of events) {
      if (ev.name === "mote_picked") {
        sounds.playMotePicked();
        showToast(`+1 Đom đóm (${sim.player.carried}/${sim.player.capacity})`);
      } else if (ev.name === "deposit") {
        sounds.playDeposit();
        showToast(`Đã nạp ${ev.data.amount} đom đóm vào Đèn Lồng ${ev.data.lantern_id}!`);
      } else if (ev.name === "refuel") {
        sounds.playDeposit();
        showToast(`Đã châm ${ev.data.used} đom đóm vào Đèn ${ev.data.lantern_id} (Dầu: ${Math.floor(ev.data.fuel)})!`);
      } else if (ev.name === "lantern_lit") {
        sounds.playLanternLit();
        if (ev.data.relight) {
          showToast(`✨ Đã thắp lại Đèn Lồng ${ev.data.lantern_id}! (Dầu: 100)`);
        } else {
          showToast(`✨ Đèn Lồng ${ev.data.lantern_id} đã sáng! Túi tăng sức chứa lên ${sim.player.capacity}!`);
        }
      } else if (ev.name === "lantern_out") {
        sounds.playHit();
        showToast(`🚨 Đèn Lồng ${ev.data.lantern_id} đã CẠN DẦU và TẮT! Cần 5 đom đóm thắp lại!`);
      } else if (ev.name === "pulse") {
        sounds.playPulse();
        character.triggerPulseEffect();
        showToast(`💫 Tỏa Sáng! Làm choáng Bóng Mực trong 5m!`);
      } else if (ev.name === "dash") {
        sounds.playDash();
        showToast(`💨 Lướt nhanh!`);
      } else if (ev.name === "charm_picked") {
        sounds.playCharmPicked();
        showToast(`⚡ Nhặt được Bùa Gió! Hồi chiêu tức thì!`);
      } else if (ev.name === "player_hit") {
        sounds.playHit();
        showToast(`⚠️ Bị Bóng Mực cắn! Mất 1 ngọn lửa & rơi đom đóm!`);
      } else if (ev.name === "game_over") {
        const result = ev.data.result;
        const reason = ev.data.reason;
        gameoverModal.classList.add("active");
        releasePointerLock();

        if (result === "won") {
          totalCampaignScore += sim.score;
          sounds.playWin();
          if (currentNight < 3) {
            modalResultTitle.textContent = `VƯỢT QUA ĐÊM ${currentNight}!`;
            modalResultMsg.textContent = "Bình minh đã ló rạng! Bạn đã bảo vệ thành công các ngọn Đèn Lồng qua đêm tối.";
            btnNextAction.textContent = `Sang Đêm ${currentNight + 1}`;
          } else {
            modalResultTitle.textContent = "BÌNH MINH TOÀN DIỆN!";
            modalResultMsg.textContent = "Mây đã giữ sáng toàn bộ 3 hòn đảo qua mọi hiểm nguy! Bình minh vĩnh cửu đã trở lại!";
            btnNextAction.textContent = "Chơi lại từ đầu";
          }
        } else {
          modalResultTitle.textContent = "THUA CUỘC!";
          if (reason === "no_flames") {
            modalResultMsg.textContent = "Mây đã cạn kiệt ngọn lửa sinh mệnh. Đêm tối nuốt chửng đảo.";
          } else {
            modalResultMsg.textContent = "Trời đã sáng nhưng số đèn sáng không đạt tối thiểu 60%. Sương đen bao phủ.";
          }
          btnNextAction.textContent = "Thử lại Đêm này";
        }
        modalResultScore.textContent = `Tổng điểm: ${totalCampaignScore + sim.score}`;
      }
    }
  }

  // Initial Night 1 lore modal
  showNightIntro(1);

  // 60Hz tick accumulator
  let lastTime = performance.now();
  const tickDuration = 1000 / 60;
  let accumulator = 0;

  function gameLoop(now: number): void {
    requestAnimationFrame(gameLoop);

    const delta = Math.min(100, now - lastTime);
    lastTime = now;
    accumulator += delta;

    while (accumulator >= tickDuration) {
      accumulator -= tickDuration;

      if (sim.state === "playing") {
        let mx = 0;
        let mz = 0;
        if (isActionActive("forward")) mz += 1;
        if (isActionActive("backward")) mz -= 1;
        if (isActionActive("left")) mx -= 1; // Fixed: Left is -X
        if (isActionActive("right")) mx += 1; // Fixed: Right is +X

        sim.applyInputFrame({
          tick: sim.tick,
          move: [mx, mz],
          cam_yaw_deg: cameraMode === "top-down" ? 0 : camYawDeg,
          interact: isActionActive("interact"),
          pulse: isActionActive("pulse"),
          jump: isActionActive("jump"),
          dash: isActionActive("dash"),
        });

        const events = sim.step();
        handleEvents(events);
      }
    }

    // Subtitle & Visual Alerts update
    if (sim.state === "playing") {
      if (sim.timeLeftS <= 10.0 && sim.timeLeftS > 8.0 && !warned10s) {
        warned10s = true;
        showSubtitle("⏳ Chỉ còn 10 giây trước Bình Minh!");
      }
      if (currentNight >= 2 && sim.tick % 1800 === 1620 && !warnedWind) {
        warnedWind = true;
        showSubtitle("💨 Cảnh báo: Gió giật sắp tới trong 3 giây!");
      } else if (sim.tick % 1800 !== 1620) {
        warnedWind = false;
      }
      for (const l of sim.lanterns) {
        if (l.lit && l.fuel < 30 && !warnedLowFuelLanterns.has(l.id)) {
          warnedLowFuelLanterns.add(l.id);
          showSubtitle(`🚨 Đèn Lồng ${l.id} sắp cạn dầu (<30%)! Vùng an toàn đã tắt!`);
        } else if (l.lit && l.fuel >= 30) {
          warnedLowFuelLanterns.delete(l.id);
        }
      }
    }

    // Directional Threat Arrows (Threat Overlay)
    const arrowTop = document.getElementById("threat-arrow-top");
    const arrowBottom = document.getElementById("threat-arrow-bottom");
    const arrowLeft = document.getElementById("threat-arrow-left");
    const arrowRight = document.getElementById("threat-arrow-right");

    if (arrowTop && arrowBottom && arrowLeft && arrowRight) {
      let nearestThreat: (typeof sim.shades)[0] | null = null;
      let minThreatDist = 9.0;
      for (const s of sim.shades) {
        if (s.state === "chase" || s.state === "drain") {
          const d = Math.hypot(s.pos[0] - sim.player.pos[0], s.pos[2] - sim.player.pos[2]);
          if (d < minThreatDist) {
            minThreatDist = d;
            nearestThreat = s;
          }
        }
      }

      if (nearestThreat) {
        const dx = nearestThreat.pos[0] - sim.player.pos[0];
        const dz = nearestThreat.pos[2] - sim.player.pos[2];
        const worldAngle = Math.atan2(dx, dz);
        const activeCamYaw = cameraMode === "top-down" ? 0 : camYawDeg;
        const camYawRad = (activeCamYaw * Math.PI) / 180;
        let relAngle = worldAngle - camYawRad;
        while (relAngle < -Math.PI) relAngle += Math.PI * 2;
        while (relAngle > Math.PI) relAngle -= Math.PI * 2;

        arrowTop.style.display = relAngle >= -Math.PI / 4 && relAngle <= Math.PI / 4 ? "block" : "none";
        arrowBottom.style.display = relAngle >= (3 * Math.PI) / 4 || relAngle <= (-3 * Math.PI) / 4 ? "block" : "none";
        arrowRight.style.display = relAngle > Math.PI / 4 && relAngle < (3 * Math.PI) / 4 ? "block" : "none";
        arrowLeft.style.display = relAngle < -Math.PI / 4 && relAngle > (-3 * Math.PI) / 4 ? "block" : "none";
      } else {
        arrowTop.style.display = "none";
        arrowBottom.style.display = "none";
        arrowLeft.style.display = "none";
        arrowRight.style.display = "none";
      }
    }

    // Camera Mode overrides
    if (cameraMode === "top-down") {
      targetCamYawDeg = 0;
      targetCamPitchDeg = 52;
    }

    // Camera Smoothing & Damping
    let yawDiff = targetCamYawDeg - camYawDeg;
    while (yawDiff < -180) yawDiff += 360;
    while (yawDiff > 180) yawDiff -= 360;
    camYawDeg += yawDiff * Math.min(1.0, (delta / 1000) * 18.0);

    camPitchDeg += (targetCamPitchDeg - camPitchDeg) * Math.min(1.0, (delta / 1000) * 18.0);
    camDist += (targetCamDist - camDist) * Math.min(1.0, (delta / 1000) * 12.0);

    // Sync Character Mesh Position
    character.group.position.x = sim.player.pos[0];
    character.group.position.y = sim.player.pos[1];
    character.group.position.z = sim.player.pos[2];

    // Smooth Character Rotation towards movement velocity
    const vx = sim.player.vel[0];
    const vz = sim.player.vel[2];
    const hSpeed = Math.hypot(vx, vz);
    if (hSpeed > 0.15) {
      const targetYaw = Math.atan2(vx, vz);
      let diff = targetYaw - character.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      character.group.rotation.y += diff * Math.min(1.0, (delta / 1000) * 14.0);
    }

    const isMoving =
      isActionActive("forward") ||
      isActionActive("backward") ||
      isActionActive("left") ||
      isActionActive("right");

    character.update(delta / 1000, isMoving, sim.player.grounded);

    // Sync Scene Entities
    gameScene.syncLanterns(sim.lanterns);
    gameScene.syncMotes(sim.motes);
    gameScene.syncShades(sim.shades);
    gameScene.syncDrifters(sim.drifters);
    gameScene.syncCharms(sim.charms);

    // Update Camera with dynamic distance
    gameScene.updateCamera(sim.player.pos, camYawDeg, camPitchDeg, camDist);

    // Update HUD
    updateHUD();

    // Render
    gameScene.render();
  }

  requestAnimationFrame(gameLoop);
}

window.addEventListener("DOMContentLoaded", () => {
  initGame();
});
