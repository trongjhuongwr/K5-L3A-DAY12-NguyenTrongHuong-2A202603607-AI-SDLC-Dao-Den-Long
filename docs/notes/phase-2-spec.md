# Đặc tả Kỹ thuật Phase 2 - Ticket-02 ("Ba hòn đảo")

## 1. Tiêu chí Nghiệm thu (Acceptance Criteria)

### AC-01: Bộ Số Liệu Chuẩn & Vật Lý 3D
- **Tốc độ chạy:** 6.0 m/s (khi có Bùa Gió: 7.2 m/s). Điều khiển trên không đầy đủ.
- **Nhảy:** Vận tốc $V_y = 7.0$ m/s, gia tốc trọng trường $g = -20$ m/s². Chỉ nhảy khi `grounded == true`.
- **Lướt (Dash):** Kích hoạt bằng nút `dash` (chuyển false $\rightarrow$ true). Tốc độ 14 m/s trong 0.2s (12 ticks). Hồi chiêu 1.5s (90 ticks). Hướng lướt theo hướng di chuyển hiện tại; nếu đứng yên lướt theo hướng mặt quay. Lướt trên không giữ nguyên độ cao $Y$. Đang lướt không bất tử.
- **Rơi khỏi đảo:** Khi $Y < -10$ m, mất 1 flame, mất toàn bộ đom đóm mang theo. Đợi 60 tick (không nhặt, không bị chạm), hồi sinh tại $(0,0,0)$ với vận tốc 0, bất tử 90 tick. Nếu hết flame $\rightarrow$ thua ngay (`no_flames`).

### AC-02: Đom Đóm & Nhặt & Rơi
- **Sức chứa:** 10 đom đóm.
- **Nhặt:** Tự động khi $d_{XZ} \le 1.0$ m và $|d_Y| \le 1.5$ m.
- **Số lượng ban đầu:** 20 đom đóm tại 20 điểm khác nhau. Trần tối đa 30.
- **Sinh định kỳ:** Tại tick 240, 480, ... sinh thêm 1 đom đóm ở một điểm trống nếu tổng số đom đóm trên bản đồ < 30.
- **Đom đóm rơi (Dropped):** Khi Mây bị chạm hoặc Gió Lạc bị pulse lúc đang mang đom đóm, đom đóm rơi văng ra vành $1.5 - 2.5$ m quanh Mây, TTL 480 ticks (8s), nhặt lại được từ tick tiếp theo.

### AC-03: Đèn Lồng & Vùng An Toàn
- **Chi phí:** 10 đom đóm / đèn. Nhớ tiến độ nạp.
- **Nạp đèn:** Bán kính tương tác $\le 2.0$ m. Mỗi lần bấm `interact` nạp $\min(\text{carried}, \text{còn thiếu})$ vào đèn gần nhất chưa sáng (nếu khoảng cách bằng nhau chọn id nhỏ hơn).
- **Vùng an toàn:** Đèn đã sáng tạo vùng bán kính 6.0 m. Bóng Mực ở ngoài bị chặn ở mép 6.0 m. Bóng Mực đang ở bên trong lúc đèn vừa thắp bị đẩy ra mép trong tối đa 30 tick và không gây sát thương trong lúc đó.

### AC-04: Tỏa Sáng (Pulse)
- **Chi phí / Bán kính / Hồi chiêu:** 3 đom đóm / 5.0 m / 3.0 s (180 ticks).
- **Tâm:** Chân Mây + 0.8m Y. Khoảng cách 3D tới tâm Bóng Mực $\le 5.0$ m.
- **Hiệu ứng:** Bóng Mực bị choáng 120 tick, trong 15 tick đầu bị đẩy lùi tổng cộng 4.0 m theo phương ngang (nếu trùng vị trí đẩy theo $+X$).

### AC-05: Bóng Mực (Shades)
- **Tốc độ:** 4.0 m/s (Đêm 3: 4.5 m/s).
- **Tầm phát hiện / Bỏ đuổi:** 12 m / 18 m.
- **Chạm:** $d_{XZ} \le 1.0$ m và $|d_Y| \le 1.5$ m. Tối đa 1 lần mất ngọn lửa mỗi tick. Bóng gây hit bị recoil lùi 2.0 m trong 60 tick.
- **Trạng thái chuẩn hóa:** `spawning`, `wander`, `chase`, `recoil`, `stunned`.

### AC-06: Gió Lạc (Drifter - Đêm 2 & 3)
- Tốc độ 7.0 m/s, tối đa 2 con, sinh tại tick 1200, 2400, ...
- Trạng thái: `idle` (2 m/s) $\rightarrow$ `chase` (khi Mây mang $\ge 5$ đom đóm và cách $\le 15$ m) $\rightarrow$ `flee` $\rightarrow$ `removed`.
- Chạm ($d_{XZ} \le 1.2$ m): cướp $\min(3, \text{carried})$ đom đóm, chuyển `flee` bay xa 7 m/s trong 240 tick rồi biến mất cùng đom đóm đã cướp.
- Tỏa Sáng trúng lúc `chase` $\rightarrow$ chuyển `flee` không cướp; trúng lúc `flee` có mang đom đóm $\rightarrow$ thả toàn bộ đom đóm tại chỗ thành dropped motes, biến mất sau 120 tick.

### AC-07: Bùa Gió (Charm)
- $C_1, C_2$. Nhặt như đom đóm.
- Hiệu lực 600 tick: tốc độ 7.2 m/s, Lướt không có hồi chiêu (vẫn cần nhấn lại phím).
- Hồi sinh sau 2700 tick.

### AC-08: Bục Nhảy & Gió Mạnh
- **Bục nhảy Đêm 2:** r=1m tại (20,0,18) và (50,0,-18). Phóng $V_y = 14$ m/s, $V_{XZ} = 24$ m/s về tâm đảo đối diện.
- **Bục nhảy Đêm 3:** r=1m tại (0,3,13). Phóng $V_y = 12$ m/s, $V_{XZ} = 8$ m/s hướng $-Z$ lên Tầng 2.
- **Gió mạnh Đêm 3:** Mỗi 30s có cơn gió 5s theo hướng ngẫu nhiên, đẩy người chơi 2 m/s. Báo trước 2s.

### AC-09: Tạm Dừng (Pause)
- Kích hoạt bằng `pause: true`.
- Khi pause: `tick` vẫn tăng nhưng `sim_tick`, timer, cooldown, spawn đứng yên; snapshot ghi `state: "paused"`. Phát event `paused` và `resumed`.

### AC-10: Test Contract v1.1
- Khớp định dạng JSONL Contract v1.1: snapshot có `night`, `wind`, `player.vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`, và các mảng `motes`, `drifters`, `charms`.
- Đầy đủ các sự kiện mới: `dash`, `charm_picked`, `drifter_steal`, `drifter_drop`, `night_start`, `paused`, `resumed`.
