import { execSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";

console.log("=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG TEST CONTRACT V1.1 (PHASE 2) ===");

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

// 1. Build check
console.log("1. Build headless bundle...");
execSync("npm run build:headless", { stdio: "ignore" });
assert(fs.existsSync("dist/headless.js"), "Build bundle dist/headless.js tồn tại");

// 2. Default Night 1, 2, 3 run & schema check
console.log("2. Kiểm tra định dạng Snapshot Contract v1.1 trên 3 Đêm...");
for (const n of [1, 2, 3]) {
  execSync(`node dist/headless.js --seed 42 --night ${n} --ticks 60 --out docs/proof/phase-2/verify-night${n}.jsonl --snapshot-every 20`);
  const lines = fs.readFileSync(`docs/proof/phase-2/verify-night${n}.jsonl`, "utf-8").trim().split("\n");
  const snap0 = JSON.parse(lines[0]);
  assert(
    snap0.type === "snapshot" &&
    snap0.night === n &&
    snap0.wind !== undefined &&
    snap0.player.vel !== undefined &&
    snap0.player.grounded !== undefined &&
    snap0.player.invuln !== undefined &&
    Array.isArray(snap0.motes) &&
    Array.isArray(snap0.drifters) &&
    Array.isArray(snap0.charms),
    `Đêm ${n}: Snapshot tick 0 tuân thủ 100% Contract v1.1 schema`
  );
}

// 3. Determinism check
console.log("3. Kiểm tra tính tất định (Determinism) Contract v1.1...");
execSync("node dist/headless.js --seed 777 --night 2 --ticks 100 --out docs/proof/phase-2/det-1.jsonl");
execSync("node dist/headless.js --seed 777 --night 2 --ticks 100 --out docs/proof/phase-2/det-2.jsonl");
const h1 = crypto.createHash("sha256").update(fs.readFileSync("docs/proof/phase-2/det-1.jsonl")).digest("hex");
const h2 = crypto.createHash("sha256").update(fs.readFileSync("docs/proof/phase-2/det-2.jsonl")).digest("hex");
assert(h1 === h2, "Hai lần chạy cùng seed ra SHA256 trùng khớp 100%");

// 4. Feature: Lướt (Dash)
console.log("4. Kiểm tra Tính năng Lướt (Dash)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-dash.json --inputs tests/scenarios/inputs-dash.json --ticks 25 --out docs/proof/phase-2/verify-dash.jsonl --snapshot-every 5");
const dashLines = fs.readFileSync("docs/proof/phase-2/verify-dash.jsonl", "utf-8").trim().split("\n");
const dashEvents = dashLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(dashEvents.some(e => e.name === "dash"), "Phát event 'dash' chính xác");
const dashSnap10 = JSON.parse(dashLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 10; }));
assert(dashSnap10.player.vel[2] === 14, "Vận tốc lướt đạt chuẩn 14 m/s");

// 5. Feature: Rơi khỏi đảo & Hồi sinh (Fall & Respawn)
console.log("5. Kiểm tra Tính năng Rơi khỏi đảo (Fall & Respawn)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-fall.json --inputs tests/scenarios/inputs-fall.json --ticks 90 --out docs/proof/phase-2/verify-fall.jsonl --snapshot-every 20");
const fallLines = fs.readFileSync("docs/proof/phase-2/verify-fall.jsonl", "utf-8").trim().split("\n");
const fallEvents = fallLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(fallEvents.some(e => e.name === "player_hit" && e.data.by === "fall" && e.data.lost === 4), "Phát event player_hit do rơi và mất hết đom đóm (lost: 4)");

// 6. Feature: Bục nhảy (Jump Pad)
console.log("6. Kiểm tra Bục nhảy (Jump Pad Đêm 2)...");
execSync("node dist/headless.js --seed 42 --night 2 --scenario tests/scenarios/scenario-jumppad.json --inputs tests/scenarios/inputs-jumppad.json --ticks 30 --out docs/proof/phase-2/verify-jumppad.jsonl --snapshot-every 10");
const padLines = fs.readFileSync("docs/proof/phase-2/verify-jumppad.jsonl", "utf-8").trim().split("\n");
const padSnap10 = JSON.parse(padLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 10; }));
assert(!padSnap10.player.grounded && padSnap10.player.pos[1] > 1.0, "Mây được bục nhảy phóng lên không trung");

// 7. Feature: Bùa Gió (Charm)
console.log("7. Kiểm tra Bùa Gió (Charm)...");
execSync("node dist/headless.js --seed 42 --night 2 --scenario tests/scenarios/scenario-charm.json --inputs tests/scenarios/inputs-charm.json --ticks 20 --out docs/proof/phase-2/verify-charm.jsonl --snapshot-every 5");
const charmLines = fs.readFileSync("docs/proof/phase-2/verify-charm.jsonl", "utf-8").trim().split("\n");
const charmEvents = charmLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(charmEvents.some(e => e.name === "charm_picked" && e.data.charm_id === "C1"), "Phát event charm_picked C1");
const charmSnap5 = JSON.parse(charmLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 5; }));
assert(charmSnap5.player.vel[0] === 7.2, "Tốc độ chạy được tăng lên 7.2 m/s khi có Bùa Gió");

// 8. Feature: Gió Lạc (Drifter Steal & Drop)
console.log("8. Kiểm tra Gió Lạc (Drifter)...");
execSync("node dist/headless.js --seed 42 --night 2 --scenario tests/scenarios/scenario-drifter.json --inputs tests/scenarios/inputs-drifter.json --ticks 10 --out docs/proof/phase-2/verify-drifter.jsonl --snapshot-every 2");
const drifterLines = fs.readFileSync("docs/proof/phase-2/verify-drifter.jsonl", "utf-8").trim().split("\n");
const drifterEvents = drifterLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(drifterEvents.some(e => e.name === "drifter_steal" && e.data.amount === 3), "Event drifter_steal cướp 3 đom đóm chính xác");
assert(drifterEvents.some(e => e.name === "drifter_drop" && e.data.amount === 3), "Event drifter_drop thả 3 đom đóm khi bị Tỏa Sáng");

// 9. Feature: Tạm dừng (Pause & Resume)
console.log("9. Kiểm tra Tạm dừng (Pause)...");
execSync("node dist/headless.js --seed 42 --night 1 --inputs tests/scenarios/inputs-pause.json --ticks 15 --out docs/proof/phase-2/verify-pause.jsonl --snapshot-every 2");
const pauseLines = fs.readFileSync("docs/proof/phase-2/verify-pause.jsonl", "utf-8").trim().split("\n");
const pauseEvents = pauseLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(pauseEvents.some(e => e.name === "paused"), "Phát event 'paused' chính xác");

// 10. Performance benchmark (21.600 ticks <= 30s)
console.log("10. Đo hiệu năng chạy 1 đêm đầy đủ (21.600 ticks)...");
const t0 = Date.now();
execSync("node dist/headless.js --seed 42 --night 1 --ticks 21600 --out docs/proof/phase-2/perf-night1.jsonl --snapshot-every 600");
const elapsed = (Date.now() - t0) / 1000;
console.log(`    Thời gian chạy 21.600 ticks: ${elapsed.toFixed(3)}s`);
assert(elapsed <= 30.0, "Chạy 21.600 ticks xong trong ≤ 30 giây (đạt chuẩn Ticket-02)");

console.log(`\n=== TỔNG KẾT PHASE 2: ĐẠT ${passed}/${total} TIÊU CHÍ KIỂM THỬ ===`);
if (passed === total) {
  console.log(">>> TẤT CẢ KIỂM THỬ TEST CONTRACT V1.1 ĐÃ HOÀN TẤT VÀ ĐẠT CHUẨN XUẤT SẮC! <<<");
}
