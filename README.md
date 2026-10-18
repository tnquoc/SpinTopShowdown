# Đại Chiến Con Quay (Spin Top Showdown)

Web game con quay: chỉnh thông số con quay rồi thả vào đấu trường hoặc đường đua vượt địa hình.

- **Chiến dịch 50 màn:** 10 chương, mỗi chương một đấu trường và 5 trận; trận thứ 5 là trùm. Hạ trùm của chương nào thì nhận kỹ năng của trùm đó (9 kỹ năng, cộng Lốc Xoáy có sẵn). Trùm cuối ở màn 50.
- **Kỹ năng:** trang bị tối đa **2 chiêu**; `1–2` chọn ô, `Space`/nút lớn dùng chiêu. Dùng chung năng lượng, không chồng chiêu và nghỉ 0,9 giây sau mỗi chiêu. Khi đủ 2 ô, chọn chiêu mới thay ô đang chọn. Cả 10 chiêu có vai trò, khắc chế và tình huống dùng riêng; xem [bảng trước/sau](POLISH-NOTES.vi.md).
- **Hợp chiêu:** trong xưởng, chạm một công thức ✦ để trang bị cả cặp. Dùng chiêu đầu, chờ hết chiêu và đủ 1 thanh năng lượng, rồi nhấn **C hoặc chạm nút hợp chiêu đang sáng**. Cửa sổ 8 giây, hai thứ tự đều được, hồi hợp chiêu 10 giây. Không cần nhấn hai nút cùng lúc. Các cặp: Sấm + Tốc → Lôi Bộ; Ảo + Hồng Liên → Liên Ảnh; Lửa + Lốc → Hoả Lốc. Mẹo lần đầu, intro map và HUD đều nhắc cách dùng.
- **Vượt địa hình:** 3 chặng riêng, SPACE là nhảy.

Toàn bộ code game nằm trong một file `index.html`, viết bằng JavaScript chạy trên trình duyệt, dùng [three.js](https://threejs.org/) 0.160.0 tải từ CDN jsdelivr. Bản web không cần build hay cài thư viện; bản CrazyGames có script đóng gói riêng bên dưới.

Tiếng sân bóng làm nền là ghi âm thật (CC0) trong thư mục `sounds/`, nguồn ghi ở [sounds/CREDITS.md](sounds/CREDITS.md). Các hiệu ứng còn lại và nhạc nền được tổng hợp bằng Web Audio.

## Chạy thử trên máy

Không mở `index.html` bằng `file://`. Mở PowerShell tại `D:\Projects\SpinTopShowdown` và chạy (Node 22+, không cần cài package):

```bash
node tools/serve-local.mjs
```

Rồi mở http://127.0.0.1:5173/. Server dùng Three.js có sẵn trong `vendor/`, không cần CDN; chỉ lắng nghe trên máy cục bộ. `Ctrl+C` để dừng.

## Điều khiển

- Xưởng chỉnh: bấm chỗ trống trên sàn để đặt con quay, kéo từ con quay (hoặc chấm tròn đầu mũi tên) để chỉnh hướng và lực phóng.
- Trong trận: `1–2` hoặc chạm ô để chọn chiêu; `Space`/nút lớn thi triển (đấu trường) hoặc nhảy (địa hình). `C`/nút hợp chiêu sáng tự chọn và dùng chiêu thứ hai. Đập `Space` ngay sau va chạm để nạp năng lượng. `V` đổi góc nhìn. Intro map tự đóng sau 5 giây; `Space`/`Esc` bỏ qua.

## Tham số URL

- `?lang=vi` hoặc `?lang=en`: ép ngôn ngữ (bình thường dùng nút trong game).
- `?debug`: chỉ hoạt động với bản web trên `localhost`, `127.0.0.1` hoặc `[::1]`; mở `window.game`, không ghi đè tiến độ, mặc định tắt cốt truyện. URL thường không bật debug, dù chạy cục bộ.
- `?debug&story`: bật lại cốt truyện để kiểm tra hội thoại/intro.
- **Thử thẳng trùm Thiết Giáp màn 25:** http://127.0.0.1:5173/?debug&level=25&lang=vi
- **Màn bất kỳ 1–53:** đổi `level=25` thành số màn; ví dụ `?debug&level=40` là trùm Băng Tuyết, `?debug&level=53` là địa hình cuối.
- **Trùm chương bất kỳ 1–10:** `?debug&boss=6` vào thẳng trùm Ảo Ảnh màn 30.
- **Trùm cuối màn 50:** http://127.0.0.1:5173/?debug&final&lang=vi
- **Dạng Hư Vô, có phương trình:** http://127.0.0.1:5173/?debug&void&eq&lang=vi
- Khi đã mở debug: **K** (ngoài trận) vào thẳng trùm map hiện tại, **Shift+K** vào thẳng trùm cuối; F8 vẫn dùng được; trong trận K vẫn là KO đối thủ. Ô `DEBUG` cũng cho nhập số màn rồi bấm “Thử màn”. Các lối thử tự mở khoá trong phiên debug, không sửa save; số màn ngoài 1–53 bị từ chối.
- Mã điều hướng debug được **xoá khỏi HTML khi build CrazyGames**. Bản web trên tên miền công khai cũng từ chối debug, kể cả thêm URL/phím trên.

## Đưa lên mạng

Bản CrazyGames được sinh từ `index.html`, không sửa trực tiếp file trong `dist/`:

```bash
node tools/build-crazygames.mjs
node tools/test-polish.mjs
```

Build tạo `dist/crazygames/` và `dist/spin-top-crazygames.zip`, kèm Three.js và âm thanh nội bộ. Kiểm thử cần Node 22+ và Chrome (có thể đặt biến `CHROME`), tự mở HTTP server và dùng CDP, không cần cài package. Báo cáo và ảnh kiểm tra nằm trong `dist/`. Kiểm thử SDK dùng mock; quảng cáo thật vẫn cần kiểm tra qua môi trường CrazyGames.

Game là trang tĩnh nên GitHub Pages phục vụ được nguyên trạng: đẩy kho lên GitHub, vào Settings → Pages, chọn nhánh `main` và thư mục gốc. Game sẽ có địa chỉ `https://<tên-tài-khoản>.github.io/SpinTopShowdown/`.
