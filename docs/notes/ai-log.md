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
