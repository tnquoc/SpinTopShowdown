# Ghi chú bản polish / cân bằng

Chỉnh trên `index.html` đang có thay đổi của chủ dự án. Không commit/push; giữ nguyên mã cover/video, các script capture và phần SDK/quảng cáo/CrazyGames. `dist/` là sản phẩm sinh tự động.

## Tên map / trùm và intro

`storyTitle` giữ text/class animation của trùm trước khi sang lời người kể hoặc kết thúc cảnh. Đã xoá thẻ tên ở mỗi dòng/cảnh mới, khi đóng cảnh và chuyển map. Chuyển map cũng huỷ callback cảnh cũ để không vô tình phóng trận trước, xoá banner hạ trùm và popup cũ. Tên màn, thẻ intro và trùm dùng trực tiếp `CHAPTERS`/`FOES`; sửa mô tả sân đình còn nhắc Huyết Nguyệt và mô tả nón lá sai về gờ chắn. Tên người nói lấy từ boss hiện tại, nên hội thoại sau tái sinh cũng dùng đúng tên/màu Hư Vô thay vì tên gốc.

Intro gồm map, môn phái, đặc tính sàn, trùm/chiêu và gợi ý khắc chế. Hiện một lần mỗi map trong phiên chơi, kể cả vào thẳng màn giữa chương; tự đóng sau 5 giây thực hoặc bỏ qua bằng nút/Space/Enter/Esc. Không phóng trận khi bỏ qua. Cốt truyện chương đầu vẫn được giữ.

## Trang bị / hợp chiêu

- Tối đa **2 chiêu**, thay cho 3 ở bản polish trước. `1–2` hoặc chạm ô chỉ chọn; Space/nút lớn thi triển. Dùng chung năng lượng, không chồng stance; đổi ô không huỷ chiêu hay bỏ qua thời gian nghỉ 0,9 giây. Save một chiêu giữ một ô; save ba chiêu giữ ô đầu và chiêu đang chọn nếu chiêu đó từng ở ô thứ ba. Lọc chiêu khoá/trùng; phím 3 không chọn được ô nào.
- Khi đủ hai ô, chiêu mới thay ô đang chọn; bấm chiêu đã trang bị để bỏ, luôn giữ ít nhất một chiêu. Địa hình giữ Space = nhảy và ẩn UI hợp chiêu.
- Hợp chiêu chỉ dùng **đúng hai chiêu đang trang bị**, theo thứ tự bất kỳ. Cửa sổ **6 → 8 giây** sau khi chiêu đầu hết, hồi hợp chiêu 10 giây. Tăng cửa sổ vì nạp lại một thanh mất 6 giây: cặp Sấm/Tốc ở sức chứa một thanh trước đây chỉ còn vài phần mười giây để bấm.
- Cách dùng: chạm công thức ✦ trong xưởng để trang bị cặp → Space/nút lớn dùng chiêu đầu → chờ hết chiêu và đủ một thanh → **C hoặc chạm nút hợp chiêu sáng**. Nút này tự chọn/thi triển chiêu thứ hai; không cần hai phím cùng lúc. Đổi ô rồi dùng Space cũng hợp được. Không bỏ qua năng lượng, hồi chiêu hoặc thời gian ngưng đọng.
- Có mẹo lần đầu mở kỹ năng thứ hai, đặt gần tiêu đề xưởng; bảng ba công thức có hiệu quả, mốc mở khoá và nút trang bị cặp. Mỗi intro map nhắc cách hợp/cặp hiện tại. HUD hiện tên cặp, chiêu tiếp, thời gian còn lại, trạng thái thiếu năng lượng và xác nhận đã hợp. Hai chiêu không cùng công thức vẫn dùng riêng.
- Sấm + Tốc = **Lôi Bộ**: thêm **12% quay → 10 quay cố định** lên địch gần nhất trong 6 m, chịu khắc chế/giáp. Tránh cộng thêm một đòn phần trăm khiến boss nhiều quay lại bị xoá quá nhanh. Mở sau trùm màn 15.
- Ảo + Hồng Liên = **Liên Ảnh**: hồi **12 → 10 quay**, không vượt mức phóng ban đầu. Cặp phòng thủ/hồi phục, mở sau trùm màn 30.
- Lửa + Lốc = **Hoả Lốc**: thêm 4 sát thương quay/giây vào hút lốc hoặc vệt lửa của hợp chiêu.
- Cặp Hoả Lốc mở sau trùm màn 20. Cả ba cặp đều cần đúng hai ô và đã được kiểm tra theo cả hai thứ tự.

## Thông số trước → sau

Mốc “trước” là bản polish ngay trước follow-up này, không phải bản gốc trước lần chỉnh đầu. Đơn vị quay là rad/s; các con số sát thương tính trước khắc chế/giáp. Cả mười chiêu đều được rà lại về vai trò, map/boss, sức mạnh và độ rõ hình ảnh; các quy tắc áp dụng cả cho NPC.

| Chiêu | Trước | Sau |
| --- | --- | --- |
| Lốc Xoáy | 2s; hệ số 0,40/0,55/0,65; hút 3,5/4/4,5m; rút 7/s, hồi 25%, lực nổ 13 | Giữ các số này sau đánh giá: vai trò gom nhiều địch/khắc Bạo Viêm đã phù hợp, không tăng lại khả năng thắng mọi boss. Vòng xoáy và thẻ tên/thời gian cho biết lúc hút/nổ. |
| Sấm Sét | 34% không giới hạn; lực hất 10 | 26%, tối đa 24; lực hất 8. Giữ tầm 8m, khoá 0,8s, giật ngược 8%. Kim Cang/Hồng Liên cản ngắt chiêu; boss được bọc giáp cũng chống ngắt. |
| Hồng Liên | 3s; giảm sát thương kỹ năng 75%, phản 35%, hồi 4/s; khối lượng va chạm ×5 | 3s; giảm 60%, phản 25%, hồi 3/s; khối lượng va chạm ×1,6. Giữ miễn hao va chạm, lực chạy 65%, hao ×1,2; dễ bị đẩy hơn Thiết Giáp để không kiêm mọi vai trò phòng thủ. |
| Tốc Biến | 0,7s; ngắm 8m; va ×2,2, thêm 12 | 0,6s; ngắm 6m; va ×2, thêm 10. Giữ vận tốc 14m/s, né lửa/băng và phanh mép; cần chọn góc/tình huống. |
| Bạo Viêm | Thi triển 4s, vệt tồn tại 5s; 18/s cho cả địch và bản thân | Thi triển 3,5s, vệt 4s; địch 12/s, bản thân 3/s sau khi hết chiêu. Thêm bùng 8 quay trong 2,5m khi dùng và làm vùng băng đang đứng tan sau 0,4s. Không tự đốt khi đang thi triển. |
| Thiết Giáp | 4s; khối lượng hiệu dụng ×3; lực chạy 50%; hao ×1,5 | 3,5s; khối lượng ×3,5; lực chạy 70%; hao ×1,25. Thêm giảm hao quay va chạm 45%, sát thương kỹ năng 30% trừ Sấm, lực dốc 35%. |
| Ảo Ảnh | 3,2s, hoàn 25% năng lượng | 2,6s, hoàn 15%; giữ miễn hiệu ứng/xuyên va chạm và mất 5% khi thoát ngoài gờ. Giảm thời gian né toàn diện; Sấm và mép hở vẫn đe doạ. |
| Kim Cang | 3s; hao ×2; lực phản 6; phản 8% quay mỗi va chạm mới | 2,2s; hao ×1,15; lực phản 9; phản 10 quay, tối đa mỗi 0,5s/địch. Cửa sổ ngắn, đòn phản rõ và không bào phần trăm boss vô hạn. |
| Băng Giới | 4s, bán kính 4,5m; chủ chiêu cũng trượt; không sát thương | 4,5s, bán kính 3,8m; chủ miễn vùng của mình, địch mất 3/s. Giữ giảm thêm 35% hút/rút Lốc. Vùng nhỏ hơn đổi lấy quyền giữ chỗ và sát thương nhẹ. |
| Huyết Nguyệt | 3s, 4,5m; trao đổi hai chiều, tối đa 16/s; có thể cho quay sang địch | 2,8s, 5m; chỉ hút: 12/s nếu địch nhanh hơn, 4/s nếu yếu hơn; tự hao thêm 3/s; hồi không quá 120% quay ban đầu. Giữ giới hạn sàn quay của Hư Vô. |

Lốc V2/V3 vẫn tốn 2/3 thanh; thời gian nhân 1,25/1,5 và sức mạnh nhân 1,5/2 như cũ. Bậc chiến dịch vẫn mở ở màn 10/20, cấp trong trận vẫn tăng bằng knock-out. Các thay đổi cho kỹ năng áp dụng cho cả đối thủ để quy tắc nhất quán.

| Chiêu | Tình huống nổi trội / đánh giá VFX |
| --- | --- |
| Lốc | Gom đệ tử, phá Bạo Viêm; bị Sen/Băng/giáp chống lại. Giữ xoáy lớn và vòng nổ, thêm tên/thời gian trên thẻ con quay. |
| Sấm | Ngắt Ảo Ảnh, phá Thiết Giáp; kém hiệu quả trước Kim Cang/Sen, chịu phạt sàn ướt. Tia sét/điện lưu phân biệt rõ. |
| Hồng Liên | Đỡ chu kỳ Lốc/Huyết Nguyệt, hồi vừa phải trước áp lực. Cánh sen hồng và thời gian còn lại làm rõ thế thủ. |
| Tốc | Thoát vùng lửa/băng hoặc kết liễu gần mép, tránh đâm Giáp/Kim Cang. Đuôi xanh và thời gian ngắn rõ hơn. |
| Bạo Viêm | Giữ vùng, phá Hồng Liên/Băng Giới. Bùng lửa ngay khi dùng; vệt mờ theo đúng tuổi thọ 4s. |
| Thiết Giáp | Chống cú lao Hắc Phong, giữ chỗ ở mép trong khi vẫn di chuyển. Vỏ thép thêm hạt sáng bạc và thẻ tên, không nhầm với thế đứng im Kim Cang. |
| Ảo Ảnh | Né Kim Cang/chuỗi chiêu boss cuối, đổi vị trí để sống sót. Bóng mờ/đuôi cyan giữ nguyên, có đồng hồ kết thúc. |
| Kim Cang | Đón cú Tốc Biến đang lao đến; mạnh hơn Sen ở phản lực, nhưng đứng im và ngắn. Vòng vàng nảy rõ lúc phản đòn. |
| Băng Giới | Kìm Giáp/Lốc trong vùng, giữ đường trên sàn trơn; bị Lửa phá. Rìa vùng của bạn xanh ngọc, của địch hồng, hạt băng chỉ bám mục tiêu thực sự chịu băng. |
| Huyết Nguyệt | Hồi sức khi quay yếu hơn boss nặng Giáp/Kim Cang; không phải đòn mở trận miễn phí. Thêm vòng đỏ bán kính đúng 5m, tia hút chỉ nối mục tiêu có thể bị hút. |

## Bảng khắc chế

Mũi tên tăng hệ số hiệu ứng/sát thương lên **1,35**; chiều ngược còn **0,65**. Chiêu đang thi triển là thế phòng thủ; nếu đối thủ đang nghỉ thì dùng kỹ năng gốc của đối thủ. Người chơi chỉ nhận thế phòng thủ khi thực sự dùng chiêu, không thể lấy giáp miễn phí bằng đổi ô.

| Chiêu | Khắc |
| --- | --- |
| Sấm Sét | Thiết Giáp, Ảo Ảnh |
| Hồng Liên | Lốc, Huyết Nguyệt |
| Tốc Biến | Bạo Viêm, Băng Giới |
| Bạo Viêm | Hồng Liên, Băng Giới |
| Thiết Giáp | Tốc Biến |
| Ảo Ảnh | Lốc, Kim Cang |
| Kim Cang | Tốc Biến, Sấm Sét |
| Băng Giới | Thiết Giáp, Lốc |
| Huyết Nguyệt | Thiết Giáp, Kim Cang |
| Lốc | Bạo Viêm |

Ngoài hệ số: Ảo miễn các kỹ năng trừ Sấm; Hồng Liên giảm thêm 60% sát thương kỹ năng; Thiết Giáp/Kim Cang giảm lực hút/nổ Lốc thêm 70%; Tốc né vệt lửa và vùng băng. Băng tăng hiệu lực làm trượt với Thiết Giáp/Lốc theo hệ số, đồng thời giảm thêm 35% lực hút/rút của Lốc đang ở trong vùng. Hệ số không thay đổi vật lý va chạm thông thường; sát thương cộng thêm của cú Tốc chịu khắc chế. Vòng máu và mép sàn vẫn nguy hiểm khi dùng Ảo.

## Boss cuối

Ý tưởng hai chiêu là phù hợp vì tạo nhịp học và phản công rõ ràng. Thực hiện bằng đếm lần thi triển thật và đợi hiệu ứng kết thúc, không chỉ đợi một timer:

- Cả hai dạng xoay vòng 10 chiêu thay vì dạng đầu chỉ 6 và dạng Hư Vô chọn ngẫu nhiên. Không lặp chiêu liền nhau. Chu kỳ vẫn tiếp tục sau phản công.
- Dạng núi lửa: sau hai chiêu, nghỉ 3 giây. Ngoài cửa sổ này, sát thương quay nhận còn 55% và có bảo vệ khỏi ring-out; trong cửa sổ có thể đánh/hất khỏi sàn bình thường.
- Hư Vô: chỉ bắt đầu ngưng thời gian sau đủ hai chiêu đã hết hiệu ứng; không thi triển chiêu thứ ba trong khi chờ. Mốc đầu 3,5 → 7 giây, khoảng nghỉ tối thiểu 4,5–5,5 → 7–9 giây. Sau mỗi lần, boss nghỉ 2,4 giây. Nạp một thanh mỗi 3 giây để chu kỳ không bị thiếu năng lượng.
- Giới hạn Hư Vô 90 → 120 giây. Giữ nguyên phương trình, bốn lần phản công, ngưỡng quay và đòn rồng kết thúc. HUD báo số chiêu/2, chiêu tiếp và cửa sổ hở sườn.

## VFX / kiểm tra

Thêm vòng sáng nhiều lớp, màu riêng từng chiêu, tên chiêu tại vị trí thi triển, tia/đuôi Ảo đậm hơn, vòng và chữ báo khắc chế/hợp chiêu. Tái dùng đối tượng hiệu ứng; giải phóng khi đổi map. Điều chỉnh vị trí tiêu đề, bình luận và chu kỳ boss trên điện thoại.

Chạy `node tools/build-crazygames.mjs`, rồi `node tools/test-polish.mjs`. Script tự phục vụ HTTP và mở Chrome headless, thu lỗi JavaScript/console/network, kiểm tra save cũ, tên và intro đủ 10 chương, thao tác trang bị/đổi ô thật, số sát thương/miễn nhiễm/hợp chiêu, chu kỳ boss và kết thúc chiến thắng, màn hình điện thoại, nhảy địa hình, build CrazyGames/SDK mock. Nó xác nhận build khớp chính xác nguồn hiện tại trước khi chạy. Ảnh và báo cáo nằm ở `dist/polish-*.png`, `dist/polish-test-results.json`.

Kết quả chạy thật và danh sách kiểm tra nằm trong `dist/polish-test-results.json`. Kiểm tra đủ mười kỹ năng, cả sáu thứ tự hợp chiêu, nạp năng lượng thật, phím C, chạm cảm ứng thật, hết cửa sổ/hồi hợp chiêu, save ba ô, công thức chưa học, và phím 3 vô hiệu. Kiểm tra boss giữ các con quay sống/tách vị trí để kiểm tra state machine, rồi chạy đến màn thắng; thời lượng đó không đại diện mọi trận thật.

Vòng xác nhận cuối của follow-up: **96 kiểm tra đạt; 0 lỗi JavaScript/console/network**. Đã tạo lại ZIP từ nguồn hiện tại, kiểm tra mã điều hướng debug vắng mặt trong build, thử từ chối debug trên tên miền công khai và chạy thật server bằng đúng lệnh trong README. Ảnh HUD hợp chiêu trên điện thoại: `dist/polish-combo-mobile.png`.

Mô phỏng bổ sung lấy đủ mười kỹ năng, mỗi kỹ năng ba trận trên map phù hợp, với mọi chiêu đã học để thử lại boss cũ. Bot dùng một bộ thông số và đuổi thẳng, không biết canh phản đòn/né/giữ vùng, nên không dùng tỷ lệ thắng bot để khẳng định mọi chiêu cân bằng cho mọi người. Từng vai trò có kiểm tra tình huống riêng, ví dụ Giáp giữ mép tốt hơn Sen, Kim Cang không bị Sấm ngắt, Moon hồi khi yếu hơn địch. Bộ hai chiêu cần chọn đúng tình huống; không đặt mục tiêu một chiêu thắng mọi map. SDK/quảng cáo được đối chiếu giữ nguyên; chưa xác thực quảng cáo thật trên portal.

## Chạy debug cục bộ / cách ly production

Mở PowerShell tại `D:\Projects\SpinTopShowdown`, chạy `node tools/serve-local.mjs`. Không mở file HTML bằng `file://`. Server chỉ bind `127.0.0.1`, dùng Three.js sẵn trong `vendor/`.

- `http://127.0.0.1:5173/?debug&level=25&lang=vi`: thử thẳng boss Thiết Giáp màn 25.
- `level=1` đến `level=53`: màn bất kỳ; số ngoài khoảng hoặc không nguyên bị từ chối.
- `?debug&boss=6`: boss chương 6, màn 30.
- `?debug&final`: trùm cuối màn 50.
- `?debug&void&eq`: vào thẳng Hư Vô với phương trình đã ghép.
- Trong debug: **K** = boss map hiện tại (khi đang đánh, K vẫn là KO đối thủ); **Shift+K** = trùm cuối; F8 vẫn dùng được như K. Ô `DEBUG` cho nhập số màn và bấm “Thử màn”. Các lối thử mở khoá trong phiên, không ghi đè save. `?debug&story` vẫn có thể kiểm tra hội thoại/intro qua điều hướng xưởng.
- DEBUG yêu cầu cả `?debug`, `BUILD !== 'crazygames'` và hostname loopback. Trên tên miền công khai, thêm URL debug cũng không mở được hook/điều hướng.
- `tools/build-crazygames.mjs` xoá cả hai vùng mã `DEBUG NAV` khỏi HTML trước đóng gói và kiểm tra không sót hàm/nút/phím/URL điều hướng. Vì vậy tính năng thử màn không có trong `dist/crazygames/index.html`, kể cả phục vụ gói đó trên localhost.
- Kiểm thử duyệt cả bản local debug, URL local bình thường, bản web giả lập hostname công khai và bản CrazyGames; xác nhận phím/URL chỉ chạy đúng môi trường.

## Cập nhật sau lần chơi thử (19/10)
- **Thanh năng lượng nhanh dần:** thời gian nạp 1 thanh giảm tuyến tính từ **6s (màn 1) xuống 3,2s (màn 50)**, chỉ áp dụng cho người chơi.
- **Đổi chiêu dùng ngay:** thời gian nghỉ 0,9s chỉ chặn dùng lại *cùng một chiêu*; chuyển sang chiêu còn lại là dùng được liền (vẫn cần đủ 1 thanh và chiêu trước đã kết thúc).
- **Từ màn 40:** bắt đầu trận với thanh năng lượng đầy (và vào pha Hư Vô cũng đầy).
- **Hư Vô mở màn nhẹ tay:** lực va chạm của Hư Vô bắt đầu ở 50% và tăng dần về 100% trong 5 giây đầu, để người chơi kịp thấy ngưng đọng thời gian trước khi bị húc văng.
- **Hoả Lốc (Bạo Viêm + Lốc Xoáy):** thành *Lốc Lửa*, dùng số liệu Lốc V3 **gốc trước khi nerf**: thời gian 2,6s×1,5 = 3,9s, hệ số 0,95, tầm hút 6,5m, rút 12/s, lực nổ 17, bán kính nổ 5m×1,6; thêm đốt sàn quanh lốc (16/s) và đốt địch 6/s. Chỉ tốn 1 thanh, dùng thứ tự nào cũng ra Lốc Lửa.
- **Lôi Bộ (Sấm Sét + Tốc Biến):** sét 16 quay vào địch gần nhất, xích 10 quay sang địch khác trong 8m, khoá chiêu địch 0,6s, Tốc Biến lao 18m/s thay vì 14.
- **Liên Ảnh (Ảo Ảnh + Hồng Liên):** hồi tối đa 20 quay (trước 10) và hoàn nửa thanh năng lượng.
- **Hiệu ứng hợp chiêu:** mỗi chiêu có hai màu riêng (xanh–vàng, hồng–ngọc, cam–vàng), 3 vòng sóng, vòi hoa tia xoắn, rung màn hình, loé sáng, và tia lửa quay quanh con quay suốt thời gian chiêu. Lốc Lửa có phễu cam nhấp nháy và tia lửa bay lên.

## Cập nhật tiếp theo (19/10)
- **Đầy thanh năng lượng từ màn 20** (trước là màn 40).
- **Lôi Bộ viết lại (Sấm Sét + Tốc Biến):** con quay chạy nhanh (lực chạy ×1,7) trong **3 giây**, liên tục gọi sét xuống địch gần nhất trong 8m (**5 quay mỗi 0,4 giây**, hiệu ứng sét nhẹ không loé màn hình), và **giảm 10% sát thương nhận** (cả kỹ năng lẫn hao quay do va chạm). Vẫn mở màn bằng sét 16 quay + xích 10 quay, Tốc Biến lao 18m/s.
- **Màn cuối (miệng núi lửa + Hư Vô) mở 4 ô chiêu = hai bộ hợp chiêu:** phím 1–4 chọn chiêu; chạm hai công thức ✦ để mang cả hai bộ. Mỗi hợp chiêu có thời gian hồi 10 giây riêng nên có thể nối bộ này sang bộ kia. Các màn khác vẫn 2 ô (bộ 4 chiêu đã chọn được giữ lại, không mất).

## Hợp chiêu nhanh hơn (19/10)
- **Không còn thời gian hồi.** Trước: phải chờ chiêu đầu kết thúc, nghỉ 0,9s, rồi hợp chiêu còn hồi 10s.
- **Mở sau 1 giây:** dùng một chiêu trong cặp, **1 giây sau** là bấm C (hoặc chạm lời nhắc) để hợp ngay, kể cả khi chiêu đầu còn đang chạy (chiêu đầu bị cắt, nhường cho hợp chiêu). Chỉ cần đủ **1 thanh năng lượng**.
- Cửa sổ hợp chiêu vẫn mở tới 8 giây sau khi chiêu đầu kết thúc. Một lần hợp chiêu không thể nối thẳng thành hợp chiêu tiếp theo (phải dùng thêm một chiêu thường), để tránh spam vô hạn.

## Lôi Bộ kiểu ninja + hợp chiêu bằng SPACE (19/10)
- **Lôi Bộ:** con quay lướt **4 giây** theo hình **ngôi sao năm cánh** (trái, phải, lên, xuống) quanh chỗ đang đứng (tâm được kéo vào trong sàn nếu gần mép), tốc độ lướt tối đa 22 m/s; vẫn gọi sét liên tục (5 quay mỗi 0,4s) vào địch gần nhất trong 8m và giảm 10% sát thương nhận.
- **Hợp chiêu bằng SPACE:** dùng một chiêu bằng SPACE; **1 giây sau**, khi đủ 1 thanh, bấm **SPACE lần nữa** là hợp chiêu. C và chạm lời nhắc vẫn dùng được. Trong 1 giây đầu SPACE chỉ dùng chiêu thường.
- **Lôi Bộ nhanh hơn:** vẫn 4 giây nhưng chạy **hai vòng** ngôi sao, ngôi sao to hơn (bán kính tới 5,5m) nên tốc độ lướt khoảng **25 m/s** (trước ~11 m/s); giới hạn tốc độ nâng lên 36 m/s.

## Ảo Ảnh phản đòn + 5 hợp chiêu (19/10)
- **Ảo Ảnh buff:** khi đang né mà lướt xuyên qua địch, **phản 6 quay mỗi 0,4 giây** cho từng địch bị lướt qua (chỉ áp dụng cho người chơi, địch dùng Ảo Ảnh không phản).
- **Liên Ảnh (Ảo Ảnh + Hồng Liên)** mạnh lên: hồi 20 quay + hoàn nửa thanh, rồi **3,2 giây hoá bóng** xuyên địch: mỗi lần lướt qua **phản 14 quay mỗi 0,3 giây và hút 40% về cho bạn**, hồi thêm 3 quay/giây, miễn lốc/lửa/băng/hút máu như Ảo Ảnh (Sấm Sét vẫn xuyên qua được).
- **Thêm 2 bộ hợp chiêu, đủ 5 bộ cho 10 chiêu:**
  - **Kim Thân Bất Hoại (Thiết Giáp + Kim Cang)** — mở khoá sau trùm màn 35: 3,5 giây bất động như núi (khối lượng ×8), nhận 60% sát thương, hao quay va chạm ×0,3; ai chạm vào bị hất 11 và mất 16 quay (tối đa mỗi 0,4s/địch); mở màn đẩy lùi + 8 quay địch trong 4,5m.
  - **Huyết Băng (Băng Giới + Huyết Nguyệt)** — mở khoá sau trùm màn 45: vùng băng đỏ bán kính 5m trong 4,5 giây, địch trượt và bị hút 8 quay/giây về cho bạn (tới 120% quay ban đầu).
  - Các bộ cũ: Lôi Bộ (Sấm Sét + Tốc Biến), Liên Ảnh (Ảo Ảnh + Hồng Liên), Hoả Lốc (Bạo Viêm + Lốc Xoáy).
- **Kim Thân Bất Hoại có hiệu ứng riêng** (không còn giống Thiết Giáp/Kim Cang thường): viên ngọc vàng khổng lồ bao quanh con quay, 6 mảnh kim cương bay vòng, pháp trận lục giác vàng xoay dưới sàn, hai cột sáng, mưa tia vàng và sóng vàng lan ra mỗi nửa giây; mở màn có vòng mảnh vàng bắn ra và cột sáng. Trong lúc hợp chiêu các hiệu ứng Thiết Giáp/Kim Cang thường được ẩn đi.

## Thần Quay Bất Bại (màn 50) không còn tự thua (19/10)
Nguyên nhân khiến trùm "dễ": đo trong mô phỏng cho thấy (1) ngay đầu trận hai đệ tử bị chính Thần Quay và nhau húc văng khỏi miệng núi lửa trong 1–3 giây (không có gờ, tất cả cùng lao vào một điểm), (2) Thần Quay tự hao quay: hao thụ động gấp đôi ở tâm nóng, tốn quay khi đuổi theo, và tự bị đốt/tự hút bởi chính Bạo Viêm/Huyết Nguyệt của mình.
Đã sửa, chỉ áp dụng cho trận miệng núi lửa (màn 50, pha 1):
- **Cả phe một bên:** Thần Quay và đệ tử cùng nhắm vào bạn (không còn lao vào nhau) và **xuyên qua nhau**, không còn húc nhau rớt sàn.
- **Thần Quay chỉ còn 15% hao quay thụ động** (hằng số `GOD_DECAY` trong `index.html`), không nhân đôi ở tâm nóng, không tự đốt bằng Bạo Viêm, không tự hao khi dùng Huyết Nguyệt. Bỏ qua bạn thì ông ta chỉ hao khoảng 0,1 quay/giây.
- Để thắng bạn phải **tự hạ cả 3 đối thủ**: dùng khắc chế, hợp chiêu và cửa sổ "hở sườn 3 giây" sau mỗi hai chiêu của trùm. Nếu quá khó thì chỉnh `GOD_DECAY` (0,15 → 0,3) hoặc cho đệ tử húc nhau lại (xoá dòng `finalTeam()` trong `collide`).

## Màn 50 Royal Rumble + màn 51 Thần Quay (19/10)
Chiến dịch giờ có **51 màn**:
- **Màn 50 – Đại hội Thần Quay** (đấu trường mâm nhôm cổ điển, bán kính 11m, không gờ; sau 15 giây sàn dốc dần; giới hạn 120 giây). Lần đầu vào có cảnh Thần Quay xuất hiện: "trước khi đấu với ta, hãy hạ hết chín chiến tướng của ta". Hai vòng, 9 đối thủ cùng lúc, tất cả đánh tất cả:
  - **Vòng 1:** 9 đệ tử của Thần Quay (đệ tử của chín môn phái, mỗi người một kỹ năng từ chương 3 trở đi).
  - Hạ hết vòng 1 → cảnh Thần Quay giơ tay **hồi sinh 9 cao thủ** (chín trùm các chương 1–9) → **Vòng 2:** chín trùm với kỹ năng riêng. Bạn kéo dây lại từ đầu (quay đầy, năng lượng đầy từ màn 20), đấu trường tối hơn và mỗi linh hồn có vũng bóng đen dưới chân và khói đen bốc lên.
  - Thua ở vòng nào cũng phải làm lại từ vòng 1. Qua vòng 2 mới mở màn 51.
- **Màn 51 – Miệng núi lửa** (màn 50 cũ): **Thần Quay + 2 bản sao** (bản sao không có kỹ năng, chỉ khoẻ: 85% quay, 95% khối lượng, hao quay bình thường); đã bỏ Huyết Nguyệt. Chỉ Thần Quay mới dùng 10 tuyệt kỹ. Hạ Thần Quay **chưa đủ**: phải hạ cả hai bản sao thì ông mới hồi sinh thành Hư Vô.
- Chương 9 có 6 màn trong bảng chọn màn (46–51). Phím debug: **K** từ màn 46–49 nhảy tới màn 50, từ màn 50 nhảy tới màn 51; Shift+K nhảy thẳng màn 51; trong trận K vẫn là KO đối thủ (ở vòng 1 KO sẽ chuyển sang vòng 2).
- Danh sách đối thủ bên trái thu nhỏ khi có hơn 6 con quay. Màn 50 có bốn ô chiêu như màn cuối.

## Sửa lại Chân núi lửa + Rumble + cảnh hồi sinh (19/10, bản mới nhất, thay các mô tả cũ ở trên)
- **Chương 9, màn 46–49 là "Chân núi lửa"** (trước đây là miệng núi lửa): nền đá bazan đen nứt nẻ có vệt dung nham phát sáng, **có vành đai** nên không ai bị văng khỏi sàn, chỉ gục khi hết quay. **Màn 50 Đại hội Thần Quay cũng ở chân núi lửa** (to hơn, bán kính 11m, có vành đai): đấm nhau tới khi gục. **Màn 51 mới là miệng núi lửa** như cũ (tâm nóng, sàn co lại, không có gờ).
- **Tên các con quay ở màn 50 là tên chín trùm trước đó** (Lôi Thần, Hồng Liên, Hắc Phong, Hoả Long, Thiết Giáp, Ảo Ảnh, Kim Cang, Băng Tuyết, Huyết Nguyệt), không còn "đệ tử". Vòng 1 họ là chiến tướng của Thần Quay (chỉ số nhẹ hơn trùm), vòng 2 là chính họ được hồi sinh với chỉ số trùm.
- **Cảnh hồi sinh ghê rợn giữa hai vòng:** Thần Quay nói về "linh hồn không có gì để mất" (hội thoại, màn hình xám lạnh, nhạc tắt, tiếng tim đập) → loé sáng → camera chậm rãi lượn quanh đấu trường trong khi **chín bóng đen lần lượt phá nứt mặt đất trồi lên**, mỗi con một lần rung chuyển, vòng sóng tím–đỏ, khói đen xoắn bốc lên và tia lửa đỏ; con cuối cùng trồi lên là tiếng chuông + dàn hợp xướng và tấm biển "Chín linh hồn trỗi dậy". Space/Esc bỏ qua cảnh. Sau đó mới vào vòng 2 (tối đen, khói đen quanh từng linh hồn).
- **Cảnh Thần Quay gặp bạn** vẫn là lần đầu bấm vào màn 50 (kéo dây). Lưu ý: trước đây bản debug **tắt hội thoại** nên bạn không thấy; từ nay bản debug **bật hội thoại** mặc định, thêm `&nostory` vào URL nếu muốn tắt. Phím K nhảy màn chỉ bỏ qua hội thoại trước trận khi có `&nostory`.

## Liên Ảnh có khắc chế, Hư Vô mạnh hơn, phương trình uy lực hơn (19/10)
- **Liên Ảnh (Ảo Ảnh + Hồng Liên) bị siết lại** vì spam là bất tử:
  - **Hồi chiêu 8 giây** (các hợp chiêu khác vẫn không hồi); bỏ hoàn nửa thanh năng lượng.
  - **Hết hiệu lực bị lộ 1,6 giây**: nhận thêm 40% sát thương kỹ năng và hao quay va chạm.
  - **Khắc chế:** Sấm Sét xuyên qua và **phá ngay hoá bóng** (còn khoá chiêu 0,8s); **Hư Vô Thần Quay không thể bị xuyên qua** (va chạm và kỹ năng của hắn đều trúng bạn kể cả khi đang hoá bóng).
- **Hiệu ứng Liên Ảnh riêng:** bóng ma mờ hồng/xanh ngọc đuổi theo sau lưng (4 ảnh), 12 cánh sen ánh sáng hồng–xanh quay quanh, pháp trận 12 cánh quay dưới sàn, cột sương xanh, và đốm sáng bay lên; không còn dùng vòng cánh hoa hồng của Hồng Liên thường.
- **Hư Vô:** mỗi lần lướt qua sau khi ngưng đọng thời gian **hồi 20% quay gốc** (kèm "+20%" và dòng tia tím đổ về phía hắn). Cú lướt có sao chổi tàn ảnh tím đen, khói đen, vòng sóng rải dọc đường lướt, rung màn hình tăng dần và loé sáng. Bào mòn không còn tác dụng: chỉ phương trình sự sống mới hạ được hắn.
- **Phương trình sự sống uy lực hơn:** khi phương trình đáp lại có cột sáng trắng–vàng, ba vòng sóng vàng/trắng, 160 tia lửa vàng, loé trắng toàn màn hình và slow-motion 0,8 giây; trong lúc bạn đi vòng tròn e^{iθ} có vệt sao chổi vàng và sét thỉnh thoảng đánh vào Hư Vô; khi "= 0" giáng xuống có 3 tia sét từ trời, 4 vòng sóng, 220 tia lửa, slow-motion và rung mạnh.

## Chỉnh lần cuối (19/10)
- **Liên Ảnh:** đã gỡ 3 nerf (hồi chiêu 8s, bỏ hoàn nửa thanh, lộ sườn sau hiệu lực) và gỡ luôn "Sấm Sét phá hoá bóng". Chỉ còn nghỉ **4 giây sau khi hết hiệu lực**; Hư Vô vẫn không thể bị xuyên qua.
- **Hiệu ứng Liên Ảnh nhiều màu:** các bóng ma, 12 cánh sen, pháp trận, vầng sáng và đốm sáng đều đổi màu theo cầu vồng, mỗi phần một sắc; lúc tung chiêu có thêm vòng sóng vàng/tím/xanh lá.
- **Mọi hợp chiêu đều có thời gian nghỉ, tính từ lúc hiệu lực kết thúc:** Lôi Bộ 2s, Hoả Lốc / Kim Thân / Huyết Băng 3s, Liên Ảnh 4s (hiệu lực dài 4 / 3,9 / 3,5 / 4,5 / 3,2 giây).
- **Thần Quay Bất Bại (màn 51) biết hợp chiêu:** sau chu kỳ hai chiêu đầu tiên và cứ mỗi hai chu kỳ, ông **đứng khựng 1,1 giây** (tên chiêu và hiệu ứng báo trước, đó là lúc ông nhận đủ sát thương), rồi tung lần lượt Lôi Bộ (chạy sao + sét liên tục), Hoả Lốc, Kim Thân, Huyết Băng; xong thì hở sườn 3 giây như thường. Ông không dùng Liên Ảnh.
- **Màn 51 là Thần Quay solo một chọi một**, bỏ hai bản sao. Hạ ông là rebirth thành Hư Vô ngay.
- **Viết lại hội thoại** ba cảnh (gặp ở màn 50, hồi sinh, và trước trận màn 51): thêm nhịp châm chọc, ám chỉ về cha, bớt dài dòng.
- **Sấm Sét khắc chế Liên Ảnh (đã khôi phục):** Sấm Sét xuyên qua hoá bóng và **phá luôn trạng thái**, kể cả khi mục tiêu còn đang có hộ thể khác. Hư Vô vẫn không bị xuyên.
- **Hội thoại viết lại theo giọng đe doạ, ngầu kiểu anime** (không giải thích chiêu, không nhắc đệ tử/bản sao): cảnh gặp ở màn 50, cảnh hồi sinh và cảnh trước trận màn 51.

## Miệng núi lửa (màn 51) sập dần xuống dung nham + Thần Quay không bị hất xuống sớm (19/10)
- **Lỗi:** Thần Quay bị Kim Thân Bất Hoại hất văng khỏi sàn ngay ở cửa sổ "hở sườn" nên thua quá nhanh. **Sửa:** Thần Quay chỉ có thể bị hất xuống núi lửa khi **sàn đã sập còn 50%** hoặc khi **quay còn dưới 30%** quay gốc (hàm `godMayFall`); trước đó ông luôn bị đẩy ngược lại vào sàn.
- **Sàn miệng núi lửa đổi sang đá bazan đen gồ ghề** như chân núi (có vết nứt dung nham, tâm nóng đỏ rực, nổi khối bằng bump map), bao quanh là **hồ dung nham** chuyển động.
- **Sàn "co lại" giờ là sập từng mảng:** còn **50%** sau 40 giây (trước là 55%). Quanh mép có vòng đá tảng đen vỡ nát; các tảng đá liên tục rời khỏi mép, rơi xuống dung nham kèm tia lửa và khói; càng thu nhỏ thì càng nhiều tảng rơi và mặt đất rung nhẹ càng mạnh; hồ dung nham toả sáng cam lên rìa đá.
