# Đảo Đèn Lồng - Phase 1 (Đêm 1: Đảo Bến)

Dự án game 3D góc nhìn thứ ba phát triển theo quy trình AI SDLC.

## 1. Cài đặt và Khởi chạy (Tối đa 3 lệnh)

```bash
# 1. Cài đặt thư viện và biên dịch headless
npm install && npm run build:headless

# 2. Khởi chạy game có giao diện 3D
npm run dev

# 3. Chạy kiểm thử chế độ headless theo Test Contract v1.0
npm test
```

## 2. Hướng dẫn Điều khiển
- **W / A / S / D** hoặc **Phím mũi tên**: Di chuyển nhân vật Mây.
- **E**: Nạp đom đóm vào Đèn Lồng Lớn (trong phạm vi 2.5m).
- **Q**: Tỏa sáng để xua đuổi và làm choáng Bóng Mực (tốn 2 đom đóm).
- **Space**: Nhảy.
- **Chuột (kéo giữ)**: Xoay camera 3D quanh nhân vật.

## 3. Quy tắc Tính điểm (Scoring)
- **Nhặt đom đóm:** +10 điểm / con.
- **Thắp sáng Đèn Lồng Lớn:** +100 điểm / đèn.
- **Làm choáng Bóng Mực:** +20 điểm / lần.
- **Thưởng khi Thắng:** `Math.floor(thời_gian_còn_lại * 2) + số_ngọn_lửa * 50`.

## 4. Chế độ Headless & Test Contract v1.0
Game hỗ trợ chạy không cần giao diện, không cần GPU, ở tốc độ 60 ticks/giây:
```bash
node dist/headless.js --seed 42 --night 1 --ticks 180 --out docs/proof/phase-1/test-default.jsonl --snapshot-every 20
```

## 5. Sáng tạo của tôi (Creative Additions)
- **Mô hình nhân vật Mây truyền thống:** Trang phục áo lam, đội nón lá với lồng đèn nhỏ đung đưa theo từng bước chân.
- **Biển mây bồng bềnh:** Hiệu ứng mây lơ lửng xung quanh Đảo Bến tạo cảm giác tiên cảnh huyền ảo.
- **Âm thanh tổng hợp (Procedural Audio):** Hệ thống âm thanh độc lập tạo bằng Web Audio API không phụ thuộc tệp tài nguyên ngoài.
- **Bảo đảm Test Contract:** Toàn bộ phần sáng tạo đồ họa và âm thanh chỉ nằm ở tầng hiển thị, hoàn toàn không ảnh hưởng đến logic headless.

## 6. Các Giả định Thiết kế Chi tiết (Design Assumptions - Trả lời CP1)
1. **Nhặt đom đóm:**
   - Mây tự động nhặt đom đóm khi khoảng cách $XZ \le 1.5m$ (`pickup_radius`).
   - Sức chứa tối đa là 10 (`carry_capacity`). Khi đã đầy túi (`carried == 10`), Mây không nhặt thêm đom đóm khi đi ngang qua chúng cho đến khi nạp bớt vào đèn.
   - Mỗi lần nhặt ghi 1 event `mote_picked` với số lượng `carried` mới.
2. **Nạp đèn:**
   - Khi Mây nhấn `E` (`interact: true`) trong bán kính $XZ \le 2.5m$ (`interact_radius`) của đèn chưa sáng, nạp `amount = Math.min(carried, lantern_cost - deposited)`.
   - `deposited` tăng đúng bằng `amount`, `carried` giảm đúng bằng `amount`. Không bao giờ làm mất đom đóm âm thầm.
3. **Pulse (Tỏa sáng):**
   - Chi phí `pulse_cost = 2` trừ trực tiếp vào `carried`.
   - Nếu `carried < pulse_cost`: Không thể kích hoạt, không ghi event `pulse`.
   - Nếu kích hoạt thành công: Ghi event `pulse` kèm danh sách `stunned_ids` và làm choáng Bóng Mực trong 3.0s (`pulse_stun_s`), đẩy lùi 4.0m (`pulse_push_m`).
4. **Bị chạm:**
   - Khi Bóng Mực chạm Mây (khoảng cách $\le 1.0m$), Mây mất 1 flame, rơi `Math.floor(carried * 0.5)` đom đóm (`hit_drop_ratio = 0.5`).
   - Đom đóm rơi tan biến vào sương để giữ số lượng thực thể ổn định. `carried` mới = `carried` cũ − `dropped`. Mây nhận 1.5s bất tử (`invuln_s`).
5. **Thứ tự trong cùng một tick:**
   - Sự kiện (Event) ghi ngay khi xảy ra (tick = $k+1$).
   - Snapshot định kỳ (`--snapshot-every`) ghi ở cuối bước sau khi các event của bước đó đã ghi.
   - Dòng `end` luôn là dòng cuối cùng của tệp output.
6. **Điểm số khi Thắng / Thua:**
   - Điểm thưởng thắng (`Math.floor(time_left_s * 2) + flames * 50`) được cộng ngay tại tick phát sinh `game_over (won)`. Nhờ đó, điểm số trong snapshot cuối cùng khớp hoàn toàn với điểm trong dòng `end`.
   - Khi thua cuộc (do hết máu hoặc hết giờ), không cộng điểm thưởng này.
7. **Vùng an toàn quanh đèn:**
   - Chỉ áp dụng cho các Đèn Lồng Lớn đã được thắp sáng (`lit == true`) với bán kính an toàn `safe_radius = 4.5m`.
   - Bất kỳ Bóng Mực nào tiến vào vùng này (hoặc đang đứng trong vùng lúc đèn vừa thắp sáng, kể cả khi đang bị stun) đều lập tức bị đẩy ra ngoài mép bán kính 4.5m.

## 7. Tài liệu và Bằng chứng Kiểm chứng
- **Giả định thiết kế:** [phase-1-assumptions.md](docs/notes/phase-1-assumptions.md)
- **Nhật ký SDLC & AI:** [ai-log.md](docs/notes/ai-log.md)
- **Bằng chứng kiểm chứng:** Thư mục [docs/proof/phase-1/](docs/proof/phase-1/)
- **Harness AI:** [AGENTS.md](AGENTS.md)
- **Ghi nhận nguồn:** [CREDITS.md](CREDITS.md)
