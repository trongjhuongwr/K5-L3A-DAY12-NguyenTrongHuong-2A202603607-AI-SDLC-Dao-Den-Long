# Ghi chép Giả định Phase 1 (PRD-0 & Test Contract v1.0)

## 1. Yêu cầu đã xác nhận
- **Nhân vật:** Mây, người giữ đèn, đội nón lá có treo đèn lồng nhỏ. Di chuyển trên mặt phẳng XZ (Y hướng lên).
- **Mục tiêu:** Thắp sáng 5 Đèn Lồng Lớn ($L_1 \dots L_5$) trên Đảo Bến trước khi trời sáng hoặc hết máu.
- **Bóng Mực:** Sinh vật mực đen đuổi theo Mây, sợ ánh sáng của Đèn Lồng Lớn.

## 2. Các giả định kỹ thuật đã thống nhất
1. **Pulse (Tỏa sáng) & Chi phí:**
   - Trừ vào số đom đóm đang giữ (`carried`). Chi phí `pulse_cost = 2`.
   - Nếu `carried < pulse_cost`: Không thể phát xung (pulse thất bại, không phát event, không trừ đom đóm).
   - Khi phát xung thành công: Đẩy lùi Bóng Mực trong bán kính `pulse_radius = 5.0m` ra xa $4.0m$ (`pulse_push_m`), chuyển trạng thái Bóng Mực sang `"stunned"` trong $3.0s$ (`pulse_stun_s`). Bắn event `pulse` với danh sách `stunned_ids` (mảng rỗng nếu không trúng con nào).
2. **Nạp ánh sáng (Deposit):**
   - Khi Mây ấn `interact` trong bán kính `interact_radius = 2.5m` của đèn chưa sáng: Nạp toàn bộ số đom đóm đang giữ (`carried`) vào đèn một lần duy nhất, tối đa đến mức đủ `lantern_cost = 5`.
   - Bắn event `deposit` với `{ lantern_id, amount, deposited }`.
   - Khi `deposited >= lantern_cost`, đèn chuyển `lit: true`, bắn event `lantern_lit`.
3. **Va chạm & Sát thương:**
   - Khi Mây chạm Bóng Mực (khoảng cách $\le 1.0m$): Mất 1 ngọn lửa (`flames`), đánh rơi `Math.floor(carried * 0.5)` đom đóm. Đom đóm rơi tan biến vào sương.
   - Nhận trạng thái bất tử `invuln_s = 1.5s` (không nhận thêm sát thương trong thời gian này).
   - Bắn event `player_hit` với `{ by: "shade", flames, dropped }`.
4. **Vùng an toàn (Safe Zone):**
   - Đèn đã thắp sáng tạo ra vùng an toàn bán kính `safe_radius = 4.5m`. Bóng Mực không thể tiến vào vùng này.
5. **Tính điểm (Score):**
   - Nhặt đom đóm: $+10$ điểm (`per_mote`).
   - Thắp đèn: $+100$ điểm (`per_lantern`).
   - Stun bóng mực: $+20$ điểm (`per_stun`).
   - Điểm bonus khi Thắng: `time_left_s * 2` + `flames * 50`.
6. **Điều kiện kết thúc:**
   - Thắng (`won`): Khi cả 5 đèn đều sáng $\rightarrow$ lý do `"all_lit"`.
   - Thua (`lost`): Hết máu (`flames <= 0`) $\rightarrow$ lý do `"no_flames"`; hoặc hết giờ (`time_left_s <= 0`) $\rightarrow$ lý do `"dawn"`.
7. **Bản đồ mặc định:**
   - Đảo tròn bán kính $R = 35m$, chân đặt tại $Y = 0$.
   - 5 Đèn lồng đặt đối xứng ở bán kính $R = 22m$.
   - `fall_enabled = false`: Mây được giữ trên đảo, không bị rơi khỏi mép.
