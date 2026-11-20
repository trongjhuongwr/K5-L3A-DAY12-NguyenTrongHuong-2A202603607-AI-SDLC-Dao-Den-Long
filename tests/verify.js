import { execSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";

console.log("=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG TEST CONTRACT V1.2 (PHASE 3) ===");

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
console.log("2. Kiểm tra định dạng Snapshot Contract v1.2 trên 3 Đêm...");
for (const n of [1, 2, 3]) {
  execSync(`node dist/headless.js --seed 42 --night ${n} --ticks 60 --out docs/proof/phase-3/verify-night${n}.jsonl --snapshot-every 20`);
  const lines = fs.readFileSync(`docs/proof/phase-3/verify-night${n}.jsonl`, "utf-8").trim().split("\n");
  const snap0 = JSON.parse(lines[0]);
  const l0 = snap0.lanterns[0];
  assert(
    snap0.type === "snapshot" &&
    snap0.night === n &&
    snap0.wind !== undefined &&
    snap0.player.vel !== undefined &&
    snap0.player.grounded !== undefined &&
    snap0.player.invuln !== undefined &&
    snap0.player.capacity !== undefined &&
    snap0.player.capacity >= 10 &&
    l0.fuel !== undefined &&
    l0.ever_lit !== undefined &&
    l0.relit_count !== undefined &&
    Array.isArray(snap0.motes) &&
    Array.isArray(snap0.drifters) &&
    Array.isArray(snap0.charms),
    `Đêm ${n}: Snapshot tick 0 tuân thủ 100% Contract v1.2 schema (fuel, ever_lit, relit_count, capacity)`
  );
}

// 3. Determinism check
console.log("3. Kiểm tra tính tất định (Determinism) Contract v1.2...");
execSync("node dist/headless.js --seed 777 --night 2 --ticks 100 --out docs/proof/phase-3/det-1.jsonl");
execSync("node dist/headless.js --seed 777 --night 2 --ticks 100 --out docs/proof/phase-3/det-2.jsonl");
const h1 = crypto.createHash("sha256").update(fs.readFileSync("docs/proof/phase-3/det-1.jsonl")).digest("hex");
const h2 = crypto.createHash("sha256").update(fs.readFileSync("docs/proof/phase-3/det-2.jsonl")).digest("hex");
assert(h1 === h2, "Hai lần chạy cùng seed ra SHA256 trùng khớp 100%");

// 4. Feature: Lướt (Dash)
console.log("4. Kiểm tra Tính năng Lướt (Dash)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-dash.json --inputs tests/scenarios/inputs-dash.json --ticks 25 --out docs/proof/phase-3/verify-dash.jsonl --snapshot-every 5");
const dashLines = fs.readFileSync("docs/proof/phase-3/verify-dash.jsonl", "utf-8").trim().split("\n");
const dashEvents = dashLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(dashEvents.some(e => e.name === "dash"), "Phát event 'dash' chính xác");
const dashSnap10 = JSON.parse(dashLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 10; }));
assert(dashSnap10.player.vel[2] === 14, "Vận tốc lướt đạt chuẩn 14 m/s");

// 5. Feature: Rơi khỏi đảo & Hồi sinh (Fall & Respawn)
console.log("5. Kiểm tra Tính năng Rơi khỏi đảo (Fall & Respawn)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-fall.json --inputs tests/scenarios/inputs-fall.json --ticks 90 --out docs/proof/phase-3/verify-fall.jsonl --snapshot-every 20");
const fallLines = fs.readFileSync("docs/proof/phase-3/verify-fall.jsonl", "utf-8").trim().split("\n");
const fallEvents = fallLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(fallEvents.some(e => e.name === "player_hit" && e.data.by === "fall" && e.data.lost === 4), "Phát event player_hit do rơi và mất hết đom đóm (lost: 4)");

// 6. Feature: Bục nhảy (Jump Pad)
console.log("6. Kiểm tra Bục nhảy (Jump Pad Đêm 2)...");
execSync("node dist/headless.js --seed 42 --night 2 --scenario tests/scenarios/scenario-jumppad.json --inputs tests/scenarios/inputs-jumppad.json --ticks 30 --out docs/proof/phase-3/verify-jumppad.jsonl --snapshot-every 10");
const padLines = fs.readFileSync("docs/proof/phase-3/verify-jumppad.jsonl", "utf-8").trim().split("\n");
const padSnap10 = JSON.parse(padLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 10; }));
assert(!padSnap10.player.grounded && padSnap10.player.pos[1] > 1.0, "Mây được bục nhảy phóng lên không trung");

// 7. Feature: Bùa Gió (Charm)
console.log("7. Kiểm tra Bùa Gió (Charm)...");
execSync("node dist/headless.js --seed 42 --night 2 --scenario tests/scenarios/scenario-charm.json --inputs tests/scenarios/inputs-charm.json --ticks 20 --out docs/proof/phase-3/verify-charm.jsonl --snapshot-every 5");
const charmLines = fs.readFileSync("docs/proof/phase-3/verify-charm.jsonl", "utf-8").trim().split("\n");
const charmEvents = charmLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(charmEvents.some(e => e.name === "charm_picked" && e.data.charm_id === "C1"), "Phát event charm_picked C1");
const charmSnap5 = JSON.parse(charmLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 5; }));
assert(charmSnap5.player.vel[0] === 7.2, "Tốc độ chạy được tăng lên 7.2 m/s khi có Bùa Gió");

// 8. Feature: Gió Lạc (Drifter Steal & Drop)
console.log("8. Kiểm tra Gió Lạc (Drifter)...");
execSync("node dist/headless.js --seed 42 --night 2 --scenario tests/scenarios/scenario-drifter.json --inputs tests/scenarios/inputs-drifter.json --ticks 10 --out docs/proof/phase-3/verify-drifter.jsonl --snapshot-every 2");
const drifterLines = fs.readFileSync("docs/proof/phase-3/verify-drifter.jsonl", "utf-8").trim().split("\n");
const drifterEvents = drifterLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(drifterEvents.some(e => e.name === "drifter_steal" && e.data.amount === 3), "Event drifter_steal cướp 3 đom đóm chính xác");
assert(drifterEvents.some(e => e.name === "drifter_drop" && e.data.amount === 3), "Event drifter_drop thả 3 đom đóm khi bị Tỏa Sáng");

// 9. Feature: Tạm dừng (Pause & Resume)
console.log("9. Kiểm tra Tạm dừng (Pause)...");
execSync("node dist/headless.js --seed 42 --night 1 --inputs tests/scenarios/inputs-pause.json --ticks 15 --out docs/proof/phase-3/verify-pause.jsonl --snapshot-every 2");
const pauseLines = fs.readFileSync("docs/proof/phase-3/verify-pause.jsonl", "utf-8").trim().split("\n");
const pauseEvents = pauseLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(pauseEvents.some(e => e.name === "paused"), "Phát event 'paused' chính xác");

// 10. Phase 3: Hao hụt dầu tự nhiên & Tắt đèn (Natural Decay & lantern_out)
console.log("10. Kiểm tra Hao hụt dầu tự nhiên & Tắt đèn (lantern_out)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-decay-out.json --inputs tests/scenarios/inputs-decay-out.json --ticks 15 --out docs/proof/phase-3/verify-decay-out.jsonl --snapshot-every 2");
const decayLines = fs.readFileSync("docs/proof/phase-3/verify-decay-out.jsonl", "utf-8").trim().split("\n");
const decayEvents = decayLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(decayEvents.some(e => e.name === "lantern_out" && e.data.lantern_id === "L1"), "Phát event 'lantern_out' khi cạn dầu");
const decaySnap10 = JSON.parse(decayLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 10; }));
const l1Snap = decaySnap10.lanterns.find(l => l.id === "L1");
assert(!l1Snap.lit && l1Snap.fuel === 0 && l1Snap.deposited === 0 && l1Snap.ever_lit === true, "Đèn tắt chuyển về lit: false, fuel: 0, deposited: 0, ever_lit: true");

// 11. Phase 3: Châm dầu (Refuel E on lit lantern)
console.log("11. Kiểm tra Châm dầu (Refuel)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-refuel.json --inputs tests/scenarios/inputs-refuel.json --ticks 5 --out docs/proof/phase-3/verify-refuel.jsonl --snapshot-every 1");
const refuelLines = fs.readFileSync("docs/proof/phase-3/verify-refuel.jsonl", "utf-8").trim().split("\n");
const refuelEvents = refuelLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
const refuelEv = refuelEvents.find(e => e.name === "refuel");
assert(refuelEv && refuelEv.data.lantern_id === "L1" && refuelEv.data.amount === 4 && refuelEv.data.fuel === 100, "Phát event 'refuel' chính xác (amount: 4, fuel: 100)");

// 12. Phase 3: Thắp lại đèn (Relight cost: 5)
console.log("12. Kiểm tra Thắp lại đèn (Relight cost 5 motes)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-relight.json --inputs tests/scenarios/inputs-relight.json --ticks 5 --out docs/proof/phase-3/verify-relight.jsonl --snapshot-every 1");
const relightLines = fs.readFileSync("docs/proof/phase-3/verify-relight.jsonl", "utf-8").trim().split("\n");
const relightEvents = relightLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
const relightLitEv = relightEvents.find(e => e.name === "lantern_lit");
assert(relightLitEv && relightLitEv.data.lantern_id === "L1" && relightLitEv.data.relight === true, "Phát event 'lantern_lit' với relight: true");
const relightSnap = JSON.parse(relightLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 2; }));
assert(relightSnap.player.carried === 3, "Chỉ tiêu hao 5 đom đóm khi thắp lại đèn (còn lại 3)");

// 13. Phase 3: Bóng Mực hút dầu & Mất vùng an toàn (Shade Drain & fuel_drain)
console.log("13. Kiểm tra Bóng Mực hút dầu khi fuel < 30...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-drain.json --inputs tests/scenarios/inputs-drain.json --ticks 65 --out docs/proof/phase-3/verify-drain.jsonl --snapshot-every 10");
const drainLines = fs.readFileSync("docs/proof/phase-3/verify-drain.jsonl", "utf-8").trim().split("\n");
const drainEvents = drainLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(drainEvents.some(e => e.name === "fuel_drain" && e.data.lantern_id === "L1" && e.data.shade_id === "S1"), "Phát event 'fuel_drain' định kỳ");
const drainSnap60 = JSON.parse(drainLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 60; }));
const s1Snap = drainSnap60.shades.find(s => s.id === "S1");
assert(s1Snap.state === "drain", "Bóng Mực chuyển sang trạng thái 'drain' khi ở gần đèn < 30 fuel");

// 14. Phase 3: Sức chứa tăng động (Dynamic Capacity)
console.log("14. Kiểm tra Sức chứa túi tăng động theo số đèn thắp lần đầu...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-dynamic-capacity.json --inputs tests/scenarios/inputs-dynamic-capacity.json --ticks 5 --out docs/proof/phase-3/verify-capacity.jsonl --snapshot-every 1");
const capLines = fs.readFileSync("docs/proof/phase-3/verify-capacity.jsonl", "utf-8").trim().split("\n");
const capSnap = JSON.parse(capLines.find(l => { const o = JSON.parse(l); return o.type === "snapshot" && o.tick === 2; }));
assert(capSnap.player.capacity === 12, "Sức chứa tăng từ 10 lên 12 sau khi thắp thành công đèn đầu tiên");

// 15. Phase 3: Điều kiện Thắng Bình Minh (dawn_survived)
console.log("15. Kiểm tra Điều kiện Thắng Bình Minh (dawn_survived)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-dawn-win.json --inputs tests/scenarios/inputs-dawn-win.json --ticks 10 --out docs/proof/phase-3/verify-dawn-win.jsonl --snapshot-every 2");
const dawnWinLines = fs.readFileSync("docs/proof/phase-3/verify-dawn-win.jsonl", "utf-8").trim().split("\n");
const dawnWinEvents = dawnWinLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
const winEv = dawnWinEvents.find(e => e.name === "game_over");
assert(winEv && winEv.data.result === "won" && winEv.data.reason === "dawn_survived", "Phát event game_over won (dawn_survived) khi đạt >= 60% đèn sáng");

// 16. Phase 3: Điều kiện Thua Bình Minh (dawn)
console.log("16. Kiểm tra Điều kiện Thua Bình Minh (dawn khi < 60% đèn sáng)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-dawn-lose.json --inputs tests/scenarios/inputs-dawn-lose.json --ticks 10 --out docs/proof/phase-3/verify-dawn-lose.jsonl --snapshot-every 2");
const dawnLoseLines = fs.readFileSync("docs/proof/phase-3/verify-dawn-lose.jsonl", "utf-8").trim().split("\n");
const dawnLoseEvents = dawnLoseLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
const loseEv = dawnLoseEvents.find(e => e.name === "game_over");
assert(loseEv && loseEv.data.result === "lost" && loseEv.data.reason === "dawn", "Phát event game_over lost (dawn) khi không đủ 60% đèn sáng");

// 17. Performance benchmark (21.600 ticks <= 30s)
console.log("17. Đo hiệu năng chạy 1 đêm đầy đủ (21.600 ticks)...");
const t0 = Date.now();
execSync("node dist/headless.js --seed 42 --night 1 --ticks 21600 --out docs/proof/phase-3/perf-night1.jsonl --snapshot-every 600");
const elapsed = (Date.now() - t0) / 1000;
console.log(`    Thời gian chạy 21.600 ticks: ${elapsed.toFixed(3)}s`);
assert(elapsed <= 30.0, "Chạy 21.600 ticks xong trong ≤ 30 giây (đạt chuẩn Ticket-03)");

console.log(`\n=== TỔNG KẾT PHASE 3: ĐẠT ${passed}/${total} TIÊU CHÍ KIỂM THỬ ===`);
if (passed === total) {
  console.log(">>> TẤT CẢ KIỂM THỬ TEST CONTRACT V1.2 ĐÃ HOÀN TẤT VÀ ĐẠT CHUẨN XUẤT SẮC! <<<");
}
