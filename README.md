# Đại Chiến Con Quay (Spin Top Showdown)

Web game con quay: chỉnh thông số con quay rồi thả vào đấu trường hoặc đường đua vượt địa hình.

- **Chiến dịch 50 màn:** 10 chương, mỗi chương một đấu trường và 5 trận; trận thứ 5 là trùm. Hạ trùm của chương nào thì nhận kỹ năng của trùm đó (9 kỹ năng, cộng Lốc Xoáy có sẵn). Trùm cuối ở màn 50.
- **Kỹ năng:** chọn một kỹ năng trước mỗi trận, tốn một thanh năng lượng mỗi lần dùng. Kỹ năng nào cũng có điểm tự hại nếu dùng sai chỗ (ví dụ Sấm Sét trên sàn ướt giật ngược cả mình).
- **Vượt địa hình:** 3 chặng riêng, SPACE là nhảy.

Toàn bộ code game nằm trong một file `index.html`, viết bằng JavaScript chạy trên trình duyệt, dùng [three.js](https://threejs.org/) 0.160.0 tải từ CDN jsdelivr. Không có bước build và không có thư viện nào phải cài.

Tiếng sân bóng làm nền là ghi âm thật (CC0) trong thư mục `sounds/`, nguồn ghi ở [sounds/CREDITS.md](sounds/CREDITS.md). Các hiệu ứng còn lại và nhạc nền được tổng hợp bằng Web Audio.

## Chạy thử trên máy

Trình duyệt không cho mở module JavaScript trực tiếp từ file, nên cần một máy chủ tĩnh nhỏ. Dùng Python của uv, không cần tạo môi trường ảo vì chỉ dùng thư viện chuẩn:

```bash
uv run --no-project python -m http.server 5173 --bind 127.0.0.1
```

Rồi mở http://localhost:5173

## Điều khiển

- Xưởng chỉnh: bấm chỗ trống trên sàn để đặt con quay, kéo từ con quay (hoặc chấm tròn đầu mũi tên) để chỉnh hướng và lực phóng.
- Trong trận: `Space` giải phóng lốc xoáy (đấu trường) hoặc nhảy (địa hình); đập `Space` ngay sau va chạm để nạp năng lượng. `V` đổi góc nhìn.

## Tham số URL

- `?lang=vi` hoặc `?lang=en`: ép ngôn ngữ (bình thường dùng nút trong game).
- `?debug`: mở `window.game` để chạy mô phỏng cân bằng (`game.sim(...)`), không ghi đè tiến độ đã lưu và tắt cốt truyện.
- `?debug&story`: như trên nhưng vẫn hiện cốt truyện.

## Đưa lên mạng

Game là trang tĩnh nên GitHub Pages phục vụ được nguyên trạng: đẩy kho lên GitHub, vào Settings → Pages, chọn nhánh `main` và thư mục gốc. Game sẽ có địa chỉ `https://<tên-tài-khoản>.github.io/SpinTopShowdown/`.
