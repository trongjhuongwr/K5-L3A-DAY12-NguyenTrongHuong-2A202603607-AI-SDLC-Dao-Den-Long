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
- **Rê chuột (Click khóa chuột)**: Xoay góc nhìn 360° tự do quanh Mây không cần giữ nút chuột (chuẩn game 3D hiện đại).
- **C**: Căn góc nhìn camera lập tức ra ngay sau lưng Mây.
- **Cuộn chuột (Scroll wheel)**: Thu phóng khoảng cách camera (zoom gần/xa từ 3.5m đến 14m).
- **ESC / P**: Tạm dừng trò chơi (Pause), mở menu Cài đặt và nhả chuột.

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

## 6. Giải trình Thiết kế & Tham số (Tuning Rationales)
Tuân thủ đầy đủ phản hồi định hướng từ Giảng viên & Hội đồng:
- **Kiểu Camera:** Sử dụng góc nhìn thứ ba 3D (Third-person view) với khả năng xoay tự do 360° quanh nhân vật Mây (hỗ trợ chế độ khóa chuột Pointer Lock và phím `C` căn góc sau lưng, cuộn chuột thu phóng). Phía headless tuân thủ 100% công thức xoay vector `move` theo góc `cam_yaw_deg`.
- **Chi phí thắp đèn (`lantern_cost = 10`):** Mỗi đèn yêu cầu 10 đom đóm, vừa đúng bằng sức chứa tối đa của túi (`carry_capacity = 10`), khuyến khích người chơi nhặt đầy một túi rồi nạp một lượt hoặc nạp tích lũy từng đợt tùy tình huống.
- **Chi phí Tỏa Sáng (`pulse_cost = 3`):** Đủ rẻ để người chơi kích hoạt giải cứu bản thân khi bị Bóng Mực dồn ép (với 10 đom đóm có thể kích hoạt tối đa 3 lần), nhưng đủ đắt để người chơi phải cân nhắc chiến thuật vì mỗi lần tỏa sáng sẽ làm chậm tiến độ tích lũy để thắp đèn lồng.
- **Hiệu ứng Tỏa Sáng (`pulse_radius = 5.0m`, `pulse_stun_s = 2.0s`):** Bán kính 5.0m đủ bao quát mọi kẻ địch đang áp sát trong cự ly nguy hiểm, choáng 2.0 giây (120 tick) và đẩy lùi 4m ngang cho phép người chơi kịp thời thoát thân hoặc nhặt lại các đom đóm bị rơi.
- **Thời gian sinh Bóng Mực (`spawning = 60 ticks / 1.0s`):** Khi sinh tự nhiên từ sương đêm, Bóng Mực có 1.0s ở trạng thái `spawning` mờ dần xuất hiện, không gây sát thương, sau đó chuyển sang `wander`. Bóng Mực do kịch bản (scenario) dựng sẵn bắt đầu ngay ở trạng thái `wander`.
- **Điểm xuất phát:** Đêm 1 và Đêm 2 tại `(0, 0, 0)` nhìn về `+Z`. Đêm 3 tại `(0, 0, -15)` nhìn về `+Z` (đặt Mây ở tầng thấp nhất nhìn về trung tâm tháp chuông). Khi rơi khỏi đảo sẽ hồi sinh tại đúng điểm xuất phát của Đêm đó.
- **Định dạng `invuln`:** Boolean (`true`/`false`) trong snapshot định kỳ; số tick bất tử chỉ xuất hiện trong scenario (`invuln_ticks`).
- **Sự kiện `night_start`:** Được phát ở bước thực thi đầu tiên mang `tick = 1` (tick 0 là snapshot khởi tạo trước mọi bước xử lý).

## 7. Sáng tạo của tôi (Creative Additions)
- **Cốt truyện & Lời dặn Ông Đăng:** Mỗi đêm chơi đều có lời nhắn nhủ dẫn dắt giàu cảm xúc từ người giữ đèn tiền bối.
- **Mô hình Mây 3D sống động:** Nhân vật áo lam với chiếc khăn đỏ, đội nón lá treo lồng đèn nhỏ phát sáng ấm áp đung đưa, hoạt ảnh bước chân đung đưa tay chân và tự động xoay mượt mà theo hướng di chuyển.
- **Cột sáng Beacon dẫn đường:** Mỗi ngọn Đèn Lồng Lớn chiếu một cột sáng ấm áp cao 45m lên bầu trời đêm, giúp người chơi dễ dàng định hướng vị trí đèn từ bất kỳ đâu trên đảo. Khi thắp sáng, cột sáng chuyển thành ánh sáng xanh rực rỡ và kích hoạt vùng an toàn 6m.
- **Bản đồ Radar Vệ tinh (Minimap 2D):** HUD góc trên bên phải hiển thị bản đồ trực quan theo thời gian thực (vị trí Mây và hướng nhìn, các ngọn đèn, đom đóm, Bóng Mực và phạm vi vùng an toàn).
- **Hệ thống Nhiệm vụ & Thông báo Nổi (Quest Tracker & Toast):** Chỉ dẫn rõ ràng từng bước mục tiêu hiện tại (nhặt đom đóm, đến đèn lồng, bấm E nạp ánh sáng) và hiển thị thông báo tức thì khi nhặt đom đóm, nạp đèn, lướt hay bị tấn công.
- **Menu Hướng dẫn Chi tiết (Phím H hoặc nút [?]):** Bảng hướng dẫn trực quan đầy đủ về phím bấm, cơ chế bục nhảy, bùa gió và mẹo sinh tồn.
- **Biển mây bồng bềnh & Bảng màu cổ tích chuẩn:** Sử dụng chính xác bảng màu chuẩn (#0E1430, #2F5D50, #C9B48A, #6B4A2F, #12384A, #FFB347, #FFE9B0,...).
- **Âm thanh tổng hợp (Procedural Audio):** Hệ thống âm thanh độc lập tạo bằng Web Audio API không phụ thuộc tệp tài nguyên ngoài, hỗ trợ tùy chỉnh âm lượng và độ nhạy chuột lưu vào `localStorage`.
- **Bảo đảm Test Contract:** Toàn bộ phần sáng tạo đồ họa và âm thanh chỉ nằm ở tầng hiển thị, tắt hoàn toàn khi chạy headless.

## 7. Tài liệu và Bằng chứng Kiểm chứng
- **Đặc tả Phase 2:** [phase-2-spec.md](docs/notes/phase-2-spec.md)
- **Nhật ký SDLC & AI:** [ai-log.md](docs/notes/ai-log.md)
- **Bằng chứng kiểm chứng:** Thư mục [docs/proof/phase-2/](docs/proof/phase-2/)
- **Harness AI:** [AGENTS.md](AGENTS.md)
- **Ghi nhận nguồn:** [CREDITS.md](CREDITS.md)
