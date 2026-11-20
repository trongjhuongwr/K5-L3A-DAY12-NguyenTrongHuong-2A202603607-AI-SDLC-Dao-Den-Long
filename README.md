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

## 6. Tài liệu và Bằng chứng Kiểm chứng
- **Giả định thiết kế:** [phase-1-assumptions.md](docs/notes/phase-1-assumptions.md)
- **Nhật ký SDLC & AI:** [ai-log.md](docs/notes/ai-log.md)
- **Bằng chứng kiểm chứng:** Thư mục [docs/proof/phase-1/](docs/proof/phase-1/)
- **Harness AI:** [AGENTS.md](AGENTS.md)
- **Ghi nhận nguồn:** [CREDITS.md](CREDITS.md)
