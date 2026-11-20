# AGENTS.md - Harness AI cho Đảo Đèn Lồng (Phase 2)

Tài liệu hướng dẫn dành cho AI Agents khi làm việc trên repository này.

## 1. Tổng quan dự án
- **Tên dự án:** Đảo Đèn Lồng (Day 12 - AI SDLC Lab - Phase 2)
- **Công nghệ:** TypeScript, Three.js, Vite, Node.js.
- **Mục tiêu:** Game 3D 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông) + Chế độ Headless tuân thủ Test Contract v1.1.

## 2. Quy tắc cốt lõi
- **Test Contract v1.1 là bắt buộc:** Không được làm vỡ logic của `headless_cmd` và `game.contract.json`.
- **Tách bạch Simulation và Rendering:**
  - Logic game thuần túy nằm ở `src/core/` (hoàn toàn không dùng DOM hay WebGL).
  - Giao diện 3D nằm ở `src/web/` sử dụng Three.js để render state từ `src/core/`.
- **Tính tất định (Determinism):** Cùng `--seed`, `--night`, `--scenario`, `--inputs` phải cho ra file output `.jsonl` giống hệt nhau từng byte.
- **Hiệu năng Headless:** Mô phỏng 1 đêm đầy đủ (21.600 tick) phải chạy xong trong ≤ 30 giây.
- **Tối đa 3 lệnh để cài và chạy:** `npm install`, `npm run build`, `npm run dev` (hoặc `node dist/headless.js`).

## 3. Lệnh vận hành
- Cài đặt thư viện: `npm install`
- Biên dịch headless: `npm run build:headless`
- Biên dịch toàn bộ: `npm run build`
- Chạy giao diện 3D: `npm run dev`
- Chạy toàn bộ test tự động: `npm test`

## 4. Quy ước Code & Git
- Commit nhỏ, rõ ràng, ghi rõ mục đích của từng thay đổi.
- Lưu trữ mọi bằng chứng kiểm chứng (test logs, output jsonl, screenshots) trong thư mục `docs/proof/phase-X/`.
- Luôn chạy kiểm thử regression test trước khi tạo commit hoặc gắn tag.
