# Đảo Đèn Lồng - Phase 3: "Đèn cạn dầu"

Dự án game 3D góc nhìn thứ ba phát triển theo quy trình AI SDLC.
Hỗ trợ đầy đủ chế độ chơi giao diện 3D trên nền web và chế độ Headless chạy tự động tuân thủ **Test Contract v1.2** (Change Request Ticket-03).

---

## 1. Cài đặt và Khởi chạy (Tối đa 3 lệnh)

```bash
# 1. Cài đặt thư viện và biên dịch headless
npm install && npm run build:headless

# 2. Khởi chạy game có giao diện 3D (3 Đêm chơi)
npm run dev

# 3. Chạy toàn bộ bộ kiểm thử tự động Test Contract v1.2
npm test
```

---

## 2. Hướng dẫn Điều khiển
- **W / A / S / D** hoặc **Phím mũi tên**: Di chuyển nhân vật Mây (6.0 m/s; có Bùa Gió: 7.2 m/s).
- **SPACE**: Nhảy ($V_y = 7.0$ m/s, trọng lực $-20$ m/s²).
- **SHIFT**: Lướt nhanh (Dash 14 m/s trong 0.2s, hồi chiêu 1.5s; có Bùa Gió: không hồi chiêu).
- **E**: Tương tác với Đèn Lồng:
  - **Đèn chưa sáng:** Nạp đom đóm thắp đèn (10 đom đóm lần đầu; 5 đom đóm khi thắp lại).
  - **Đèn đang sáng:** Châm thêm dầu (`used = min(đang mang, ceil((100 - fuel) / 10))`, mỗi đom đóm hồi 10 dầu).
- **Q**: Tỏa Sáng để xua đuổi và làm choáng Bóng Mực trong 5m, đuổi Gió Lạc (tốn 3 đom đóm).
- **Rê chuột (Click khóa chuột)**: Xoay góc nhìn 360° tự do quanh Mây không cần giữ nút chuột (chuẩn game 3D hiện đại).
- **C**: Căn góc nhìn camera lập tức ra ngay sau lưng Mây.
- **Cuộn chuột (Scroll wheel)**: Thu phóng khoảng cách camera (zoom gần/xa từ 3.5m đến 14m).
- **ESC / P**: Tạm dừng trò chơi (Pause), mở menu Cài đặt (Âm lượng, Độ nhạy chuột, Bảng màu dễ phân biệt).

---

## 3. Luật Cốt lõi Mới — Ticket-03 "Đèn cạn dầu" (Contract v1.2)
1. **Nhiên liệu Đèn Lồng (Fuel System):**
   - Đèn có mức nhiên liệu tối đa là 100. Khi vừa thắp hoặc thắp lại, `fuel = 100`.
   - Khi đang sáng, nhiên liệu tiêu hao tự nhiên với tốc độ `1.0 đơn vị/giây` (1/60 mỗi tick).
   - Người chơi có thể đến gần bất kỳ đèn đang sáng nào còn vơi dầu và bấm `E` để châm dầu. Đèn đầy dầu (100) sẽ không nhận thêm.
   - Khi cạn dầu (`fuel <= 0`): Đèn tắt hoàn toàn (`lit = false, fuel = 0, deposited = 0, ever_lit = true`), phát sự kiện `lantern_out`.
2. **Thắp lại Đèn đã tắt (Relighting):**
   - Đèn đã từng sáng trong Đêm (`ever_lit: true`) chỉ mất **5 đom đóm** để thắp lại (`relight_cost: 5`).
   - Phát sự kiện `lantern_lit { lantern_id, relight: true }`.
3. **Mất vùng an toàn & Bóng Mực hút dầu:**
   - Đèn có `fuel < 30` bị **mất vùng an toàn 6m**.
   - Bóng Mực đang tuần tra (`wander`) sẽ ưu tiên tìm đến đèn gần nhất có `fuel < 30`; khi vào cự ly 2.0m, Bóng Mực chuyển sang trạng thái `drain`, đứng yên và hút dầu với tốc độ **5.0 fuel/giây** (phát sự kiện `fuel_drain` mỗi 60 tick).
   - Nhiều Bóng Mực hút cùng một đèn sẽ cộng dồn tốc độ hút.
   - Nếu Mây đến gần ≤ 6m, Bóng Mực lập tức đổi sang `chase` săn người chơi.
   - Khi Mây châm dầu đèn lên ≥ 30, bất kỳ Bóng Mực nào trong vùng 6m sẽ bị đẩy ra ngoài trong 30 tick mà không gây sát thương.
4. **Điều kiện Thắng Mới — Sống sót tới Bình Minh (Dawn Survival):**
   - Không còn thắng sớm khi thắp hết đèn! Người chơi phải giữ các ngọn đèn sáng tới khi hết thời gian của Đêm.
   - Thời lượng: Đêm 1: 240s | Đêm 2: 270s | Đêm 3: 300s.
   - **Thắng:** Khi thời gian về 0, số đèn đang sáng $\ge \lceil 0.6 \times \text{tổng số đèn} \rceil$ (phát sự kiện `game_over { result: "won", reason: "dawn_survived" }`).
   - **Thua:** Khi thời gian về 0 mà số đèn sáng $< 60\%$ (`reason: "dawn"`), hoặc khi cạn ngọn lửa sinh mệnh (`flames <= 0`, `reason: "no_flames"`).
5. **Sức chứa Túi Tăng động (Dynamic Capacity):**
   - Bắt đầu ở 10 đom đóm. Mỗi lần thắp thành công một ngọn đèn mới lần đầu (`relight: false`), sức chứa tăng thêm +2:
     $$\text{capacity} = \min(20, 10 + 2 \times \text{successful\_lights})$$
   - Thắp lại đèn cũ không tăng sức chứa.
6. **Hệ thống Điểm số Mới:**
   - Nạp hoặc châm dầu: +5 điểm / đom đóm.
   - Thắp đèn lần đầu: +100 điểm.
   - Thắp lại đèn đã tắt: +40 điểm.
   - Làm choáng Bóng Mực: +5 điểm (+15 điểm nếu con đó đang hút dầu).
   - Thưởng khi Thắng Bình Minh: $+50$ điểm mỗi ngọn lửa còn lại + $(50 + \lfloor \text{fuel} \rfloor)$ mỗi đèn đang sáng.
7. **Hỗ trợ Tiếp cận Người khiếm thị màu (Colorblind Mode):**
   - Phân biệt hình khối: Đèn chưa sáng bị ép lùn 20% trục Y (`scale.y = 0.8`), đèn sáng giữ nguyên tỉ lệ chuẩn (`scale.y = 1.0`).
   - Phân biệt tần số: Đèn sắp tắt (`fuel < 30`) nhấp nháy chu kỳ 1 Hz.
   - Tùy chọn Bảng màu dễ phân biệt trong menu Pause: Mắt và hào quang Bóng Mực chuyển sang xanh lơ sáng `#00B3FF` (thay vì tím `#A033FF`); thông báo nguy cấp dùng chữ trắng `#FFFFFF` với ký hiệu ⚠.

---

## 4. Chế độ Headless & Test Contract v1.2
Chế độ Headless chạy độc lập không giao diện, đảm bảo tính tất định tuyệt đối (100% Determinism) và siêu tốc (21.600 ticks < 0.2s):
```bash
# Chạy Đêm 1
node dist/headless.js --seed 42 --night 1 --ticks 180 --out docs/proof/phase-3/test-night1.jsonl --snapshot-every 20

# Chạy Đêm 2
node dist/headless.js --seed 42 --night 2 --ticks 180 --out docs/proof/phase-3/test-night2.jsonl --snapshot-every 20

# Chạy Đêm 3
node dist/headless.js --seed 42 --night 3 --ticks 180 --out docs/proof/phase-3/test-night3.jsonl --snapshot-every 20
```

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
- **Quyết định Thiết kế (ADR-001):** [docs/notes/adr-001-fuel-and-win-condition.md](docs/notes/adr-001-fuel-and-win-condition.md)
- **Lịch sử Thay đổi (Changelog):** [CHANGELOG.md](CHANGELOG.md)
- **Nhật ký SDLC & AI:** [ai-log.md](docs/notes/ai-log.md)
- **Bằng chứng kiểm chứng Phase 3:** Thư mục [docs/proof/phase-3/](docs/proof/phase-3/)
- **Harness AI:** [AGENTS.md](AGENTS.md)
- **Ghi nhận nguồn:** [CREDITS.md](CREDITS.md)
