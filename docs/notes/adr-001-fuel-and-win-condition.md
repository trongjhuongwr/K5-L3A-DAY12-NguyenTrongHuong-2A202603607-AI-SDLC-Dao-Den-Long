# ADR-001: Hệ thống Nhiên liệu Đèn Lồng (Fuel System) & Điều kiện Thắng Bình Minh (Dawn Survival)

- **Trạng thái:** Chấp nhận (Accepted)
- **Ngày:** 2026-11-20
- **Tác giả:** Đội ngũ Kỹ thuật Đảo Đèn Lồng
- **Liên quan:** Ticket-03 (Phase 3), Test Contract v1.2

---

## 1. Bối cảnh (Context)
Trong Phase 2 (Test Contract v1.1), trò chơi kết thúc ngay khi người chơi thắp sáng toàn bộ Đèn Lồng trên đảo. Playtest cho thấy người chơi giỏi có thể hoàn thành việc thắp đèn chỉ trong khoảng 2 phút, khiến giai đoạn sau của Đêm bị bỏ trống, thiếu áp lực thời gian và căng thẳng sinh tồn.

Ticket-03 đặt ra Change Request cốt lõi:
- Đèn sau khi thắp có thể cạn dầu và tắt nếu không được châm thêm đom đóm.
- Mục tiêu chuyển dịch từ "thắp hết đèn nhanh nhất" sang "giữ cho đảo sáng rực rỡ tới khi bình minh ló rạng".
- Quái vật Bóng Mực có thêm hành vi chủ động tìm đến đèn sắp tắt để hút nhiên liệu.

---

## 2. Quyết định Kiến trúc (Decisions)

### 2.1. Biểu diễn Nhiên liệu và Tính toán Tất định (Determinism)
- **Vấn đề:** Hao hụt nhiên liệu 1.0 đơn vị/giây (1/60 đơn vị mỗi tick) nếu dùng số thực dấu phẩy động (`number`) sẽ gặp sai số tích lũy (floating-point precision drift) giữa các nền tảng OS và CPU khác nhau, vi phạm quy tắc Tất định tuyệt đối của Headless runner.
- **Giải pháp:** Sử dụng biến đếm nguyên `fuel_ticks` (0 đến 6000 tick, tương ứng 100.0 đơn vị nhiên liệu với tỉ lệ 60 tick = 1.0 fuel).
  - Mỗi tick đèn sáng: `fuel_ticks = Math.max(0, fuel_ticks - 1)`.
  - Khi Bóng Mực hút: trừ thêm 5 tick cho mỗi con trong bán kính 2m mỗi tick.
  - Khi xuất snapshot hoặc event: chuyển đổi `fuel = round1(fuel_ticks / 60.0)`.

### 2.2. Máy Trạng thái Đèn Lồng (Lantern State Machine)
Đèn Lồng được mở rộng từ 2 trạng thái (`unlit`, `lit`) thành chu trình tuần hoàn:
1. **Chưa sáng (Unlit):** `lit = false, deposited < cost`.
   - Chi phí thắp lần đầu: `lantern_cost: 10`.
   - Chi phí thắp lại (Relight): `relight_cost: 5` (khi `ever_lit === true`).
2. **Đang cháy ổn định (Lit - Safe):** `lit = true, fuel >= 30`.
   - Vùng an toàn 6m hoạt động, đẩy lùi Bóng Mực.
3. **Đang cháy nguy cấp (Lit - Low Fuel):** `lit = true, fuel < 30`.
   - Mất vùng an toàn 6m.
   - Bóng Mực trạng thái `wander` ưu tiên chuyển hướng tiếp cận đèn này để hút dầu (`drain`).
   - Giao diện 3D: Cột đo dầu đổi sang màu đỏ nhấp nháy 1 Hz; người khiếm thị nhận diện qua nhấp nháy và ký hiệu ⚠.
4. **Cạn dầu và Tắt (Extinguished):** `fuel <= 0`.
   - Phát sự kiện `lantern_out`.
   - Chuyển về `lit = false, deposited = 0, fuel = 0, ever_lit = true`.
   - Trở thành mục tiêu cần thắp lại với chi phí giảm còn 5 đom đóm.

### 2.3. Máy Trạng thái Kẻ địch (Shade Drain State)
- Thêm trạng thái `drain` cho Bóng Mực:
  - Khi đang `wander` và nằm trong bán kính 2.0m của đèn có `fuel < 30`, chuyển sang `drain`.
  - Ở trạng thái `drain`, Bóng Mực đứng yên và hút 5.0 fuel/s.
  - Nếu Mây đến gần ≤ 6.0m: ngay lập tức chuyển sang `chase` săn người chơi.
  - Nếu bị Mây Tỏa Sáng (`pulse`): chuyển sang `stunned`, thưởng +15 điểm (thay vì +5).
  - Nếu đèn được châm dầu lên ≥ 30: đẩy Bóng Mực ra mép vùng 6m trong 30 tick mà không gây sát thương cho người chơi.

### 2.4. Điều kiện Thắng / Thua Mới (Dawn Survival)
- Thời lượng các Đêm kéo dài:
  - Đêm 1: 240 giây (thay vì 180s).
  - Đêm 2: 270 giây (thay vì 210s).
  - Đêm 3: 300 giây (thay vì 240s).
- Không còn thắng sớm khi thắp đủ đèn.
- Khi hết thời gian (`timeLeftS <= 0`):
  - Số đèn đang sáng `lit >= Math.ceil(0.6 * totalLanterns)`: THẮNG (`game_over { result: "won", reason: "dawn_survived" }`).
  - Số đèn đang sáng `< 60%`: THUA (`game_over { result: "lost", reason: "dawn" }`).
- Thua ngay lập tức nếu hết ngọn lửa (`flames <= 0`, lý do `no_flames`).

### 2.5. Sức chứa Túi Tăng động (Dynamic Capacity)
- Bắt đầu mỗi Đêm: sức chứa là 10.
- Mỗi lần thắp thành công một ngọn đèn lần đầu (`relight: false`): `capacity = Math.min(20, 10 + 2 * successful_lights)`.
- Tạo cảm giác tiến trình (progression) rõ rệt: người chơi càng thắp nhiều đèn thì túi càng lớn, giảm số lần phải đi nhặt lại đom đóm ở cuối Đêm.

### 2.6. Thiết kế Tiếp cận - Hỗ trợ Người khiếm thị màu (Colorblind Accessibility)
- Thay đổi hình học (Shape cue): Đèn chưa sáng bị ép lùn 20% trục Y (`scale.y = 0.8`), đèn sáng giữ nguyên tỉ lệ chuẩn (`scale.y = 1.0`).
- Nhấp nháy tần số (Frequency cue): Đèn sắp tắt (`fuel < 30`) nhấp nháy 1 Hz.
- Chế độ "Bảng màu dễ phân biệt":
  - Bóng Mực: Đổi hào quang và mắt từ tím (`#A033FF`) sang xanh lơ sáng (`#00B3FF`).
  - Giao diện HUD: Cảnh báo dùng chữ trắng `#FFFFFF` tương phản cao và đính kèm ký hiệu ⚠ trực quan.

---

## 3. Hệ quả (Consequences)
- **Tích cực:**
  - Gameplay cuối trận cực kỳ kịch tính: Người chơi phải liên tục cân đối giữa việc đi thắp đèn mới, tuần tra tiếp dầu cho các đèn cũ và tiêu diệt Bóng Mực đang hút trộm dầu.
  - Headless Runner hoàn toàn tất định từng tick nhờ cơ chế `fuel_ticks` số nguyên.
  - Test Suite đạt độ phủ 100% cho mọi nhánh rẽ logic của Test Contract v1.2.
- **Lưu ý tương thích:**
  - Test Contract v1.1 không còn tương thích do schema snapshot bổ sung trường `fuel`, `ever_lit`, `relit_count`, `capacity` và sự kiện thắng đổi thành `dawn_survived`. Đã bump contract version lên `1.2`.
