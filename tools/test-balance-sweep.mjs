// Node 22+ and Chromium. See POLISH-NOTES.vi.md for chunked PowerShell commands.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(root, process.env.SOURCE || 'index.html'), 'utf8');
await mkdir(join(root,'dist'),{recursive:true});
const work = await mkdtemp(join(tmpdir(), 'spin-polish-'));
const pause = ms => new Promise(r => setTimeout(r, ms));
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + '/')) {
      if (!file.startsWith(root + '\\')) throw new Error('Invalid path');
    }
    const body = file === join(root, 'index.html') ? Buffer.from(source) : await readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' })[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=0', `--user-data-dir=${join(work, 'profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
const errors = [], results = [];
try {
  let port;
  for (let i = 0; i < 600; i++) {
    try { port = +(await readFile(join(work, 'profile/DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await pause(100); }
  }
  assert.ok(port, 'Chrome starts');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
  let seq = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); fail(new Error(method + ' timed out')); }, 180000);
    pending.set(id, { ok, fail, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const three = (await readFile(join(root, 'vendor/three.module.js'))).toString('base64');
  const sdk = `window.cgEvents=[]; window.cgSettingsListener=null; window.CrazyGames={SDK:{init:async()=>{},game:{settings:{muteAudio:false},loadingStart:()=>cgEvents.push('loadingStart'),loadingStop:()=>cgEvents.push('loadingStop'),gameplayStart:()=>cgEvents.push('gameplayStart'),gameplayStop:()=>cgEvents.push('gameplayStop'),happytime:()=>cgEvents.push('happytime'),addSettingsChangeListener:fn=>window.cgSettingsListener=fn},ad:{requestAd:async(type,c)=>{cgEvents.push(type);c.adStarted();c.adFinished();}}}};`;
  socket.onmessage = async ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id); if (!p) return;
      pending.delete(m.id); clearTimeout(p.timer); m.error ? p.fail(new Error(JSON.stringify(m.error))) : p.ok(m.result);
    } else if (m.method === 'Fetch.requestPaused') {
      const isSdk = m.params.request.url.includes('sdk.crazygames.com');
      if (m.params.request.url.startsWith('http://production.example/')) {
        const pathname = new URL(m.params.request.url).pathname;
        const body = pathname === '/' ? Buffer.from(source) : pathname === '/favicon.ico' ? Buffer.alloc(0) : await readFile(join(root, pathname));
        await send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: pathname === '/favicon.ico' ? 204 : 200, responseHeaders: [{ name: 'Content-Type', value: pathname === '/' ? 'text/html; charset=utf-8' : 'application/octet-stream' }], body: body.toString('base64') });
        return;
      }
      await send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: isSdk ? Buffer.from(sdk).toString('base64') : three });
    } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args);
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry);
  };
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const check = (name, ok, detail = '') => { assert.ok(ok, `${name}: ${detail}`); results.push(name); console.log('PASS ' + name); };
  const key = async (code, modifiers = 0) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, modifiers, key: { Space: ' ', Escape: 'Escape', Digit1: '1', Digit2: '2', Digit3: '3', KeyC: 'c' }[code] || code });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code });
  };
  const navigate = async path => {
    if (/[?&]debug/.test(path) && !/[?&](no|with)?story/.test(path)) path += '&nostory';   // stories are on in debug now; most checks want them off
    await send('Page.navigate', { url: path.startsWith('http') ? path : base + path });
    for (let i = 0; i < 600; i++) {
      await pause(100);
      if (await evaluate(`!!document.querySelector('#roster')?.children.length`)) return;
      if (errors.length) throw new Error(JSON.stringify(errors));
    }
    throw new Error('Game did not start');
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://cdn.jsdelivr.net/npm/three@*/build/three.module.js' }, { urlPattern: 'https://sdk.crazygames.com/*' }, { urlPattern: 'http://production.example/*' }] });
  // First visit: skills and shards from preceding stages only.
  await send('Page.addScriptToEvaluateOnNewDocument', {source: "localStorage.setItem('tops.voice','false');"});
  await navigate('/?debug&video&nostory&lang=en');
  await evaluate('localStorage.clear()');
  const phase = process.argv[2] || 'before';
  const runs = +(process.env.RUNS || 24), confirm = +(process.env.CONFIRM_RUNS || 80);
  const start = +(process.env.START || 1), end = +(process.env.END || 51);
  assert.ok(Number.isInteger(runs) && runs >= 20 && Number.isInteger(confirm) && confirm >= 60, 'Use >=20 runs/cell and >=60 confirmation runs');
  assert.ok(Number.isInteger(start) && Number.isInteger(end) && start>=1 && end<=51 && start<=end, 'Arena stages 1..51 only');
  const path = join(root, `dist/balance-${phase}-${start}-${end}.json`);
  const order = ['storm','thunder','lotus','dash','fire','iron','ghost','vajra','ice','moon'];
  const strategies = {default:['',''],chase:['(ex-x)*4-vx*.5','(ez-z)*4-vz*.5'],brake:['(ex-x)*4-vx*2','(ez-z)*4-vz*2']};
  const physiques = [[2,.8,.5],[1,.8,0],[2,.8,.2],[3,.6,.2],[1.6,.6,.46],[4,1,.1]];
  const profile=process.env.PROFILE ? JSON.parse(await readFile(join(root,process.env.PROFILE),'utf8')) : null;
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  const report = {phase,runs,confirm,source:process.env.SOURCE || 'index.html',sourceSha256,mode:process.env.CALIBRATE?'calibrate':process.env.TUNE?'tune':'measure',seed:'731 + run * 104729; confirmation 900001 + run * 104729',rows:[],errors};
  if(process.env.RESUME) {
    const old=JSON.parse(await readFile(path,'utf8'));
    assert.ok(old.sourceSha256===sourceSha256 && old.runs===runs && old.confirm===confirm && old.mode===report.mode,'Resume requires the same source, mode and sample sizes');
    report.rows=old.rows;
  }
  report.complete=false;
  await writeFile(path,JSON.stringify(report,null,2));
  let completedCells=0;
  const measure = async (stage,b,n,offset=731) => {
    assert.ok(b.m>=1&&b.m<=4&&b.r>=.5&&b.r<=1.1&&b.grip>=0&&b.grip<=1,'Use settings inside workshop slider bounds');
    assert.ok(Math.abs(b.m*10-Math.round(b.m*10))<1e-7&&Math.abs((b.r-.5)/.02-Math.round((b.r-.5)/.02))<1e-7&&Math.abs(b.grip/.02-Math.round(b.grip/.02))<1e-7,'Use reachable workshop slider steps');
    const values = await evaluate(`(()=>{const out=[];for(let i=0;i<${n};i++)out.push(game.campaignSim(${JSON.stringify(b)},${stage},${offset}+i*104729));return out;})()`);
    assert.ok(stage!==51 || values.every(v=>v.scope==='phase1'),'Stage 51 measures only the god phase until rebirth');
    assert.ok(values.every(v=>v.skills.length<= (stage>=50?4:2) && v.skills.every(id=>order.indexOf(id)*5<=stage-1)), 'Only first-visit skills');
    completedCells++;
    if(completedCells%8===0)await writeFile(join(root,`dist/balance-progress-${phase}-${start}-${end}.json`),JSON.stringify({sourceSha256,stage,completedCells,lastBuild:b,runs:n,wins:values.filter(v=>v.won).length,updatedAt:new Date().toISOString()},null,2));
    return {build:b,runs:n,wins:values.filter(v=>v.won).length,winPercent:100*values.filter(v=>v.won).length/n,averageSeconds:values.reduce((s,v)=>s+v.seconds,0)/n,round2:values.filter(v=>v.round2).length,scope:stage===51?'phase1':'arena',rebirthReached:values.filter(v=>v.rebirthReached).length,reasons:Object.fromEntries([...new Set(values.map(v=>v.why))].map(why=>[why,values.filter(v=>v.why===why).length]))};
  };
  for(let stage=start;stage<=end;stage++) {
    if(report.rows.some(r=>r.stage===stage))continue;
    if(process.env.STAGES && !process.env.STAGES.split(',').map(Number).includes(stage))continue;
    const available=order.filter((id,k)=>k===0||stage-1>=k*5);
    const foes=await evaluate(`game.levels[${stage-1}].foes.map(f=>f.skill).filter(Boolean)`);
    const counters=await evaluate('game.rules.COUNTERS');
    const ranked=available.slice().sort((a,b)=>foes.filter(f=>counters[b].includes(f)).length-foes.filter(f=>counters[a].includes(f)).length);
    const pairs=available.map(id=>[id]);
    for(let i=0;i<available.length;i++)for(let j=i+1;j<available.length;j++)pairs.push([available[i],available[j]]);
    if(stage>=50)for(const pair of pairs.slice())for(const f of [['ghost','lotus'],['thunder','dash'],['iron','vajra'],['ice','moon']])if(new Set([...pair,...f]).size===4)pairs.push([...pair,...f]);
    const unique=[...new Map(pairs.map(p=>[p.slice().sort().join(','),p])).values()];
    const defaultSkills=stage>=50?['ghost','lotus','iron','vajra']:[ranked[0],...ranked.filter(id=>id!==ranked[0]).slice(0,1)];
    if(profile)await evaluate(`game.balanceScale(${stage},${profile.rows.find(r=>r.stage===stage).scale})`);
    const defaultBuild={m:2,r:.8,grip:.5,fx:'',fz:'',skills:defaultSkills};
    if(process.env.RECONFIRM || process.env.EXTEND) {
      const original=profile.rows.find(r=>r.stage===stage);
      const legal=c=>c.build.m>=1&&c.build.m<=4&&c.build.r>=.5&&c.build.r<=1.1&&Math.abs(c.build.grip/.02-Math.round(c.build.grip/.02))<1e-7;
      assert.ok(stage!==51 || original.scope==='phase1','Do not reuse former full-fight/Void cells');
      const cells=original.cells.filter(legal);
      if(process.env.EXTEND)for(const b of JSON.parse(process.env.EXTRA_BUILDS || '[]'))cells.push(await measure(stage,b,runs));
      const ranked=cells.slice().sort((a,b)=>b.winPercent-a.winPercent||a.averageSeconds-b.averageSeconds);
      const candidates=[...new Map(ranked.map(c=>[JSON.stringify(c.build),c])).values()].slice(0,+(process.env.CANDIDATE_COUNT||1));
      const confirmations=[];
      for(const c of candidates)confirmations.push(await measure(stage,c.build,confirm,900001));
      const confirmation=confirmations.sort((a,b)=>b.winPercent-a.winPercent||a.averageSeconds-b.averageSeconds)[0];
      const best=cells.find(c=>JSON.stringify(c.build)===JSON.stringify(confirmation.build));
      const row={...original,cells,excludedCells:original.cells.filter(c=>!legal(c)),best,confirmation,confirmations};
      report.rows.push(row);
      await writeFile(path,JSON.stringify(report,null,2));console.log(JSON.stringify({stage,best:confirmation.winPercent,build:best.build}));continue;
    }
    let scale=profile?.rows.find(r=>r.stage===stage)?.scale || await evaluate(`game.balanceScales?.[${stage-1}] || 1`); const tuning=[];
    if(process.env.CALIBRATE && stage<=50) {
      const row=profile.rows.find(r=>r.stage===stage);
      const target=stage<=5?97-(stage-1)*2:stage<=10?85-(stage-6)*6:stage===50?35:stage%5===0?Math.max(30,55-(stage/5-3)*3):Math.max(48,77-stage*.55-(stage%5-1)*2);
      const scales=[...new Set([row.scale,1,4,6,...(JSON.parse(process.env.EXTRA || '{}')[stage] || []),...row.tuning.map(v=>v.scale),...row.tuning.flatMap(v=>{const list=row.tuning.slice().sort((a,b)=>a.scale-b.scale), next=list[list.findIndex(x=>x.scale===v.scale)+1];return next && (v.winPercent-target)*(next.winPercent-target)<=0 ? [.25,.5,.75].map(t=>+(v.scale+(next.scale-v.scale)*t).toFixed(4)):[];})])];
      for(const candidate of scales) { await evaluate(`game.balanceScale(${stage},${candidate})`); tuning.push({scale:candidate,...await measure(stage,defaultBuild,runs)}); }
      tuning.sort((a,b)=>Math.abs(a.winPercent-target)-Math.abs(b.winPercent-target)||Math.abs(Math.log(a.scale))-Math.abs(Math.log(b.scale)));
      report.rows.push({stage,scale:tuning[0].scale,baseline:tuning[0],tuning:[...row.tuning,...tuning]});
      await writeFile(path,JSON.stringify(report,null,2));console.log(JSON.stringify({stage,scale:tuning[0].scale,default:tuning[0].winPercent}));continue;
    }
    if(process.env.TUNE && stage<=50) {
      const target=stage<=5?100-(stage-1)*3:stage<=10?85-(stage-6)*6:stage===50?35:stage%5===0?Math.max(30,55-(stage/5-3)*3):Math.max(48,77-stage*.55-(stage%5-1)*2);
      for(const candidate of [.25,.4,.55,.7,.85,1,1.2,1.5,2,2.8,4]) {
        await evaluate(`game.balanceScale(${stage},${candidate})`);
        tuning.push({scale:candidate,...await measure(stage,defaultBuild,runs)});
      }
      tuning.sort((a,b)=>Math.abs(a.winPercent-target)-Math.abs(b.winPercent-target)||Math.abs(Math.log(a.scale))-Math.abs(Math.log(b.scale)));
      scale=tuning[0].scale;
      await evaluate(`game.balanceScale(${stage},${scale})`);
    }
    const baseline=await measure(stage,defaultBuild,runs);
    const cells=[baseline];
    // Coordinate sweep: every legal pair at default physics, then all physics/steering
    // combinations for the three strongest pairs. Each reported cell uses >=24 runs.
    for(const skills of unique)cells.push(await measure(stage,{m:2,r:.8,grip:.5,fx:'',fz:'',skills},runs));
    const compare=(a,b)=>b.winPercent-a.winPercent||b.round2-a.round2||(a.wins?a.averageSeconds-b.averageSeconds:b.averageSeconds-a.averageSeconds);
    const top=[...new Map(cells.slice().sort(compare).map(c=>[JSON.stringify(c.build),c])).values()].slice(0,3);
    const stageStrategies=stage>=50?{...strategies,guard:['-x*3-vx*2','-z*3-vz*2'],kite:['(-ex-x)*2-vx*2','(-ez-z)*2-vz*2']}:strategies;
    const stagePhysiques=physiques;
    if(!process.env.DEFAULTS_ONLY)for(const t of top)for(const [m,r,grip] of stagePhysiques)for(const [strategy,[fx,fz]] of Object.entries(stageStrategies)) {
      if(m===2&&grip===.5&&strategy==='default')continue;
      cells.push(await measure(stage,{m,r,grip,fx,fz,skills:t.build.skills},runs));
    }
    const best=cells.slice().sort(compare)[0];
    const confirmation=await measure(stage,best.build,confirm,900001);
    const defaultConfirmation=await measure(stage,defaultBuild,confirm,900001);
    const row={stage,scope:stage===51?'phase1':'arena',scale,tuning,available,baseline,defaultConfirmation,best,confirmation,cells};
    report.rows.push(row); await writeFile(path,JSON.stringify(report,null,2));
    console.log(JSON.stringify({stage,default:baseline.winPercent,best:confirmation.winPercent,build:best.build,cells:cells.length}));
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  report.complete=true;
  await writeFile(path,JSON.stringify(report,null,2));
  await send('Browser.close');
} finally {
  socket?.close(); chrome.kill(); server.close();
  await pause(300);
  if (dirname(work) !== resolve(tmpdir()) || !basename(work).startsWith('spin-polish-')) throw new Error('Unsafe temporary directory');
  await rm(work, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
}
