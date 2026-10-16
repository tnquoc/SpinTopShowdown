# Đại Chiến Con Quay (Spin Top Showdown)

Web game con quay: chỉnh thông số con quay rồi thả vào đấu trường (10 màn) hoặc đường đua vượt địa hình (3 chặng).

Toàn bộ game nằm trong một file `index.html`, viết bằng JavaScript chạy trên trình duyệt, dùng [three.js](https://threejs.org/) 0.160.0 tải từ CDN jsdelivr. Không có bước build và không có thư viện nào phải cài.

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
- `?debug`: mở `window.game` để chạy mô phỏng cân bằng (`game.sim(...)`) và không ghi đè tiến độ đã lưu.

## Đưa lên mạng

Game là trang tĩnh nên GitHub Pages phục vụ được nguyên trạng: đẩy kho lên GitHub, vào Settings → Pages, chọn nhánh `main` và thư mục gốc. Game sẽ có địa chỉ `https://<tên-tài-khoản>.github.io/SpinTopShowdown/`.
