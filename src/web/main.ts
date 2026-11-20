import { Simulation } from "../core/simulation.js";
import { TuningConfig } from "../core/types.js";
import { GameScene } from "./scene.js";
import { CharacterModel } from "./player.js";
import { SoundManager } from "./audio.js";

// Fetch tuning config from game.contract.json
async function getTuning(): Promise<TuningConfig> {
  const resp = await fetch("/game.contract.json");
  const data = await resp.json();
  return data.tuning;
}

async function initGame(): Promise<void> {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const tuning = await getTuning();

  const sounds = new SoundManager();
  const gameScene = new GameScene(canvas);
  const character = new CharacterModel();
  gameScene.scene.add(character.group);

  let sim = new Simulation(tuning, Math.floor(Math.random() * 100000));

  // Camera yaw and pitch angles
  let camYawDeg = 0;
  let camPitchDeg = 15;
  let isDraggingMouse = false;
  let prevMouseX = 0;
  let prevMouseY = 0;

  // Active keyboard keys
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
  };

  // Keyboard events
  window.addEventListener("keydown", (e) => {
    if (e.key in keys) {
      keys[e.key] = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key in keys) {
      keys[e.key] = false;
    }
  });

  // Mouse orbit controls
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

    camYawDeg += dx * 0.4;
    camPitchDeg = Math.max(-10, Math.min(60, camPitchDeg - dy * 0.3));
  });

  // Touch controls for mobile/tablets
  let touchStartX = 0;
  let touchStartY = 0;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length > 0) {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;

      camYawDeg += dx * 0.5;
      camPitchDeg = Math.max(-10, Math.min(60, camPitchDeg - dy * 0.3));
    }
  });

  // UI elements
  const flamesBar = document.getElementById("flames-bar")!;
  const timerVal = document.getElementById("timer-val")!;
  const scoreVal = document.getElementById("score-val")!;
  const lanternsVal = document.getElementById("lanterns-val")!;
  const motesCarried = document.getElementById("motes-carried")!;

  const modalOverlay = document.getElementById("modal-overlay")!;
  const modalTitle = document.getElementById("modal-title")!;
  const modalMsg = document.getElementById("modal-msg")!;
  const modalScore = document.getElementById("modal-score")!;
  const btnReplay = document.getElementById("btn-replay")!;

  function restartGame(): void {
    sim = new Simulation(tuning, Math.floor(Math.random() * 100000));
    modalOverlay.classList.remove("active");
  }

  btnReplay.addEventListener("click", () => {
    restartGame();
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

    // 3. Score
    scoreVal.textContent = String(sim.score);

    // 4. Lanterns & Motes
    const litCount = sim.lanterns.filter((l) => l.lit).length;
    lanternsVal.textContent = `${litCount} / 5`;
    motesCarried.textContent = `Đom đóm mang theo: ${sim.player.carried} / ${tuning.carry_capacity}`;
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
      } else if (ev.name === "player_hit") {
        sounds.playHit();
      } else if (ev.name === "game_over") {
        const result = ev.data.result;
        const reason = ev.data.reason;
        modalOverlay.classList.add("active");
        modalScore.textContent = `Tổng điểm: ${sim.score}`;

        if (result === "won") {
          sounds.playWin();
          modalTitle.textContent = "CHIẾN THẮNG!";
          modalTitle.className = "modal-title won";
          modalMsg.textContent =
            "Mây đã thắp sáng cả 5 Đèn Lồng Lớn! Ánh sáng ấm áp đã xua tan hoàn toàn màn sương đen trên Đảo Bến.";
        } else {
          modalTitle.textContent = "THUA CUỘC!";
          modalTitle.className = "modal-title lost";
          if (reason === "no_flames") {
            modalMsg.textContent =
              "Mây đã cạn kiệt ngọn lửa sinh mệnh do bị Bóng Mực tấn công. Hãy cẩn thận hơn trong đêm tiếp theo!";
          } else {
            modalMsg.textContent =
              "Trời đã rạng sáng nhưng các Đèn Lồng Lớn vẫn chưa được thắp đủ. Màn sương đen đã bao phủ đảo.";
          }
        }
      }
    }
  }

  // Fixed tick loop accumulator (60Hz)
  let lastTime = performance.now();
  const tickDuration = 1000 / 60; // ~16.67ms
  let accumulator = 0;

  function gameLoop(now: number): void {
    requestAnimationFrame(gameLoop);

    const delta = Math.min(100, now - lastTime);
    lastTime = now;
    accumulator += delta;

    while (accumulator >= tickDuration) {
      accumulator -= tickDuration;

      if (sim.state === "playing") {
        // Collect keyboard inputs
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
        });

        const events = sim.step();
        handleEvents(events);
      }
    }

    // Interpolate & Sync 3D view
    character.group.position.x = sim.player.pos[0];
    character.group.position.z = sim.player.pos[2];

    const isMoving =
      keys.w || keys.s || keys.a || keys.d ||
      keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;

    character.update(delta / 1000, isMoving);

    // Sync Scene entities
    gameScene.syncLanterns(sim.lanterns);
    gameScene.syncMotes(sim.motes);
    gameScene.syncShades(sim.shades);

    // Update Camera
    gameScene.updateCamera(sim.player.pos, camYawDeg, camPitchDeg);

    // Update HUD
    updateHUD();

    // Render 3D Scene
    gameScene.render();
  }

  requestAnimationFrame(gameLoop);
}

window.addEventListener("DOMContentLoaded", () => {
  initGame();
});
