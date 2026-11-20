import { execSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";

console.log("=== BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG TEST CONTRACT V1.0 ===");

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
console.log("1. Build headless...");
execSync("npm run build:headless", { stdio: "ignore" });
assert(fs.existsSync("dist/headless.js"), "Build bundle dist/headless.js tồn tại");

// 2. Default run
console.log("2. Chạy kịch bản mặc định 120 ticks...");
execSync("node dist/headless.js --seed 42 --night 1 --ticks 120 --out docs/proof/phase-1/verify-default.jsonl --snapshot-every 20");
const defaultLines = fs.readFileSync("docs/proof/phase-1/verify-default.jsonl", "utf-8").trim().split("\n");
assert(defaultLines.length >= 7, "Output có đủ snapshot và end line");
const firstLine = JSON.parse(defaultLines[0]);
assert(firstLine.type === "snapshot" && firstLine.tick === 0, "Snapshot đầu tiên tại tick 0");
const lastLine = JSON.parse(defaultLines[defaultLines.length - 1]);
assert(lastLine.type === "end" && lastLine.ticks === 120, "End line chính xác tại tick 120");

// 3. Determinism check
console.log("3. Kiểm tra tính tất định (Determinism)...");
execSync("node dist/headless.js --seed 123 --night 1 --ticks 100 --out docs/proof/phase-1/det-1.jsonl");
execSync("node dist/headless.js --seed 123 --night 1 --ticks 100 --out docs/proof/phase-1/det-2.jsonl");
const h1 = crypto.createHash("sha256").update(fs.readFileSync("docs/proof/phase-1/det-1.jsonl")).digest("hex");
const h2 = crypto.createHash("sha256").update(fs.readFileSync("docs/proof/phase-1/det-2.jsonl")).digest("hex");
assert(h1 === h2, "Hai lần chạy cùng seed ra SHA256 giống hệt nhau 100%");

// 4. Mote & Deposit
console.log("4. Kiểm tra Scenario Nhặt đom đóm & Nạp đèn...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-mote-and-deposit.json --inputs tests/scenarios/inputs-mote-and-deposit.json --ticks 60 --out docs/proof/phase-1/verify-deposit.jsonl");
const depositLines = fs.readFileSync("docs/proof/phase-1/verify-deposit.jsonl", "utf-8").trim().split("\n");
const eventsDeposit = depositLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(eventsDeposit.some(e => e.name === "mote_picked" && e.data.carried === 1), "Event mote_picked chính xác");
assert(eventsDeposit.some(e => e.name === "deposit" && e.data.lantern_id === "L1" && e.data.deposited === 1), "Event deposit chính xác");

// 5. Pulse Stun
console.log("5. Kiểm tra Scenario Tỏa sáng & Stun bóng mực...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-pulse-stun.json --inputs tests/scenarios/inputs-pulse-stun.json --ticks 20 --out docs/proof/phase-1/verify-pulse.jsonl");
const pulseLines = fs.readFileSync("docs/proof/phase-1/verify-pulse.jsonl", "utf-8").trim().split("\n");
const eventsPulse = pulseLines.map(l => JSON.parse(l)).filter(o => o.type === "event");
assert(eventsPulse.some(e => e.name === "pulse" && e.data.stunned_ids && e.data.stunned_ids.includes("S1")), "Event pulse làm stun S1 chính xác");

// 6. Win condition
console.log("6. Kiểm tra Điều kiện Thắng (all_lit)...");
execSync("node dist/headless.js --seed 42 --night 1 --scenario tests/scenarios/scenario-win.json --inputs tests/scenarios/inputs-win.json --ticks 20 --out docs/proof/phase-1/verify-win.jsonl");
const winLines = fs.readFileSync("docs/proof/phase-1/verify-win.jsonl", "utf-8").trim().split("\n");
const winEnd = JSON.parse(winLines[winLines.length - 1]);
assert(winEnd.type === "end" && winEnd.state === "won", "Kết thúc trạng thái 'won'");

// 7. Error code 2 on malformed file
console.log("7. Kiểm tra mã thoát 2 khi file input/scenario lỗi...");
try {
  execSync("node dist/headless.js --seed 42 --night 1 --scenario non_existent.json --ticks 10 --out test.jsonl", { stdio: "ignore" });
  assert(false, "Mã thoát phải là 2 khi thiếu file");
} catch (e) {
  assert(e.status === 2, "Chính xác mã thoát 2 khi file scenario không hợp lệ");
}

console.log(`\n=== TỔNG KẾT: ĐẠT ${passed}/${total} TIÊU CHÍ KIỂM THỬ ===`);
if (passed === total) {
  console.log(">>> TẤT CẢ KIỂM THỬ TEST CONTRACT V1.0 ĐÃ HOÀN TẤT VÀ ĐẠT CHUẨN! <<<");
}
