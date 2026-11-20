import { Simulation } from "../core/simulation.js";
import { TuningConfig } from "../core/types.js";
import { GameScene } from "./scene.js";
import { CharacterModel } from "./player.js";
import { SoundManager } from "./audio.js";

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
    quote: '"Mây à, sương đen đã nuốt hết ánh sáng. Con hãy thu thập đom đóm thắp sáng lại 5 ngọn Đèn Lồng Lớn." — Lời Ông Đăng',
    desc: "Nhiệm vụ: Thắp sáng cả 5 Đèn Lồng Lớn và né tránh Bóng Mực.",
  },
  2: {
    title: "ĐÊM 2 — ĐẢO CAU",
    quote: '"Đảo Cau được nối bởi cầu tre và các bục nhảy cổ xưa. Hãy cẩn thận Gió Lạc sẽ cướp đom đóm của con!" — Lời Ông Đăng',
    desc: "Nhiệm vụ: Dùng bục nhảy qua lại giữa 2 đảo, thu thập Bùa Gió và thắp sáng 6 Đèn Lồng Lớn.",
  },
  3: {
    title: "ĐÊM 3 — ĐẢO CHUÔNG",
    quote: '"Tháp chuông đứng sững sững trên đỉnh cao nhất. Gió giật từng cơn sẽ thổi bạt mọi thứ. Đêm cuối cùng rồi, cố lên con!" — Lời Ông Đăng',
    desc: "Nhiệm vụ: Leo qua 3 tầng địa hình, vượt qua gió mạnh và thắp sáng cả 7 ngọn Đèn Lồng để đón Bình Minh.",
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

  let camYawDeg = 0;
  let camPitchDeg = 15;
  let targetCamYawDeg = 0;
  let targetCamPitchDeg = 15;
  let camDist = 7.5;
  let targetCamDist = 7.5;

  let isDraggingMouse = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let lastMouseMoveTime = 0;

  const keys: Record<string, boolean> = {
    w: false,
    a: false,
    s: false,
    d: false,
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false,
    e: false,
    q: false,
    " ": false,
    Shift: false,
    Escape: false,
    p: false,
    h: false,
    c: false,
  };

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

  // Pointer Lock handling helper
  function requestPointerLock(): void {
    const isModalActive =
      introModal.classList.contains("active") ||
      gameoverModal.classList.contains("active") ||
      pauseModal.classList.contains("active") ||
      tutorialModal.classList.contains("active");

    if (!isModalActive && document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Ignore if browser restricts
      }
    }
  }

  function releasePointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  canvas.addEventListener("click", () => {
    requestPointerLock();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key in keys) keys[e.key] = true;
    if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      togglePause();
    }
    if (e.key === "h" || e.key === "H") {
      toggleTutorial();
    }
    // Key C: Center camera behind Mây
    if (e.key === "c" || e.key === "C") {
      const facingDeg = (character.group.rotation.y * 180) / Math.PI;
      targetCamYawDeg = facingDeg;
      targetCamPitchDeg = 15;
      showToast("📷 Đã căn chỉnh camera sau lưng Mây");
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key in keys) keys[e.key] = false;
  });

  canvas.addEventListener("mousedown", (e) => {
    if (document.pointerLockElement !== canvas) {
      isDraggingMouse = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    }
  });

  window.addEventListener("mouseup", () => {
    isDraggingMouse = false;
  });

  window.addEventListener("mousemove", (e) => {
    lastMouseMoveTime = performance.now();

    if (document.pointerLockElement === canvas) {
      // 1. Pointer Lock mode: Free 360 mouse look without holding any button!
      targetCamYawDeg += e.movementX * mouseSens * 0.22;
      targetCamPitchDeg = Math.max(
        -10,
        Math.min(60, targetCamPitchDeg - e.movementY * mouseSens * 0.22)
      );
    } else if (isDraggingMouse) {
      // 2. Drag mode fallback if pointer not locked
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetCamYawDeg += dx * mouseSens * 0.35;
      targetCamPitchDeg = Math.max(
        -10,
        Math.min(60, targetCamPitchDeg - dy * mouseSens * 0.35)
      );
    }
  });

  // Mouse wheel zoom
  window.addEventListener(
    "wheel",
    (e) => {
      targetCamDist = Math.max(3.5, Math.min(14.0, targetCamDist + e.deltaY * 0.006));
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

    camYawDeg = 0;
    targetCamYawDeg = 0;
    camPitchDeg = 15;
    targetCamPitchDeg = 15;
    camDist = 7.5;
    targetCamDist = 7.5;
  }

  btnStartNight.addEventListener("click", () => {
    introModal.classList.remove("active");
    requestPointerLock();
  });

  function toggleTutorial(): void {
    if (tutorialModal.classList.contains("active")) {
      tutorialModal.classList.remove("active");
      requestPointerLock();
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
      requestPointerLock();
    }
  }

  btnResume.addEventListener("click", () => {
    togglePause();
  });

  btnRestartFromPause.addEventListener("click", () => {
    pauseModal.classList.remove("active");
    startNight(currentNight);
    requestPointerLock();
  });

  btnRetryNight.addEventListener("click", () => {
    startNight(currentNight);
    requestPointerLock();
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

    // Safe zones (6m radius) around lit lanterns
    for (const l of sim.lanterns) {
      if (l.lit) {
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
    for (const l of sim.lanterns) {
      const [lx, ly] = worldToMap(l.pos[0], l.pos[2]);
      if (l.lit) {
        ctx.fillStyle = "#55FFFF";
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

    // Shades (Bóng Mực: purple dots)
    for (const s of sim.shades) {
      const [sx, sy] = worldToMap(s.pos[0], s.pos[2]);
      ctx.fillStyle = s.state === "stunned" ? "#665588" : "#A033FF";
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
    lanternsProgress.textContent = `Đèn: ${litCount} / ${sim.lanterns.length}`;

    // 4. Mote bar (10 cells)
    motesCountText.textContent = `${sim.player.carried}/10`;
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
    let nearbyUnlit: (typeof sim.lanterns)[0] | null = null;
    let nearestUnlitDist = 99999;
    for (const l of sim.lanterns) {
      if (!l.lit) {
        const d = Math.hypot(sim.player.pos[0] - l.pos[0], sim.player.pos[2] - l.pos[2]);
        if (d < nearestUnlitDist) nearestUnlitDist = d;
        if (d <= tuning.interact_radius && !nearbyUnlit) {
          nearbyUnlit = l;
        }
      }
    }

    if (nearbyUnlit) {
      interactPrompt.style.display = "block";
      interactPrompt.textContent = `E — Nạp ánh sáng (${nearbyUnlit.deposited}/${tuning.lantern_cost})`;
      questStep.textContent = `2. Nhấn [E] nạp ánh sáng (${nearbyUnlit.deposited}/${tuning.lantern_cost})`;
      questSubtext.textContent = `Đang mang ${sim.player.carried} đom đóm. Cần tổng 10 để thắp sáng!`;
    } else {
      interactPrompt.style.display = "none";

      if (litCount >= sim.lanterns.length) {
        questStep.textContent = "✨ Tất cả đèn đã sáng!";
        questSubtext.textContent = "Bình minh đang thức giấc trên Đảo Đèn Lồng...";
      } else if (sim.player.carried >= 10) {
        questStep.textContent = "2. Túi đã đầy (10/10)! Đi tới Đèn Lồng";
        questSubtext.textContent = "Nhìn các cột sáng cao trên trời để tìm đèn chưa thắp";
      } else if (sim.player.carried > 0) {
        questStep.textContent = `1. Thu thập thêm đom đóm (${sim.player.carried}/10)`;
        questSubtext.textContent = `Đèn gần nhất cách ${Math.round(nearestUnlitDist)}m. Có thể mang nạp bất kỳ lúc nào`;
      } else {
        questStep.textContent = `1. Nhặt đom đóm rải rác trên đảo (0/10)`;
        questSubtext.textContent = "Chạy qua các đốm sáng vàng để tự động nhặt vào túi";
      }
    }

    // Render Minimap
    renderMinimap();
  }

  function handleEvents(events: ReturnType<typeof sim.step>): void {
    for (const ev of events) {
      if (ev.name === "mote_picked") {
        sounds.playMotePicked();
        showToast(`+1 Đom đóm (${sim.player.carried}/10)`);
      } else if (ev.name === "deposit") {
        sounds.playDeposit();
        showToast(`Đã nạp ${ev.data.amount} đom đóm vào Đèn Lồng!`);
      } else if (ev.name === "lantern_lit") {
        sounds.playLanternLit();
        showToast(`✨ Đèn Lồng đã thắp sáng! Vùng an toàn 6m kích hoạt!`);
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
            modalResultMsg.textContent = "Ánh sáng đã đẩy lùi sương đen. Hành trình tiếp tục tới hòn đảo kế tiếp!";
            btnNextAction.textContent = `Sang Đêm ${currentNight + 1}`;
          } else {
            modalResultTitle.textContent = "BÌNH MINH ĐÃ TỚI!";
            modalResultMsg.textContent = "Mây đã thắp sáng toàn bộ 3 hòn đảo! Bình minh rực rỡ đã trở lại trên Đảo Đèn Lồng!";
            btnNextAction.textContent = "Chơi lại từ đầu";
          }
        } else {
          modalResultTitle.textContent = "THUA CUỘC!";
          if (reason === "no_flames") {
            modalResultMsg.textContent = "Mây đã cạn kiệt ngọn lửa sinh mệnh. Đêm tối nuốt chửng đảo.";
          } else {
            modalResultMsg.textContent = "Trời đã sáng nhưng các đèn chưa được thắp đủ. Sương đen bao phủ.";
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
        if (keys.w || keys.ArrowUp) mz += 1;
        if (keys.s || keys.ArrowDown) mz -= 1;
        if (keys.a || keys.ArrowLeft) mx += 1;
        if (keys.d || keys.ArrowRight) mx -= 1;

        sim.applyInputFrame({
          tick: sim.tick,
          move: [mx, mz],
          cam_yaw_deg: camYawDeg,
          interact: keys.e,
          pulse: keys.q,
          jump: keys[" "],
          dash: keys.Shift,
        });

        const events = sim.step();
        handleEvents(events);
      }
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
      character.group.rotation.y += diff * Math.min(1.0, (delta / 1000) * 12.0);
    }

    // Soft Camera Auto-Follow behind Mây when running forward without touching mouse for 500ms
    if ((keys.w || keys.ArrowUp) && hSpeed > 0.5 && now - lastMouseMoveTime > 500) {
      const facingDeg = (character.group.rotation.y * 180) / Math.PI;
      let autoDiff = facingDeg - targetCamYawDeg;
      while (autoDiff < -180) autoDiff += 360;
      while (autoDiff > 180) autoDiff -= 360;
      targetCamYawDeg += autoDiff * Math.min(1.0, (delta / 1000) * 1.6);
    }

    const isMoving =
      keys.w ||
      keys.s ||
      keys.a ||
      keys.d ||
      keys.ArrowUp ||
      keys.ArrowDown ||
      keys.ArrowLeft ||
      keys.ArrowRight;

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
