// One way to win each stage: node tools/check-winnable.mjs (env START, END, STAGES, RUNS, CONFIRM, PASS)
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
  // Is there at least ONE way to win each stage? Try a small set of sensible builds with the
  // skills a first-time player really has; if none wins, ease that stage's foe spin a step and retry.
  const start = +(process.env.START || 1), end = +(process.env.END || 51);
  const only = process.env.STAGES ? process.env.STAGES.split(',').map(Number) : null;
  const N = +(process.env.RUNS || 8), CONFIRM = +(process.env.CONFIRM || 20), PASS = +(process.env.PASS || 30);
  const path = join(root, `dist/winnable-${start}-${end}.json`);
  const report = { runs: N, confirm: CONFIRM, passPercent: PASS, rows: [] };
  const order = ['storm','thunder','lotus','dash','fire','iron','ghost','vajra','ice','moon'];
  const physiques = [[2,.8,.5],[2,.8,.2],[1,.8,0],[3,.6,.2]];
  const strategies = [['',''],['(ex-x)*4-vx*2','(ez-z)*4-vz*2']];
  const measure = async (stage, b, n, offset) => {
    const v = await evaluate(`(()=>{const out=[];for(let i=0;i<${n};i++)out.push(game.campaignSim(${JSON.stringify(b)},${stage},${offset}+i*104729));return out;})()`);
    return { wins: v.filter(x => x.won).length, runs: n, pct: 100 * v.filter(x => x.won).length / n, why: [...new Set(v.map(x => x.why))].join('/') };
  };
  for (let stage = start; stage <= end; stage++) {
    if (only && !only.includes(stage)) continue;
    const available = order.filter((id, k) => k === 0 || stage - 1 >= k * 5);
    const foes = await evaluate(`game.levels[${stage-1}].foes.map(f=>f.skill).filter(Boolean)`);
    const counters = await evaluate('game.rules.COUNTERS');
    const ranked = available.slice().sort((x, y) => foes.filter(f => counters[y].includes(f)).length - foes.filter(f => counters[x].includes(f)).length);
    const sets = stage >= 50
      ? [['ghost','lotus','iron','vajra'], ['thunder','dash','fire','storm'], ['ice','moon','ghost','lotus'], ['thunder','dash','ghost','lotus']]
      : (() => {                                   // the best-ranked single skills and every pair among the top five
          const top = ranked.slice(0, 5), out = top.slice(0, 3).map(id => [id]);
          for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) out.push([top[i], top[j]]);
          for (const pair of [['thunder','dash'],['ghost','lotus'],['fire','storm'],['iron','vajra'],['ice','moon']])   // every fusion pair the player already owns
            if (pair.every(id => available.includes(id)) && !out.some(p => p.length === 2 && pair.every(id => p.includes(id)))) out.push(pair);
          return out;
        })();
    const cands = [];
    for (const skills of sets) for (const [m, r, grip] of physiques) for (const [fx, fz] of strategies) cands.push({ m, r, grip, fx, fz, skills });
    let scale = await evaluate(`game.balanceScales[${stage-1}]`), found = null, tries = [];
    for (let step = 0; step < 8 && !found; step++) {
      if (step) { scale = +(scale * .85).toFixed(4); await evaluate(`game.balanceScale(${stage},${scale})`); }
      const pool = step === 0 ? cands : tries.slice().sort((x, y) => y.pct - x.pct).slice(0, 4).map(x => x.build);
      tries = [];
      for (const b of pool) {
        const r = await measure(stage, b, N, 731);
        tries.push({ build: b, ...r });
        if (r.pct >= 37.5) {
          const c = await measure(stage, b, CONFIRM, 900001);
          if (c.pct >= PASS) { found = { build: b, scale, quick: r, confirm: c }; break; }
        }
      }
    }
    const row = { stage, scale, found, bestTry: tries.slice().sort((x, y) => y.pct - x.pct)[0] };
    report.rows.push(row);
    await writeFile(path, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ stage, scale, win: found ? found.confirm.pct : 0, build: found ? found.build : row.bestTry?.build }));
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
