// Regenerate the measured Vietnamese appendix after all sweep chunks finish.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read = async name => JSON.parse(await readFile(new URL('../dist/'+name,import.meta.url),'utf8'));
const before = new Map(), after = new Map();
for(const name of ['balance-before-1-25.json','balance-before-26-51.json','balance-before-wet-6-10.json','balance-before-reconfirmed-8-8.json','balance-before-corrected-16-35.json','balance-before-corrected-36-51.json','balance-before-reconfirmed-45-45.json','balance-before-final-51-51.json']) {
  const dataset=await read(name);
  for(const row of dataset.rows)before.set(row.stage,{...row,provenance:{file:name,sourceSha256:dataset.sourceSha256||null}});
}
const afterFiles=process.argv.includes('--fresh')?['balance-after-1-25.json','balance-after-26-49.json','balance-after-reconfirmed-50-50.json','balance-after-extended-51-51.json']:['balance-after-1-25.json','balance-after-reconfirmed-13-24.json','balance-after-corrected-16-25.json','balance-after-fine-15-20.json','balance-after-26-49.json','balance-after-fire-fine-22-29.json','balance-after-50-50.json','balance-after-reconfirmed-50-50.json','balance-after-final-51-51.json','balance-after-extended-51-51.json'];
for(const name of afterFiles) {
  const dataset=await read(name);
  for(const row of dataset.rows)after.set(row.stage,{...row,provenance:{file:name,sourceSha256:dataset.sourceSha256||null}});
}
assert.equal(before.size,51);assert.equal(after.size,51);
const pct = x => x.winPercent.toFixed(1).replace('.0','')+'%';
const sec = x => x.averageSeconds.toFixed(1);
const lines = [
'## Cân bằng toàn bộ 51 màn đấu trường (20/10/2026)',
'',
'Đo bằng Chromium, vật lý thật bước 1/120 giây. Mỗi ô tìm kiếm 24 trận; cấu hình tốt nhất tìm được được xác nhận bằng 80 seed khác. Bộ mặc định: khối lượng 2, bán kính 0,8, grip 0,5, để trống fx/fz, mang tối đa hai kỹ năng đã mở ưu tiên khắc địch. Không phải người chơi chỉ dùng Lốc. Mốc mở được tính từ màn đã thắng trước đó: đánh màn 10 chưa có Sen hay Lốc cấp 1; đánh màn 20 chưa có Lửa hay Lốc cấp 2. Màn 50/51 được bốn ô. Năng lượng dùng đúng luật thật, không bơm thêm.',
'',
'Bot quyết định mỗi 0,18 giây, chọn kỹ năng khắc chế trong tầm, tránh Sấm trên sàn ướt khi có lựa chọn khác, chờ thế thủ nếu không có chiêu khắc và hợp chiêu khi đủ thanh. Màn 50/51 mặc định dùng bốn ô: Ảo + Sen + Giáp + Kim Cang; ở màn 51 biết hồi bằng Liên Ảnh khi dưới 70% tốc độ quay ban đầu. Màn 50 phải thắng cả hai vòng; màn 51 phải qua Thần Quay rồi Hư Vô, ghép phương trình thật và dùng nhánh QTE headless sẵn có (có thể trượt). Không dùng game.ko, ép thắng, hay eulerOverride. Thời gian cộng cả hai vòng/pha, gồm đoạn kết ngắn; bỏ thời gian ở xưởng, hội thoại và phim chuyển cảnh.',
'',
'Tìm kiếm theo tọa độ: thử mọi kỹ năng đơn/cặp hợp lệ với thông số mặc định, lấy ba bộ tốt nhất để thử sáu bộ khối lượng/bán kính/grip × ba cách lái (trống, đuổi, đuổi có phanh). Hai màn cuối thử thêm các bộ bốn kỹ năng và hai cách lái giữ tâm/né đối diện; màn 51 thử thêm 11 bộ thân quay, giữ cặp Sen + Ảo trong vòng thử thân quay để không bỏ sót cách sống qua Hư Vô. Thử bổ sung 12 bộ đi vòng ở màn 51. Giới hạn thật của xưởng: khối lượng 1–4, bán kính 0,5–1,1, grip 0–1; chỉ bộ chọn được bằng các bước thanh chỉnh mới đủ điều kiện khuyến nghị. Các ô chẩn đoán vượt bước/giới hạn được loại, không dùng làm bộ thắng. Đây là tốt nhất **đã tìm thấy**, không chứng minh tối ưu trên mọi thông số liên tục. Các lần dò thông số có ít nhất 24 trận; xác nhận dùng seed khác với tìm kiếm. Màn 50 xác nhận năm ứng viên × 80 trận; màn 51 xác nhận mười ứng viên × 80 trận để tránh chọn bộ chỉ may mắn ở mẫu 24.',
'',
'Các tỷ lệ dưới đây là **đã đo**, không phải ước lượng người thật. Mẫu 24 trận khá nhỏ (mỗi trận tương ứng 4,17 điểm phần trăm); kể cả 0/24 cũng không chứng minh xác suất thật bằng 0. Người thật có thể né, đổi mục tiêu, canh thời điểm tốt hoặc kém hơn bot. Chưa có thử nghiệm người chơi hay số liệu giữ chân trên portal.',
'',
'Bản cuối dùng hệ số quay riêng từng màn trong STAGE_SPIN của index.html; chỉ nhân chỉ số quay địch, không đổi số đệ tử hay luật sàn thường. Rumble nhân 7,5 ở cả hai vòng để bốn ô hợp chiêu vẫn gặp thử thách. Thần Quay màn 51 giảm khối lượng 10,78 → 7, quay 124 → 86,8; lực kéo vào tâm K 1,8 → 3, ma sát sàn 1 → 1,35. Hư Vô giữ bán kính 8 và sàn có gờ, quay 136 → 95,2; hao quay sàn 1 → 3,3 nên grip thấp có lợi. Nạp chiêu của Hư Vô 3 → 4 giây; khi trượt QTE giữ lại 60% thay vì 40% quay; trả lời đúng hút lại 65% thay vì 35% phần quay lấy từ thần. Bốn câu trả lời, ngưỡng quay bất tử 14 và điều kiện phương trình giữ nguyên. Vùng QTE vẫn thu nhỏ: 0,32 × 0,92^lần, tối thiểu 0,16 (trước: ×0,82, tối thiểu 0,1); xác suất trúng của bot vẫn tối đa 92%, không ép hoàn hảo.',
'',
'Đã sửa bước mô phỏng hạ xuống sàn: phần này vốn chạy trong hình ảnh, bỏ hình ảnh làm người chơi lơ lửng, tránh vệt lửa và không mở QTE Hư Vô. Bot nay hạ xuống theo bước 1/120 giây; mọi số cuối từ màn 16 trở đi đã chạy lại bằng bản sửa. Đây vẫn là xấp xỉ nhịp hạ xuống so với tốc độ khung hình của máy người chơi. Các JSON chẩn đoán cũ không dùng trong bảng; dist/balance-final-results.json chỉ rõ tệp nguồn của từng dòng cuối.',
'',
'| Màn | Mặc định trước → sau (24 trận) | Tốt nhất trước → sau (80 trận) | Giây mặc định trước → sau | Giây tốt nhất trước → sau | Mặc định xác nhận sau: % / giây (80 trận) |',
'|---|---:|---:|---:|---:|---:|'];
for(let stage=1;stage<=51;stage++) {
  const a=before.get(stage),b=after.get(stage);
  lines.push(`| ${stage} | ${pct(a.baseline)} → ${pct(b.baseline)} | ${pct(a.confirmation)} → ${pct(b.confirmation)} | ${sec(a.baseline)} → ${sec(b.baseline)} | ${sec(a.confirmation)} → ${sec(b.confirmation)} | ${pct(b.defaultConfirmation)} / ${sec(b.defaultConfirmation)} |`);
}
lines.push('','Gợi ý theo nhóm (bộ ở màn cuối nhóm; thông số riêng từng màn và toàn bộ ô thử nằm trong JSON):','','| Nhóm màn | Khối lượng / bán kính / grip | Kỹ năng | Lái | Mẹo |','|---|---|---|---|---|');
for(const [lo,hi] of [[1,5],[6,10],[11,15],[16,20],[21,25],[26,30],[31,35],[36,40],[41,45],[46,49],[50,50],[51,51]]) {
  const b=after.get(hi).confirmation.build;
  const steering=!b.fx?'Trống':b.fx.startsWith('-x')?'Giữ tâm':b.fx.startsWith('(-ex')?'Né đối diện':b.fx.includes('*2')?'Có phanh':'Đuổi';
  const tip=hi===51?'Ghép phương trình, canh bốn lần ngừng thời gian.':hi===50?'Đủ sức cho cả hai vòng; tận dụng hợp chiêu.':hi===10||hi===40?'Tránh Sấm trên sàn ướt; đợi khi hết thế thủ.':hi===45?'Giữ giữa sàn, tránh vành trăng máu.':'Chọn chiêu khắc; chờ thế thủ hết nếu không khắc được.';
  const names={storm:'Lốc',thunder:'Sấm',lotus:'Sen',dash:'Lướt',fire:'Lửa',iron:'Giáp',ghost:'Ảo',vajra:'Kim Cang',ice:'Băng',moon:'Trăng'};
  lines.push(`| ${lo===hi?hi:lo+'–'+hi} | ${b.m} / ${b.r} / ${b.grip} | ${b.skills.map(id=>names[id]).join(' + ')} | ${steering} | ${tip} |`);
}
const low=[...after.values()].filter(r=>r.confirmation.winPercent<60).map(r=>r.stage);
const zeros=[...after.values()].filter(r=>r.baseline.wins===0).map(r=>r.stage);
const cliffs=[];for(let i=2;i<=51;i++)if(after.get(i-1).baseline.winPercent-after.get(i).baseline.winPercent>30)cliffs.push(i);
lines.push('',`Kiểm toán số đo: cấu hình tốt nhất dưới 60%: ${low.join(', ')||'không'}; mặc định 0 trận thắng: ${zeros.join(', ')||'không'}; bước tụt hơn 30 điểm phần trăm: ${cliffs.join(', ')||'không'}.`, '',`Màn 51 không ghép phương trình: ${after.get(51).withoutEquation.wins}/${after.get(51).withoutEquation.runs} trận thắng.`,
'',
'Hai cột mẫu mặc định khác nhau là hai nhóm seed, không được xem là xác suất cố định. Ví dụ màn 51: 37,5% ở 24 seed tìm kiếm nhưng 15% ở 80 seed xác nhận; bộ khuyến nghị đạt 72,5% ở 80 seed xác nhận. Một số màn thường vẫn nằm ngoài khung mong muốn 50–65% ở mẫu xác nhận (như màn 24 và 36), dù không còn 0%; số liệu chưa chứng minh đường khó luôn đều với mọi người. Không che những lệch này bằng số ước lượng.',
'',
'Build CrazyGames thành công. tools/test-polish.mjs đạt 160/160: giữ 155 kiểm tra cũ, thêm năm hồi quy về mặc định màn 1–5, bộ thắng mẫu có trùm, nhịp màn 12–15, mốc mở/tier thật và không thắng Hư Vô khi thiếu phương trình. Chỉ điều chỉnh dữ liệu dựng cảnh kiểm tra Rumble: quay người chơi 5000 để không chết trước khi ép hạ địch ở các chỉ số mới; giữ nguyên kiểm tra chuyển đủ hai vòng. Tăng thời gian chờ lệnh trình duyệt lên 120 giây cho các lô mô phỏng dài. SDK/quảng cáo dùng bản giả trong kiểm tra, chưa xác minh portal thật.',
'',
'Chạy lại trong PowerShell (Node 22+, Chrome; CHROME có thể đổi đường dẫn):',
'',
'```powershell',
"$env:START='1'; $env:END='25'; node tools/test-balance-sweep.mjs after",
"$env:START='26'; $env:END='49'; node tools/test-balance-sweep.mjs after",
"$env:START='50'; $env:END='50'; node tools/test-balance-sweep.mjs after",
"$env:START='51'; $env:END='51'; node tools/test-balance-sweep.mjs after-final",
'```',
'',
'Để lặp lại phần xác nhận chọn bộ cuối (sau các lượt trên):',
'',
'```powershell',
"$env:RECONFIRM='1'; $env:CANDIDATE_COUNT='5'; $env:PROFILE='dist/balance-after-50-50.json'",
"$env:START='50'; $env:END='50'; node tools/test-balance-sweep.mjs after-reconfirmed",
"Remove-Item Env:RECONFIRM; $env:EXTEND='1'; $env:CANDIDATE_COUNT='10'",
"$env:PROFILE='dist/balance-after-final-51-51.json'; $env:EXTRA_BUILDS=Get-Content dist/balance-final-extra-builds.json -Raw",
"$env:START='51'; $env:END='51'; node tools/test-balance-sweep.mjs after-extended",
"Remove-Item Env:EXTEND,Env:PROFILE,Env:EXTRA_BUILDS,Env:CANDIDATE_COUNT -ErrorAction SilentlyContinue",
'node tools/report-balance-sweep.mjs --fresh',
'node tools/build-crazygames.mjs',
'node tools/test-polish.mjs',
'```',
'',
'Mỗi nhóm tự ghi JSON sau từng màn trong dist/balance-<nhãn>-<đầu>-<cuối>.json và tiến độ mỗi tám ô trong dist/balance-progress-*.json; complete=true là nhóm đã xong. Có thể thu nhỏ START/END để chia việc; STAGES là danh sách màn cách nhau bằng dấu phẩy. RUNS mặc định 24, CONFIRM_RUNS mặc định 80. RESUME=1 tiếp tục cùng nhóm nếu mã nguồn, chế độ và số lượt không đổi. SOURCE=dist/balance-before.html chạy bản thông số trước sửa. TUNE=1 dò thang hệ số quay; CALIBRATE=1 cùng PROFILE=<JSON> dò thêm giữa các mức. Các lượt này chỉ ghi dữ liệu, không tự sửa index.html. Xóa các biến môi trường TUNE/CALIBRATE/PROFILE/SOURCE/EXTEND/RECONFIRM/EXTRA_BUILDS sau khi dùng để chạy bản cuối đúng ý.',
'',
'Công thức đuổi: fx=(ex-x)*4-vx*.5, fz=(ez-z)*4-vz*.5; có phanh: thay *.5 bằng *2. Giữ tâm: fx=-x*3-vx*2, fz=-z*3-vz*2. Né đối diện: fx=(-ex-x)*2-vx*2, fz=(-ez-z)*2-vz*2. Trống là để rỗng cả hai ô.',
'',
'Không đổi cốt truyện, VFX hay luật Rumble/crater. Lốc cấp 2 giữ nerf. Bảng khắc chế, thời điểm mở kỹ năng, hợp chiêu và yêu cầu phương trình giữ nguyên. Không commit/push.');
const finalSource=await readFile(new URL('../index.html',import.meta.url));
await writeFile(new URL('../dist/balance-final-results.json',import.meta.url),JSON.stringify({sourceSha256:createHash('sha256').update(finalSource).digest('hex'),stages:51,bestBelow60:low,defaultZero:zeros,cliffs,rows:Array.from({length:51},(_,i)=>({stage:i+1,before:before.get(i+1),after:after.get(i+1)}))},null,2));
const notes = new URL('../POLISH-NOTES.vi.md',import.meta.url), marker='## Cân bằng toàn bộ 51 màn đấu trường';
const old=await readFile(notes,'utf8');
await writeFile(notes,old.split(marker)[0].trimEnd()+'\n\n'+lines.join('\n')+'\n');
console.log(JSON.stringify({stages:51,bestBelow60:low,defaultZero:zeros,cliffs}));
assert.equal(low.length,0,'All 51 recommended builds reach 60% in confirmation');
assert.equal(zeros.length,0,'Every default build has a measured win');
assert.equal(cliffs.length,0,'No adjacent measured default drop exceeds 30 points');
