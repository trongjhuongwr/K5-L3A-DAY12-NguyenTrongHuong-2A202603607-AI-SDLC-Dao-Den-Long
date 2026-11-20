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
    quote: '"Tháp chuông đứng sừng sững trên đỉnh cao nhất. Gió giật từng cơn sẽ thổi bạt mọi thứ. Đêm cuối cùng rồi, cố lên con!" — Lời Ông Đăng',
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

  // Mouse sensitivity
  let mouseSens = 0.4;
  const savedSens = localStorage.getItem("dao_den_long_sens");
  if (savedSens) mouseSens = parseFloat(savedSens);

  let camYawDeg = 0;
  let camPitchDeg = 15;
  let isDraggingMouse = false;
  let prevMouseX = 0;
  let prevMouseY = 0;

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
  };

  window.addEventListener("keydown", (e) => {
    if (e.key in keys) keys[e.key] = true;
    if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      togglePause();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key in keys) keys[e.key] = false;
  });

  canvas.addEventListener("mousedown", (e) => {
    isDraggingMouse = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  });

  window.addEventListener("mouseup", () => {
    isDraggingMouse = false;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDraggingMouse) return;
    const dx = e.clientX - prevMouseX;
    const dy = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    camYawDeg += dx * mouseSens;
    camPitchDeg = Math.max(-10, Math.min(60, camPitchDeg - dy * mouseSens * 0.75));
  });

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

  // Modals
  const introModal = document.getElementById("intro-modal")!;
  const introTitle = document.getElementById("intro-title")!;
  const introQuote = document.getElementById("intro-quote")!;
  const introDesc = document.getElementById("intro-desc")!;
  const btnStartNight = document.getElementById("btn-start-night")!;

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
  }

  function startNight(night: number): void {
    currentNight = night;
    sim = new Simulation(tuning, Math.floor(Math.random() * 100000), currentNight);
    gameScene.loadMapGeometry(sim.mapConfig);
    nightTitle.textContent = `ĐÊM ${currentNight} — ${sim.mapConfig.night === 1 ? "ĐẢO BẾN" : sim.mapConfig.night === 2 ? "ĐẢO CAU" : "ĐẢO CHUÔNG"}`;
    introModal.classList.remove("active");
    gameoverModal.classList.remove("active");
  }

  btnStartNight.addEventListener("click", () => {
    introModal.classList.remove("active");
  });

  function togglePause(): void {
    if (sim.state === "playing") {
      sim.applyInputFrame({ tick: sim.tick, pause: true });
      sim.step();
      pauseModal.classList.add("active");
    } else if (sim.state === "paused") {
      sim.applyInputFrame({ tick: sim.tick, pause: true });
      sim.step();
      pauseModal.classList.remove("active");
    }
  }

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
    const dashCdRatio = Math.min(1.0, (sim.player.dash_cd_ticks / 90.0));
    dashCdOverlay.style.height = `${dashCdRatio * 100}%`;

    const pulseCdRatio = Math.min(1.0, (sim.player.pulse_cd_ticks / 180.0));
    pulseCdOverlay.style.height = `${pulseCdRatio * 100}%`;

    // 7. Interact prompt
    let nearbyUnlit: typeof sim.lanterns[0] | null = null;
    for (const l of sim.lanterns) {
      if (!l.lit) {
        const d = Math.hypot(sim.player.pos[0] - l.pos[0], sim.player.pos[2] - l.pos[2]);
        if (d <= tuning.interact_radius) {
          nearbyUnlit = l;
          break;
        }
      }
    }
    if (nearbyUnlit) {
      interactPrompt.style.display = "block";
      interactPrompt.textContent = `E — Nạp ánh sáng (${nearbyUnlit.deposited}/${tuning.lantern_cost})`;
    } else {
      interactPrompt.style.display = "none";
    }
  }

  function handleEvents(events: ReturnType<typeof sim.step>): void {
    for (const ev of events) {
      if (ev.name === "mote_picked") {
        sounds.playMotePicked();
      } else if (ev.name === "deposit") {
        sounds.playDeposit();
      } else if (ev.name === "lantern_lit") {
        sounds.playLanternLit();
      } else if (ev.name === "pulse") {
        sounds.playPulse();
        character.triggerPulseEffect();
      } else if (ev.name === "dash") {
        sounds.playDash();
      } else if (ev.name === "charm_picked") {
        sounds.playCharmPicked();
      } else if (ev.name === "player_hit") {
        sounds.playHit();
      } else if (ev.name === "game_over") {
        const result = ev.data.result;
        const reason = ev.data.reason;
        gameoverModal.classList.add("active");

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
        if (keys.a || keys.ArrowLeft) mx -= 1;
        if (keys.d || keys.ArrowRight) mx += 1;

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

    // Sync Character Mesh
    character.group.position.x = sim.player.pos[0];
    character.group.position.y = sim.player.pos[1];
    character.group.position.z = sim.player.pos[2];

    const isMoving =
      keys.w || keys.s || keys.a || keys.d ||
      keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;

    character.update(delta / 1000, isMoving);

    // Sync Scene Entities
    gameScene.syncLanterns(sim.lanterns);
    gameScene.syncMotes(sim.motes);
    gameScene.syncShades(sim.shades);
    gameScene.syncDrifters(sim.drifters);
    gameScene.syncCharms(sim.charms);

    // Update Camera
    gameScene.updateCamera(sim.player.pos, camYawDeg, camPitchDeg);

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
