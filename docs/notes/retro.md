# Báo cáo Tổng kết Dự án (Retrospective) — Đảo Đèn Lồng

- **Sinh viên:** Nguyễn Trọng Hưởng (2A202603607)
- **Học phần:** K5 - L3A - Day 12 (AI SDLC Lab)
- **Phiên bản phát hành:** v1.0.0 (Tag: phase-4)
- **Chuẩn Test Contract:** v1.3

---

## 1. Tổng quan Đánh giá qua 4 Phase (Evaluation Summary)

| Phase | Trọng tâm | Trạng thái Test | Thời gian thực thi Headless | Điểm nhấn kỹ thuật |
| :--- | :--- | :---: | :---: | :--- |
| **Phase 1** | PRD-0, Đêm 1 (Đảo Bến), Contract v1.0 | 5/5 PASS | ~0.08s | Tách bạch tuyệt đối Game Simulation và 3D Rendering. Tất định 100%. |
| **Phase 2** | Ticket-02, 3 Đảo, Lướt, Gió Lạc, Bùa Gió, Bục nhảy, Contract v1.1 | 15/15 PASS | ~0.15s | Hoàn thiện vật lý nhảy/rơi/lướt, camera góc nhìn thứ ba 360° tự do, minimap radar. |
| **Phase 3** | Ticket-03 (Change Request), Đèn cạn dầu, Bóng Mực hút dầu, Sống sót tới Bình Minh, Contract v1.2 | 25/25 PASS | ~0.16s | Quản lý nhiên liệu số nguyên (0..6000 ticks), máy trạng thái `drain`, túi tăng động (10..20). |
| **Phase 4** | Ticket-04, Benchmark, Soak test 10 đêm, Bảng xếp hạng, Dễ tiếp cận (A11y), Contract v1.3 | 30/30 PASS | ~0.16s | Benchmark 1280x720 200 quái/100 đom đóm (>9000 FPS), soak test không crash, đổi phím & phụ đề. |

---

## 2. Bài học về Làm việc Hiệu quả và Không Hiệu quả với AI

### Điều hiệu quả:
1. **Thiết lập Khung làm việc (Harness AI) chặt chẽ:** Việc định nghĩa rõ ràng `AGENTS.md`, quy ước phân tầng (`src/core/` không DOM/WebGL, `src/web/` hiển thị Three.js) giúp AI không bao giờ nhầm lẫn hoặc import thư viện WebGL vào engine logic.
2. **Khai báo Test Contract cụ thể:** Khi có schema JSON rõ ràng, AI sinh test scenarios và assertion kiểm thử đạt độ chính xác gần như tuyệt đối, phát hiện lỗi biên ngay từ đầu.
3. **Chiến lược Chia nhỏ - Kiểm tra trước khi thực thi:** Thống nhất danh sách giả định (ADR, Q&A) trước khi viết mã giúp tránh việc phải sửa lại kiến trúc giữa chừng.

### Điều không hiệu quả:
1. **Yêu cầu quá rộng trong một câu lệnh:** Khi yêu cầu AI vừa làm đồ họa 3D vừa làm logic vừa làm hiệu ứng âm thanh trong một lượt, AI dễ bỏ sót các trường con trong snapshot hoặc quên ràng buộc nhỏ trong hợp đồng.
2. **Tin tưởng hoàn toàn vào mã nguồn mà không chạy kiểm thử độc lập:** Đôi khi mã do AI viết nhìn rất hợp lý nhưng khi chạy thực tế lại gặp lỗi logic biên (như trường hợp state của Gió Lạc hoặc sai số số thực).

---

## 3. Các lần AI gặp lỗi Logic và Cách phát hiện & Khắc phục

1. **Lỗi đảo ngược phím di chuyển A và D (Phase 2):**
   - *Hiện tượng:* Người chơi bấm A thì nhân vật sang phải, bấm D thì nhân vật sang trái.
   - *Nguyên nhân:* Camera Three.js đặt tại tọa độ $-Z$ nhìn về $+Z$, khiến trục $+X$ không gian nằm bên trái màn hình. Việc map trực tiếp `mx -= 1` cho A và `mx += 1` cho D làm ngược chiều quan sát.
   - *Phát hiện & Sửa:* Phát hiện qua playtest trải nghiệm người dùng; khắc phục bằng cách đảo ngược ánh xạ `mx` tương ứng với góc nhìn camera.

2. **Lỗi sự kiện `drifter_drop` không phát khi Tỏa Sáng (Phase 3):**
   - *Hiện tượng:* Test tự động báo rớt kiểm thử thả đom đóm của Gió Lạc.
   - *Nguyên nhân:* Logic kiểm tra của AI chỉ xét `drifter.state === "chase" || drifter.state === "idle"`. Nhưng khi Gió Lạc vừa cướp đom đóm xong, trạng thái của nó đã chuyển sang `"flee"`.
   - *Phát hiện & Sửa:* Kiểm tra log JSONL của test scenario; bổ sung điều kiện `|| drifter.state === "flee"` vào bước xử lý Pulse.

3. **Sai số trôi dấu phẩy động (Floating-point drift) trong tính hao dầu (Phase 3):**
   - *Hiện tượng:* Lượng dầu trừ $1.0/60$ mỗi tick làm xuất hiện số lẻ dạng $69.98333333333333$, khiến hàm `ceil((100 - fuel) / 10)` bị lệch giá trị so với tính toán nguyên.
   - *Phát hiện & Sửa:* Phát hiện trong test châm dầu; giải quyết triệt để bằng cách dùng biến đếm số nguyên `fuel_ticks` (0..6000) trong engine mô phỏng.

---

## 4. Đánh giá Harness AI (AGENTS.md, Skills, Scripts)

- **`AGENTS.md`:** Là harness quan trọng nhất. Quy định rõ quy tắc "Tối đa 3 lệnh để cài và chạy", "Không được phá Test Contract", và "Tính tất định bắt buộc". Nhờ có tài liệu này, AI luôn tuân thủ cấu trúc thư mục và bảo tồn khả năng kiểm thử.
- **Bộ kịch bản Scenario JSON:** Giúp cô lập từng tính năng nhỏ (Dash, Fall, JumpPad, Charm, Drifter, Refuel, Drain) để test tự động trong 5–20 ticks mà không cần chờ chạy cả đêm dài.
- **Bộ script npm rút gọn:** `npm run build`, `npm test`, `npm run dev` giúp việc xác nhận kết quả diễn ra tức thì sau mỗi bước sửa đổi.

---

## 5. Ước tính Tiêu thụ Token và Chi phí SDLC

- **Giai đoạn Phase 1:** ~25.000 tokens (lập kế hoạch, thiết kế kiến trúc, engine simulation).
- **Giai đoạn Phase 2:** ~30.000 tokens (3 hòn đảo, tinh chỉnh điều khiển, Three.js procedural assets).
- **Giai đoạn Phase 3:** ~28.000 tokens (Change request đèn cạn dầu, bóng mực hút dầu, ADR-001).
- **Giai đoạn Phase 4:** ~32.000 tokens (Benchmark, soak test, leaderboard, accessibility, release package).
- **Tổng cộng dự án:** ~115.000 tokens (~0.15 - 0.25 USD chi phí API).
- **Chiến lược tiết kiệm token đã áp dụng:**
  - Trao đổi ngắn gọn, gút danh sách yêu cầu rõ ràng trước khi code.
  - Sử dụng test tự động headless CLI để AI tự debug qua file log thay vì phải paste toàn bộ dữ liệu lớn vào ngữ cảnh hội thoại.
  - Tái sử dụng module lõi và giữ file source code tách biệt theo chức năng đơn lẻ.

---

## 6. Nếu được làm lại từ đầu thì sẽ thay đổi gì?

1. **Thiết lập hệ tọa độ Camera chuẩn ngay từ Tick 0:** Chuẩn hóa quy ước góc quay camera và hướng nhìn nhân vật ngay từ Phase 1 để tránh việc phải sửa đổi cảm giác lái của người chơi ở Phase 2.
2. **Sử dụng đơn vị số nguyên (Fixed-point / Integer ticks) cho toàn bộ trạng thái:** Việc dùng số nguyên cho `fuel_ticks` đã chứng minh hiệu quả vượt trội so với số thực trong việc bảo đảm tính tất định trên mọi hệ điều hành.
3. **Tích hợp sẵn công cụ Benchmark và Soak test từ Phase 1:** Điều này sẽ giúp phát hiện sớm mọi vấn đề tiềm ẩn về hiệu năng và rò rỉ bộ nhớ trước khi phát triển các tính năng phức tạp ở các Phase sau.
