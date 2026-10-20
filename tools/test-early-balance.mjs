// Node 22+ / Chromium. Seeded, headless first-time balance samples.
// node tools/test-early-balance.mjs after (30 runs/setting; CHROME overrides Chromium path)
// RUNS=100 CONFIRM=1 selects recommended builds; DEFAULTS_ONLY=1 skips the build sweep.
// BASELINE=1 serves dist/early-balance-before.html; SEARCH=1 scans low-grip builds.
// WAIT_ONLY=1 waits for the ward to fade; PROBE=1 measures actual enemy ward gaps.
// Environment examples above use shell-neutral KEY=value notation; use $env:KEY in PowerShell.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let source = await readFile(join(root, process.env.BASELINE ? 'dist/early-balance-before.html' : 'index.html'), 'utf8');
source=source.replace("if (f && Math.hypot(f.x - player.x, f.z - player.z) < 4) castSkill(player);", "if (f && Math.hypot(f.x - player.x, f.z - player.z) < 4 && (!b.avoidWard || !(f.active === 'lotus' && f.skillT > 0))) castSkill(player);");
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
  for (let i = 0; i < 100; i++) {
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
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); fail(new Error(method + ' timed out')); }, 30000);
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
    for (let i = 0; i < 100; i++) {
      await pause(100);
      if (await evaluate(`!!document.querySelector('#roster')?.children.length`)) return;
      if (errors.length) throw new Error(JSON.stringify(errors));
    }
    throw new Error('Game did not start');
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://cdn.jsdelivr.net/npm/three@*/build/three.module.js' }, { urlPattern: 'https://sdk.crazygames.com/*' }, { urlPattern: 'http://production.example/*' }] });
  // First-time progression: no rewards from the boss under test, no fusion, no equations.
  await send('Page.addScriptToEvaluateOnNewDocument', {source: "localStorage.setItem('tops.voice','false');"});
  await navigate('/?debug&video&nostory&lang=en');
  await evaluate('localStorage.clear()');
  const phase = process.argv[2] || 'before';
  const runs = +(process.env.RUNS || 30);
  const defaults = {m:2,r:.8,grip:.5};
  const strategies = {
    passive: {fx:'',fz:''},
    chase: {fx:'(ex-x)*4-vx*.5',fz:'(ez-z)*4-vz*.5'},
    brake: {fx:'(ex-x)*4-vx*2',fz:'(ez-z)*4-vz*2'},
  };
  const settings = [];
  for (const stage of [5,10,15,25]) for(const skill of ['storm','thunder']) {
    if(stage===5 && skill==='thunder') continue;
    for(const strategy of ['passive','chase']) settings.push({stage,skill,strategy,...defaults});
  }
  if(!process.env.DEFAULTS_ONLY) for(const [m,r,grip] of [[1.6,.6,.45],[1,.5,.2],[3,1,.2],[2,.8,.15],[2,.6,.3],[3,.6,.3]])
    for(const skill of ['storm','thunder']) for(const strategy of ['chase','brake']) settings.push({stage:10,skill,strategy,m,r,grip});
  settings.push({stage:10,skill:'storm',strategy:'chase',...defaults,tierOverride:1});
  if(process.env.SEARCH) {settings.length=0;for(const m of [1,2,4]) for(const r of [.5,.8]) for(const grip of [0,.1]) for(const strategy of ['passive','brake']) for(const skill of ['storm','thunder']) settings.push({stage:10,m,r,grip,strategy,skill});}
  if(process.env.WAIT_ONLY) {settings.length=0;for(const strategy of ['passive','chase','brake']) for(const grip of [.5,.2]) settings.push({stage:10,m:2,r:.8,grip,strategy,skill:'storm',avoidWard:true});}
  if(process.env.CONFIRM) {settings.length=0;settings.push({stage:10,m:1,r:.8,grip:0,strategy:'brake',skill:'storm'},{stage:10,m:2,r:.8,grip:.2,strategy:'passive',skill:'storm',avoidWard:true},{stage:10,m:2,r:.8,grip:.2,strategy:'passive',skill:'thunder',avoidWard:true});}
  if(process.env.TIER_ONE) {settings.length=0;for(const [grip,avoidWard] of [[.5,false],[.5,true],[.2,true]])settings.push({stage:10,m:2,r:.8,grip,strategy:'passive',skill:'storm',avoidWard,tierOverride:1});}
  if(process.env.PROBE) settings.length=0;
  const rows=[];
  for(const setting of settings) {
    // Isolate each setting's saved progression; pin the tier to the first-time milestone.
    await evaluate(`localStorage.setItem('tops.campaign', '${setting.stage-1}');`);
    await navigate('/?debug&video&nostory&lang=en');
    const tier=setting.tierOverride ?? (setting.stage>20?2:setting.stage>10?1:0);
    const b={avoidWard:setting.avoidWard || false,m:setting.m,r:setting.r,grip:setting.grip,skill:setting.skill,skills:[setting.skill],dir:1,euler:'',eq:{s:[]},drop:{x:0,z:3.5},aim:{x:0,z:-3},...strategies[setting.strategy]};
    const values=[];
    for(let i=0;i<runs;i++) values.push(await evaluate(`(()=>{let seed=${731+i*104729};Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};game.tier(${tier});const result=game.sim(${JSON.stringify(b)},${setting.stage-1},1,true);if(game.inspect(0).skill!==${JSON.stringify(setting.skill)})throw Error('Wrong skill');return [...result,game.last()];})()`));
    const row={...setting,tier,runs,wins:values.reduce((s,v)=>s+v[0],0),winPercent:100*values.reduce((s,v)=>s+v[0],0)/runs,timeoutWins:values.filter(v=>v[0]&&v[3].foes.some(f=>f[0])).length,averageSeconds:values.reduce((s,v)=>s+v[1],0)/runs};
    rows.push(row); console.log(JSON.stringify(row));
  }
  const wardSamples=[];
  if(process.env.PROBE) for(let run=0;run<3;run++) wardSamples.push(await evaluate(`(()=>{let seed=731+${run}*104729;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};Object.assign(game.build,{m:2,r:.8,grip:.2,skill:'storm',skills:['storm'],fx:'',fz:''});game.setLevel(9);game.closeMapIntro();game.launch();const casts=[];let last=-99;for(let i=0;i<760&&game.info().state==='battle';i++){game.tick(12);const f=game.inspect(1);if(f.lastCastAt!==last&&f.lastCast==='lotus'){casts.push({at:f.lastCastAt,end:f.lastCastEnd,readyAt:f.readyAt});last=f.lastCastAt;}}return {casts,gaps:casts.slice(1).map((c,i)=>c.at-casts[i].end)};})()`));
  if(wardSamples.length)console.log(JSON.stringify({wardSamples}));
  await writeFile(join(root,'dist/early-balance-'+phase+'.json'),JSON.stringify({phase,runs,seed:'731 + run * 104729; LCG',auto:'cast at distance < 4; avoidWard rows wait for ward to fade; single skill; no mash, fusion, equations or later rewards; each run uses fresh progression' ,rows,wardSamples,errors},null,2));
  assert.equal(errors.length,0,JSON.stringify(errors));
  await send('Browser.close');
} finally {
  socket?.close(); chrome.kill(); server.close();
  await pause(300);
  if (dirname(work) !== resolve(tmpdir()) || !basename(work).startsWith('spin-polish-')) throw new Error('Unsafe temporary directory');
  await rm(work, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
}
