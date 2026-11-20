# CHANGELOG — Đảo Đèn Lồng

Toàn bộ lịch sử cập nhật và các thay đổi phá vỡ (Breaking Changes) qua các Phase phát triển.

---

## [Phase 3] — Contract v1.2 (2026-11-20)
**Change Request Ticket-03: "Đèn cạn dầu"**

### ⚠ Breaking Changes (Thay đổi phá vỡ)
1. **Contract Version:** Nâng từ `1.1` lên `1.2` (`game.contract.json`).
2. **Luật Thắng:** Không còn thắng sớm khi thắp hết đèn trên đảo. Người chơi phải duy trì ánh sáng cho tới khi hết giờ (`timeLeftS <= 0`).
   - Thắng: Khi hết thời gian, số đèn đang sáng đạt tối thiểu 60% tổng số đèn trên đảo (`reason: "dawn_survived"`).
   - Thua: Hết thời gian mà < 60% đèn sáng (`reason: "dawn"`), hoặc hết ngọn lửa (`reason: "no_flames"`).
3. **Thời lượng các Đêm:** Kéo dài để thử thách sức bền sinh tồn:
   - Đêm 1: 240s (trước là 180s).
   - Đêm 2: 270s (trước là 210s).
   - Đêm 3: 300s (trước là 240s).
4. **Nhiên liệu Đèn Lồng (Fuel System):**
   - Đèn đã sáng tiếp tục nhận đom đóm để châm dầu (trước đây từ chối nạp khi đã sáng).
   - Nhiên liệu tối đa là 100, tiêu hao tự nhiên 1.0 fuel/giây.
   - Khi `fuel <= 0`, đèn tắt hoàn toàn (`lit = false, deposited = 0, fuel = 0, ever_lit = true`), phát sự kiện `lantern_out`.
   - Chi phí thắp lại đèn đã từng sáng (`ever_lit: true`) giảm xuống còn 5 đom đóm (`relight_cost: 5`). Sự kiện thắp lại mang cờ `relight: true`.
5. **Vùng an toàn & Bóng Mực:**
   - Đèn có `fuel < 30` bị mất bán kính an toàn 6m.
   - Bóng Mực có thêm trạng thái `drain`: đứng yên gần đèn < 30 fuel và hút 5.0 fuel/giây. Định kỳ 60 tick phát sự kiện `fuel_drain`.
6. **Snapshot Schema:**
   - Bổ sung `fuel`, `ever_lit`, `relit_count` vào từng object trong `lanterns[]`.
   - Bổ sung `capacity` vào `player`.
7. **Sự kiện mới & Payload:**
   - Sự kiện mới: `refuel { lantern_id, fuel, amount }`.
   - Sự kiện mới: `lantern_out { lantern_id }`.
   - Sự kiện mới: `fuel_drain { lantern_id, shade_id, fuel }`.
   - Cập nhật sự kiện: `lantern_lit { lantern_id, relight: boolean }`.
   - Cập nhật sự kiện: `game_over { result: "won", reason: "dawn_survived" }`.

### ✨ Tính năng mới (New Features)
- **Sức chứa túi tăng động (Dynamic Capacity):** Bắt đầu ở 10, tăng +2 sau mỗi lần thắp thành công một ngọn đèn mới (`capacity = min(20, 10 + 2 * successful_lights)`).
- **Thanh đo nhiên liệu 3D (Fuel Gauge):** Hiển thị thanh đo năng lượng trực quan lơ lửng trên đỉnh từng Đèn Lồng.
- **Chế độ Tiếp cận cho Người khiếm thị màu (Colorblind Mode):**
  - Đèn chưa sáng bị ép lùn 20% trục Y (`scale.y = 0.8`).
  - Đèn sắp tắt (< 30) nhấp nháy 1 Hz.
  - Tùy chọn Bảng màu dễ phân biệt: Mắt/hào quang Bóng Mực xanh lơ sáng `#00B3FF` thay cho tím; cảnh báo HUD hiển thị chữ trắng `#FFFFFF` kèm icon ⚠.
- **Hệ thống Điểm số Mới:**
  - +5 điểm / đom đóm nạp hoặc châm dầu.
  - +100 điểm khi thắp đèn lần đầu; +40 điểm khi thắp lại đèn tắt.
  - +5 điểm làm choáng Bóng Mực; +15 điểm nếu Bóng Mực đang hút trộm dầu.
  - Thưởng thắng bình minh: +50 / ngọn lửa còn lại + (50 + floor(fuel)) / đèn đang sáng. Bỏ thưởng thời gian.

---

## [Phase 2] — Contract v1.1 (2026-11-20)
**Ticket-02: "Ba hòn đảo"**

- Mở rộng chiến dịch thành 3 Đêm: Đảo Bến (Đêm 1), Đảo Cau (Đêm 2 với Bục nhảy, Cầu tre, Gió Lạc và Bùa Gió), Đảo Chuông (Đêm 3 với 3 tầng địa hình giật gió).
- Thêm kỹ năng Lướt (Dash: 14 m/s, 0.2s, hồi chiêu 1.5s).
- Thêm cơ chế Rơi khỏi đảo & Hồi sinh (Fall & Respawn).
- Thêm cơ chế Gió Lạc (Drifter) cướp đom đóm và Bùa Gió (Wind Charm) tăng tốc & xóa hồi chiêu lướt.
- Tùy chỉnh camera tự do 360 độ góc nhìn thứ 3 hỗ trợ Pointer Lock.

---

## [Phase 1] — Contract v1.0 (2026-11-20)
**Ticket-01: "Đảo Bến"**

- Khởi tạo kiến trúc phân tầng độc lập: Core Simulation (thuần túy tất định, 60 FPS) và Web View (Three.js 3D).
- Các cơ chế nền tảng: Di chuyển, Nhảy, Nhặt đom đóm, Thắp đèn lồng, Vùng an toàn 6m, Tỏa Sáng (Pulse), Bóng Mực tuần tra và săn đuổi.
- Chế độ Headless CLI chạy với `--seed`, `--night`, `--ticks`, `--out`, `--snapshot-every`.
