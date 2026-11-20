# Nhật ký SDLC & Sử dụng AI (AI Log)

## Phase 1: PRD-0 & Test Contract v1.0

### 1. Phân tích yêu cầu & Trao đổi ban đầu
- **Mục tiêu:** Đọc kỹ PRD-0, xác định các điểm mơ hồ, thống nhất giả định trước khi viết bất kỳ dòng mã nào.
- **Các câu hỏi thảo luận:**
  1. Pulse cost trừ vào `carried` hay `flames`? -> Chốt: `carried`.
  2. Pulse khi không đủ đom đóm: Thất bại.
  3. Pulse đẩy lùi tức thì hay lùi dần: Đẩy lùi tức thì trong tick logic (`pulse_push_m`), diễn hoạt mượt trong 3D.
  4. Event pulse khi không trúng ai: Vẫn phát event với mảng `stunned_ids: []`.
  5. Deposit: Nạp một lần toàn bộ số đom đóm đang giữ tối đa tới mức đèn cần.
  6. Rơi đom đóm: Tan biến vào sương để tránh phức tạp hóa số lượng thực thể.
  7. Tính điểm: Điểm tích lũy cộng dồn trong snapshot, bonus thời gian và máu cộng khi thắng.
  8. Bản đồ: Đảo tròn bán kính 35m, 5 đèn bố trí đều ở bán kính 22m, `fall_enabled = false`.

### 2. Thiết kế kiến trúc
- Tách biệt hoàn toàn Game Simulation (`src/core/`) và 3D Rendering (`src/web/`).
- Engine lõi không phụ thuộc vào window/DOM/GPU để bảo đảm 100% headless, chạy nhanh trong vài phần nghìn giây.
- Sử dụng thuật toán sinh số giả ngẫu nhiên xác định (LCG / Mulberry32) theo `--seed`.

### 3. Ước tính Token & Chi phí
- **Giai đoạn thảo luận & đặc tả:** ~15k tokens.
- **Chiến lược tiết kiệm token:** Trao đổi ngắn gọn, gút danh sách giả định rõ ràng trước khi code, chia nhỏ từng bước để tránh lỗi lặp lại.

## Phase 2: Ticket-02 ("Ba hòn đảo") & Test Contract v1.1

### 1. Phân tích Ticket-02 & Thống nhất Kế hoạch
- Chuẩn hóa các hằng số vật lý: Nhảy ($V_y = 7.0, g = -20$), Lướt ($14$ m/s, $0.2s$, hồi $1.5s$), Rơi khỏi đảo ($Y < -10$).
- 3 Đêm với 3 bản đồ chuẩn: Đảo Bến ($R=40m$), Đảo Cau (2 đảo + cầu tre + 2 bục nhảy), Đảo Chuông (3 tầng cao + 2 dốc nghiêng + bục nhảy + tháp chuông + gió mạnh).
- Các thực thể mới: Gió Lạc (Drifter), Bùa Gió (Charm), Đom đóm rơi (dropped motes với TTL 480 ticks).
- Trạng thái Bóng Mực chuẩn hóa: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- Test Contract v1.1: Snapshot bổ sung `night`, `wind`, `player.vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`, và các mảng bắt buộc `motes`, `drifters`, `charms`.
- Thứ tự 12 bước xử lý tick nghiêm ngặt.

### 2. Ước tính Token
- Giai đoạn lập kế hoạch & thiết kế Phase 2: ~15k tokens.

### 3. Phản hồi Người dùng & Tinh chỉnh UX / Điều khiển
- **Phản hồi người dùng:** Trải nghiệm ban đầu khó hiểu, chưa rõ cách chơi, lỗi cơ chế di chuyển và đặc biệt phím A và D bị ngược nhau.
- **Nguyên nhân cốt lõi phát hiện:**
  1. Camera Three.js đặt ở $-Z$ nhìn về $+Z$, khiến trục $+X$ trong hệ tọa độ không gian nằm bên trái màn hình và $-X$ nằm bên phải màn hình. Việc map phím A (`mx -= 1`) và D (`mx += 1`) trực tiếp đã khiến phím D đi sang trái và phím A đi sang phải màn hình.
  2. Nhân vật Mây chưa có góc xoay hướng nhìn (`rotation.y`), dẫn đến nhân vật trượt ngang hoặc đi lùi không tự nhiên.
  3. Mô hình Mây trước đây ghi đè trực tiếp `group.position.y` bằng hàm nhấp nhô `Math.sin(...) * 0.06`, làm triệt tiêu độ cao thật khi nhảy, bục nhảy và địa hình phân tầng.
  4. Người chơi mới thiếu chỉ dẫn trực quan: không thấy vị trí đèn lồng từ xa, không biết cần bao nhiêu đom đóm, và không có bản đồ radar.
- **Giải pháp triển khai hoàn thiện:**
  - Sửa ánh xạ phím A/D trong `src/web/main.ts` để A di chuyển sang trái màn hình và D di chuyển sang phải màn hình một cách chuẩn xác.
  - Tách `modelRoot` trong `CharacterModel` để bảo toàn tuyệt đối tọa độ $Y$ vật lý khi nhảy, rơi và vượt tầng.
  - Thêm thuật toán lerp xoay hướng nhân vật mượt mà theo vận tốc di chuyển ngang ($V_x, V_z$).
  - Thêm Cột sáng Beacon cao 45m tỏa ánh sáng vàng/xanh từ các ngọn Đèn Lồng lên bầu trời.
  - Thêm Bản đồ Vệ tinh Minimap 2D ở góc trên HUD thể hiện Mây, Đèn, Đom đóm, Quái và Vùng an toàn 6m.
  - Thêm Hệ thống Nhiệm vụ Quest Tracker hiển thị từng bước cần làm và Toast notifications báo trạng thái.
  - Thêm Menu Hướng dẫn Chi tiết (phím H hoặc nút [?]).
  - Giữ vững 100% tính tất định và đạt 15/15 test contract v1.1 trong 0.156s.


## Phase 3: Ticket-03 (Change Request "Đèn cạn dầu") & Test Contract v1.2

### 1. Phân tích Change Request & Đánh giá Rủi ro (Impact Analysis)
- **Vấn đề cốt lõi:** Người chơi giỏi hoàn thành việc thắp đèn sớm trong 2 phút, thiếu căng thẳng ở cuối Đêm.
- **Thay đổi luật chơi:**
  - Đèn có mức nhiên liệu tối đa 100, tiêu hao 1.0 fuel/giây.
  - Châm dầu (`E`): nạp đom đóm vào đèn đang sáng để tiếp thêm dầu (mỗi đom đóm = +10 fuel).
  - Khi `fuel <= 0`, đèn tắt và quay về unlit với `ever_lit = true`. Chi phí thắp lại giảm còn 5 đom đóm.
  - Khi `fuel < 30`: đèn mất vùng an toàn 6m; Bóng Mực chuyển sang trạng thái `drain` đứng yên hút 5.0 fuel/s.
  - Điều kiện Thắng chuyển sang "Bình minh": không thắng sớm khi thắp hết đèn; chỉ thắng khi thời gian về 0 và số đèn sáng $\ge 60\%$.
  - Sức chứa túi đom đóm tăng động (`capacity = min(20, 10 + 2 * successful_lights)`).
  - Hỗ trợ tiếp cận người khiếm thị màu (Colorblind mode).
- **Rủi ro tính tất định (Determinism):** Số thực `1.0 / 60` mỗi tick có thể dẫn đến sai số dấu phẩy động lũy kế giữa các nền tảng khác nhau.
- **Giải pháp:** Sử dụng bộ đếm nguyên `fuel_ticks` (0..6000), đảm bảo tính toán số nguyên 100% tất định trên mọi hệ điều hành và kiến trúc CPU.

### 2. Triển khai & Kiểm thử
- Cập nhật `game.contract.json` sang version "1.2".
- Cập nhật Engine mô phỏng lõi `src/core/simulation.ts`: quản lý vòng đời nhiên liệu, máy trạng thái `drain` của Bóng Mực, thắp lại 5 đom đóm, đẩy quái khi tiếp dầu, tăng sức chứa túi, tính điểm và xét thắng thua bình minh.
- Cập nhật Giao diện 3D `src/web/scene.ts`: Thanh đo nhiên liệu 3D trên đỉnh đèn, hiệu ứng đèn lùn 20% khi chưa sáng, đèn sắp tắt nhấp nháy 1 Hz, chế độ Bảng màu dễ phân biệt.
- Cập nhật HUD `src/web/main.ts`: Túi đom đóm co giãn động từ 10 đến 20 ô, thông báo cảnh báo nguy cấp khi đèn dưới 30% dầu, minimap cập nhật vùng an toàn theo nhiên liệu.
- Viết tài liệu ADR-001 tại `docs/notes/adr-001-fuel-and-win-condition.md` và `CHANGELOG.md`.
- Bộ kiểm thử tự động `tests/verify.js` mở rộng lên 25 tiêu chí kiểm thử, đạt tỉ lệ pass 100% trong 0.160s (vượt xa chuẩn $\le 30$s).
