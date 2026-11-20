# Đảo Đèn Lồng - v1.0.0 (Phase 4: "Bình minh")

Dự án game 3D góc nhìn thứ ba phát triển theo quy trình AI SDLC chuẩn mực.
Hỗ trợ đầy đủ chế độ chơi giao diện 3D trên nền web và chế độ Headless chạy tự động tuân thủ **Test Contract v1.3** (Ticket-04).

---

## 1. Cài đặt và Khởi chạy (Tối đa 3 lệnh)

```bash
# 1. Cài đặt thư viện và biên dịch toàn bộ bundle (headless, soak, bench)
npm install && npm run build:headless

# 2. Khởi chạy game có giao diện 3D (3 Đêm chơi, Bảng xếp hạng, Tùy chỉnh phím)
npm run dev

# 3. Chạy toàn bộ bộ kiểm thử tự động Test Contract v1.3
npm test
```

---

## 2. Hướng dẫn Điều khiển & Tùy biến Phím
- **W / A / S / D** hoặc **Phím mũi tên**: Di chuyển nhân vật Mây (6.0 m/s; có Bùa Gió: 7.2 m/s). *(Có thể đổi phím trong Menu Pause)*
- **SPACE**: Nhảy ($V_y = 7.0$ m/s, trọng lực $-20$ m/s²). *(Có thể đổi phím)*
- **SHIFT**: Lướt nhanh (Dash 14 m/s trong 0.2s, hồi chiêu 1.5s; có Bùa Gió: không hồi chiêu). *(Có thể đổi phím)*
- **E**: Tương tác với Đèn Lồng (Nạp đom đóm thắp sáng hoặc châm dầu). *(Có thể đổi phím)*
- **Q**: Tỏa Sáng để xua đuổi và làm choáng Bóng Mực trong 5m, đuổi Gió Lạc (tốn 3 đom đóm). *(Có thể đổi phím)*
- **Rê chuột (Click khóa chuột)**: Xoay góc nhìn 360° tự do quanh Mây không cần giữ nút chuột (chuẩn game 3D hiện đại).
- **C**: Căn góc nhìn camera lập tức ra ngay sau lưng Mây.
- **Cuộn chuột (Scroll wheel)**: Thu phóng khoảng cách camera (zoom gần/xa từ 3.5m đến 14m).
- **ESC / P**: Tạm dừng trò chơi (Pause), mở menu Cài đặt và Hỗ trợ tiếp cận.

---

## 3. Các Lệnh Thực thi Chuẩn (Contract v1.3)

### 3.1. Chế độ Benchmark Hiệu năng (<bench_cmd>)
Đo hiệu năng cảnh chuẩn: 200 Bóng Mực wander, 100 đom đóm, 3 đèn sáng 100 fuel, camera bay quỹ đạo tròn bán kính 30m, cao 15m (15s/vòng), khởi động 3s không đo, đo đúng `--duration` giây:
```bash
node dist/bench.js --seed 42 --duration 30 --out bench.json
```
- Kết quả benchmark đạt chuẩn: `avg_fps >= 60`, `p1_low_fps >= 30`, `load_ms <= 10000`.

### 3.2. Chế độ Soak Test Ổn định Dài hạn (<soak_cmd>)
Chạy 10 đêm liên tiếp trong cùng một tiến trình, input ngẫu nhiên theo seed, kiểm tra rò rỉ bộ nhớ:
```bash
node dist/soak.js --seed 7 --nights 10 --out soak.json
```
- Ngưỡng đạt: `crashes = 0` và `mem_end_mb <= 1.2 * mem_start_mb`.

### 3.3. Xuất Bảng Xếp Hạng Cục bộ (<run_cmd> / <headless_cmd> --export-leaderboard)
Xuất Top 10 bảng xếp hạng ra tệp JSON đúng thứ tự điểm giảm dần:
```bash
node dist/headless.js --export-leaderboard out.json
```

### 3.4. Chế độ Headless Mô phỏng Đêm chơi
```bash
# Đêm 1
node dist/headless.js --seed 42 --night 1 --ticks 180 --out docs/proof/phase-4/test-night1.jsonl --snapshot-every 20

# Đêm 2
node dist/headless.js --seed 42 --night 2 --ticks 180 --out docs/proof/phase-4/test-night2.jsonl --snapshot-every 20

# Đêm 3
node dist/headless.js --seed 42 --night 3 --ticks 180 --out docs/proof/phase-4/test-night3.jsonl --snapshot-every 20
```

---

## 4. Tính năng Tiếp cận Toàn diện (Accessibility)
- **Đổi phím điều khiển (Key Rebinding):** Người chơi có thể gán lại phím cho cả 9 hành động (tiến, lùi, trái, phải, nhảy, lướt, tương tác, tỏa sáng, tạm dừng). Hệ thống tự động phát hiện trùng phím và cung cấp nút "Khôi phục mặc định". Phím lưu vào `localStorage`.
- **Phụ đề & Chỉ báo nguy hiểm:**
  - Thông báo phụ đề chữ lớn khi Bóng Mực xuất hiện, cảnh báo trước 3s khi gió giật sắp tới, đếm ngược 10s cuối trước bình minh, và cảnh báo khi đèn dưới 30% dầu.
  - Mũi tên cảnh báo quanh mép màn hình (Threat Overlay) chỉ hướng tiếp cận của Bóng Mực đang áp sát.
- **Giảm chuyển động (Reduced Motion):** Tùy chọn triệt tiêu hiệu ứng rung lắc camera và chớp màn hình.
- **Cỡ chữ UI lớn (x1.25):** Toàn bộ văn bản giao diện thiết kế tối thiểu 18px ở 1280x720, hỗ trợ chế độ phóng to x1.25 rõ nét.
- **Bảng màu dễ phân biệt (Colorblind Mode):** Mắt và hào quang Bóng Mực chuyển màu xanh lơ sáng `#00B3FF` thay cho tím; đèn chưa sáng bị ép lùn 20% trục Y (`scale.y = 0.8`), đèn sắp tắt nhấp nháy 1 Hz.

---

## 5. Sáng tạo của tôi (Creative Additions)
- **Thanh đo nhiên liệu 3D trực quan:** Cột đo dầu màu xanh neon lơ lửng trên đỉnh từng ngọn Đèn Lồng, co lại theo thời gian thực và chuyển đỏ nhấp nháy 1 Hz khi sắp cạn dầu (< 30%).
- **Cốt truyện & Lời dặn Ông Đăng mở rộng:** Từng đêm có lời nhắn gửi giàu chất thơ từ người giữ đèn tiền bối, chuẩn bị tâm lý cho người chơi trước thử thách sinh tồn dài hơi.
- **Mô hình Mây 3D sống động:** Nhân vật áo lam với chiếc khăn đỏ, đội nón lá treo lồng đèn nhỏ phát sáng ấm áp đung đưa, hoạt ảnh bước chân đung đưa tay chân và tự động xoay mượt mà theo hướng di chuyển.
- **Cột sáng Beacon dẫn đường:** Mỗi ngọn Đèn Lồng Lớn chiếu một cột sáng ấm áp cao 45m lên bầu trời đêm, giúp người chơi dễ dàng định hướng vị trí đèn từ bất kỳ đâu trên đảo.
- **Bản đồ Radar Vệ tinh (Minimap 2D):** HUD góc trên bên phải hiển thị bản đồ trực quan theo thời gian thực (vị trí Mây, các ngọn đèn, đom đóm, quái vật, phạm vi vùng an toàn bị tắt khi fuel < 30).
- **Hệ thống Nhiệm vụ Động (Dynamic Quest Tracker):** Tự động phát hiện và cảnh báo đèn nào đang sắp hết dầu (`⚠ Đèn X sắp cạn dầu!`), hướng dẫn số lượng đom đóm cần nạp hoặc châm dầu.
- **Biển mây bồng bềnh & Bảng màu cổ tích chuẩn:** Sử dụng chính xác bảng màu chuẩn (#0E1430, #2F5D50, #C9B48A, #6B4A2F, #12384A, #FFB347, #FFE9B0,...).
- **Âm thanh tổng hợp (Procedural Audio):** Hệ thống âm thanh độc lập tạo bằng Web Audio API không phụ thuộc tệp tài nguyên ngoài, hỗ trợ tùy chỉnh âm lượng và độ nhạy chuột lưu vào `localStorage`.
- **Bảo đảm Test Contract:** Toàn bộ phần sáng tạo đồ họa và âm thanh chỉ nằm ở tầng hiển thị, tắt hoàn toàn khi chạy headless.

---

## 6. Tài liệu và Bằng chứng Kiểm chứng
- **Báo cáo Tổng kết Dự án (Retrospective):** [docs/notes/retro.md](docs/notes/retro.md)
- **Quyết định Thiết kế (ADR-001):** [docs/notes/adr-001-fuel-and-win-condition.md](docs/notes/adr-001-fuel-and-win-condition.md)
- **Lịch sử Thay đổi (Changelog):** [CHANGELOG.md](CHANGELOG.md)
- **Nhật ký SDLC & AI:** [ai-log.md](docs/notes/ai-log.md)
- **Kết quả Benchmark:** [bench.json](bench.json)
- **Kết quả Soak Test:** [soak.json](soak.json)
- **Bằng chứng kiểm chứng Phase 4:** Thư mục [docs/proof/phase-4/](docs/proof/phase-4/)
- **Harness AI:** [AGENTS.md](AGENTS.md)
- **Ghi nhận nguồn:** [CREDITS.md](CREDITS.md)
- **Giấy phép:** [LICENSE](LICENSE)
