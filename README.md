# Đảo Đèn Lồng - Phase 2: "Ba hòn đảo"

Dự án game 3D góc nhìn thứ ba phát triển theo quy trình AI SDLC.
Hỗ trợ đầy đủ chế độ chơi giao diện 3D trên nền web và chế độ Headless chạy tự động tuân thủ **Test Contract v1.1**.

## 1. Cài đặt và Khởi chạy (Tối đa 3 lệnh)

```bash
# 1. Cài đặt thư viện và biên dịch headless
npm install && npm run build:headless

# 2. Khởi chạy game có giao diện 3D (3 Đêm chơi)
npm run dev

# 3. Chạy toàn bộ bộ kiểm thử tự động Test Contract v1.1
npm test
```

## 2. Hướng dẫn Điều khiển
- **W / A / S / D** hoặc **Phím mũi tên**: Di chuyển nhân vật Mây (6.0 m/s; có Bùa Gió: 7.2 m/s).
- **SPACE**: Nhảy ($V_y = 7.0$ m/s, trọng lực $-20$ m/s²).
- **SHIFT**: Lướt nhanh (Dash 14 m/s trong 0.2s, hồi chiêu 1.5s; có Bùa Gió: không hồi chiêu).
- **E**: Nạp đom đóm vào Đèn Lồng Lớn (trong phạm vi 2.0m).
- **Q**: Tỏa sáng để xua đuổi và làm choáng Bóng Mực, đuổi Gió Lạc (tốn 3 đom đóm).
- **ESC / P**: Tạm dừng trò chơi (Pause) & Mở menu Cài đặt.
- **Chuột (kéo giữ)**: Xoay camera 3D quanh nhân vật (có chỉnh độ nhạy chuột).

## 3. Nội dung 3 Đêm Chơi (Ba Hòn Đảo)
- **Đêm 1 — Đảo Bến:** Đảo tròn $R=40m$, 5 ngọn Đèn Lồng Lớn, 20 đom đóm ban đầu, Bóng Mực xuất hiện sau 5s.
- **Đêm 2 — Đảo Cau:** 2 đảo tròn $R=28m$ nối bằng cầu tre dài $18m$ không lan can, 2 bục nhảy xung kích phóng qua lại giữa 2 đảo, 6 ngọn Đèn Lồng, sự xuất hiện của Gió Lạc (Drifter) cướp đom đóm và Bùa Gió (Wind Charm) tăng tốc & hồi lướt tức thì.
- **Đêm 3 — Đảo Chuông:** Đảo 3 tầng cao ($Y=0, 3, 6$), 2 dốc nghiêng nối tầng 0 và tầng 1, bục nhảy lên đĩa tầng 2, tháp chuông trung tâm, 7 ngọn Đèn Lồng, gió mạnh giật từng cơn mỗi 30s đẩy người chơi.

## 4. Quy tắc Tính điểm Chuẩn (Ticket-02)
- **Nạp đom đóm vào đèn:** +10 điểm / con thực nạp.
- **Thắp sáng Đèn Lồng Lớn:** +100 điểm / đèn.
- **Làm choáng Bóng Mực (Pulse):** +5 điểm / con mỗi lần trúng.
- **Thưởng khi Thắng:** `Math.floor(giây_còn_lại) * 2 + 50 * số_ngọn_lửa`.
- **Tổng điểm game:** Tổng điểm tích lũy của các Đêm đã vượt qua.

## 5. Chế độ Headless & Test Contract v1.1
Game hỗ trợ chạy không cần giao diện, không cần GPU, ở tốc độ 60 ticks/giây với hiệu năng cao (21.600 ticks < 0.2 giây):
```bash
# Chạy Đêm 1
node dist/headless.js --seed 42 --night 1 --ticks 180 --out docs/proof/phase-2/test-night1.jsonl --snapshot-every 20

# Chạy Đêm 2
node dist/headless.js --seed 42 --night 2 --ticks 180 --out docs/proof/phase-2/test-night2.jsonl --snapshot-every 20

# Chạy Đêm 3
node dist/headless.js --seed 42 --night 3 --ticks 180 --out docs/proof/phase-2/test-night3.jsonl --snapshot-every 20
```

## 6. Sáng tạo của tôi (Creative Additions)
- **Cốt truyện & Lời dặn Ông Đăng:** Mỗi đêm chơi đều có lời nhắn nhủ dẫn dắt giàu cảm xúc từ người giữ đèn tiền bối.
- **Mô hình Mây truyền thống:** Nhân vật áo lam với chiếc khăn đỏ, đội nón lá treo lồng đèn nhỏ phát sáng ấm áp đung đưa theo từng bước chân.
- **Biển mây bồng bềnh & Bảng màu cổ tích chuẩn:** Sử dụng chính xác bảng màu chuẩn (#0E1430, #2F5D50, #C9B48A, #6B4A2F, #12384A, #FFB347, #FFE9B0,...).
- **Âm thanh tổng hợp (Procedural Audio):** Hệ thống âm thanh độc lập tạo bằng Web Audio API không phụ thuộc tệp tài nguyên ngoài, hỗ trợ tùy chỉnh âm lượng và độ nhạy chuột lưu vào `localStorage`.
- **Bảo đảm Test Contract:** Toàn bộ phần sáng tạo đồ họa và âm thanh chỉ nằm ở tầng hiển thị, tắt hoàn toàn khi chạy headless.

## 7. Tài liệu và Bằng chứng Kiểm chứng
- **Đặc tả Phase 2:** [phase-2-spec.md](docs/notes/phase-2-spec.md)
- **Nhật ký SDLC & AI:** [ai-log.md](docs/notes/ai-log.md)
- **Bằng chứng kiểm chứng:** Thư mục [docs/proof/phase-2/](docs/proof/phase-2/)
- **Harness AI:** [AGENTS.md](AGENTS.md)
- **Ghi nhận nguồn:** [CREDITS.md](CREDITS.md)
