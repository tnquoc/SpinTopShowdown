// Node 22+ / Chromium. Self-hosts the game, exercises real browser input and physics.
// Run after node tools/build-crazygames.mjs. CHROME can override the browser path.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(root, 'index.html'), 'utf8');
const expectedBuild = source.replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', './three.module.js')
  .replace("const BUILD = 'web';", "const BUILD = 'crazygames';")
  .replace('</head>', '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n</head>')
  .replace(/\/\/ DEBUG NAV BEGIN[\s\S]*?\/\/ DEBUG NAV END\r?\n/g, '');
assert.equal(await readFile(join(root, 'dist/crazygames/index.html'), 'utf8'), expectedBuild, 'Regenerate the CrazyGames build before running tests');
assert.ok(!/game\.testLevel|debugNav|debugLevel|params\.get\('(?:level|boss)'\)|code !== 'F8'/.test(expectedBuild), 'Local debug navigation must be physically absent from production HTML');
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
    const body = await readFile(file);
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
  // A seeded, old-format save also checks single-skill migration without writing real player data.
  const preload = await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('tops.campaign','50'); localStorage.setItem('tops.build',JSON.stringify({skill:'ghost'})); localStorage.setItem('tops.seen','{}'); localStorage.setItem('tops.voice','false'); let seed=731; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};` });
  await navigate('/?debug&story&lang=vi');
  check('Old single-skill save migrates', await evaluate(`game.build.skills.join() === 'ghost'`));
  check('First two-skill milestone explains fusion controls', await evaluate(`!document.querySelector('#comboTutorial').hidden&&document.querySelector('#comboTutorial').textContent.includes('C')&&document.querySelector('#comboTutorial').textContent.includes('chạm')`));
  await evaluate(`document.querySelector('#comboTipClose').click();game.unlockAll();`);
  check('Dismissed first-time fusion tip stays dismissed', await evaluate(`document.querySelector('#comboTutorial').hidden`));
  // Story title on a real boss, followed by a different chapter's narrator.
  await evaluate(`game.setLevel(9); game.closeMapIntro(); game.launch();`);
  check('Lotus boss title', await evaluate(`document.querySelector('#storyTitle').textContent.includes('Hồng Liên')`));
  await evaluate(`game.setLevel(10)`);
  check('No stale title on Black Wind entry', await evaluate(`document.querySelector('#storyTitle').textContent === '' && !document.querySelector('#storyText').textContent.includes('Hồng Liên')`));
  await key('Escape');
  check('New map intro shows current boss and trait', await evaluate(`!document.querySelector('#mapIntro').classList.contains('hidden') && document.querySelector('#mapBoss').textContent.includes('Hắc Phong') && document.querySelector('#mapTrait').textContent.includes('bia')`));
  check('Map intro explains fusion keyboard and touch controls', await evaluate(`document.querySelector('#mapCounter').textContent.includes('C')&&document.querySelector('#mapCounter').textContent.includes('chạm')`));
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(root, 'dist/polish-intro.png'), Buffer.from(screenshot.data, 'base64'));
  await evaluate(`game.intro()`); // Screenshot capture can take longer than the intro's real-time timeout.
  await key('Space');
  check('Intro skips without launching', await evaluate(`document.querySelector('#mapIntro').classList.contains('hidden') && game.info().state === 'shop'`));
  await evaluate(`game.setLevel(11)`);
  check('Same map does not repeat intro', await evaluate(`document.querySelector('#mapIntro').classList.contains('hidden')`));
  check('Void-only controls stay hidden on ordinary maps', await evaluate(`getComputedStyle(document.querySelector('#voidRow')).display==='none'`));
  await evaluate(`game.setLevel(15); game.endStory();`);
  check('Next map has correct Fire Dragon boss', await evaluate(`document.querySelector('#mapBoss').textContent.includes('Hoả Long') && document.querySelector('#storyTitle').textContent === ''`));
  await pause(6500);
  check('Intro auto dismisses', await evaluate(`document.querySelector('#mapIntro').classList.contains('hidden')`));
  // Every chapter transition, not just the reported Lotus -> Wind case.
  check('All 10 chapter intros use current chapter boss', await evaluate(`(() => { const names=['Lôi Thần','Hồng Liên','Hắc Phong','Hoả Long','Thiết Giáp','Ảo Ảnh','Kim Cang','Băng Tuyết','Huyết Nguyệt','Thần Quay']; return names.every((name,c)=>{game.setLevel(c*5);game.endStory();game.intro();const ok=document.querySelector('#mapBoss').textContent.includes(name)&&document.querySelector('#storyTitle').textContent==='';game.closeMapIntro();return ok;}); })()`));
  check('Navigation clears every transient boss banner', await evaluate(`document.querySelector('#soul').textContent='Old boss';document.querySelector('#soul').className='go boss';document.querySelector('#announce').textContent='Old boss';game.setLevel(10);game.endStory();game.closeMapIntro();!document.querySelector('#soul').textContent&&!document.querySelector('#announce').textContent&&!document.querySelector('#storyTitle').textContent`));
  await evaluate(`game.setLevel(50);game.closeMapIntro();game.launch();game.endStory();game.ko();for(let i=0;i<1000;i++)game.tick(1);`);
  check('Rebirth dialogue uses current Void boss name', await evaluate(`!document.querySelector('#story').classList.contains('hidden')&&document.querySelector('#storyTitle').textContent.includes('Hư Vô Thần Quay')&&document.querySelector('#storyWho').textContent.includes('Hư Vô Thần Quay')`));
  await navigate('/?debug&lang=en');
  await evaluate(`game.unlockAll(); game.setLevel(20);`);
  // Actual workshop clicks: a third skill must replace the selected one.
  await evaluate(`document.querySelector('[data-sk="storm"]').click(); document.querySelector('[data-sk="thunder"]').click(); document.querySelector('[data-sk="lotus"]').click();`);
  check('Two slots / third replaces selected slot', await evaluate(`game.build.skills.length === 2 && game.build.skills.join() === 'ghost,lotus' && document.querySelectorAll('#skillSlots button').length===2`));
  await evaluate(`document.querySelector('[data-sk="ghost"]').click(); document.querySelector('[data-sk="dash"]').click();`);
  check('Equip and remove skills', await evaluate(`game.build.skills.join() === 'lotus,dash'`));
  await evaluate(`game.launch(); game.boost(3);`);
  await key('Digit2');
  check('Keyboard selects second skill', await evaluate(`game.inspect(0).skill === 'dash'`));
  await key('Digit3');
  check('Third key cannot select an extra skill', await evaluate(`game.inspect(0).skill==='dash'&&game.build.skills.length===2`));
  await evaluate(`document.querySelector('#skillSlots [data-slot="0"]').click()`);
  check('Touch/click selects first skill', await evaluate(`game.inspect(0).skill === 'lotus'`));
  await evaluate(`game.skill(); game.selectSkill(1);`);
  check('Switching slots preserves active ward and prevents stacking', await evaluate(`game.inspect(0).active === 'lotus' && game.inspect(0).skillT > 0 && game.skill() === false`));
  // Stop RAF during deterministic physics assertions, while preserving actual input/visual handlers.
  await evaluate(`window.requestAnimationFrame = () => 0`); await pause(150);
  const setup = async (skills, level = 20) => evaluate(`game.build.skills=${JSON.stringify(skills)};game.build.skill=${JSON.stringify(skills[0])};game.setLevel(${level});game.launch();game.boost(3);game.info().tops.forEach((_,i)=>{const a=game.inspect(i);Object.assign(a,{x:i*3,z:0,vx:0,vz:0,yOff:0,vy:0,w:100,skill:i?(a.finalBoss?'god':a.voidGod?'void':null):game.build.skill});});`);
  await evaluate(`window.holdTicks=n=>{for(let i=0;i<n;i++){game.info().tops.forEach((_,j)=>{const a=game.inspect(j);if(j>1)a.alive=false;Object.assign(a,{x:j?3:-3,z:0,vx:0,vz:0,w:500});});game.tick(1);}};game.build.skills=['storm','thunder','dash'];game.build.skill='dash';game.setLevel(20);`);
  check('Three-slot save migrates to two and retains selected skill', await evaluate(`game.build.skills.slice(0,2).join()==='storm,dash'&&game.build.skill==='dash'`));
  check('All three recipes equip exactly their two skills', await evaluate(`(()=>{return game.rules.FUSIONS.every((f,i)=>{document.querySelector('[data-fusion="'+i+'"]').click();return game.build.skills.length===2&&f.ids.every(id=>game.build.skills.includes(id));});})()`));
  await setup(['thunder','dash']);
  await evaluate(`game.inspect(0).energy=1;game.skill();holdTicks(200);`);
  check('Combo prompt explains waiting for one shared energy bar', await evaluate(`!document.querySelector('#btnFusion').classList.contains('hidden')&&document.querySelector('#btnFusion').disabled&&document.querySelector('#btnFusion').textContent.includes('1 bar')`));
  await evaluate(`holdTicks(560)`);
  check('Combo prompt names C, touch, result and remaining time', await evaluate(`(()=>{const b=document.querySelector('#btnFusion');return !b.disabled&&b.textContent.includes('C / TAP')&&b.textContent.includes('Lightning Step')&&b.textContent.includes('Blink Dash')&&b.textContent.endsWith('s');})()`));
  await key('KeyC');
  check('Keyboard C selects and casts second skill using naturally recharged energy', await evaluate(`game.inspect(0).combo==='arc'&&game.inspect(0).skill==='dash'&&game.inspect(0).energy<1&&document.querySelectorAll('#skillSlots button').length===2`));
  await setup(['thunder', 'dash']);
  check('Thunder damage capped at 24 and interrupt', await evaluate(`(()=>{const f=game.inspect(1);Object.assign(f,{skill:'fire',active:'fire',skillT:3,stormT:1});game.skill();return Math.abs(f.w-76)<.01&&f.skillT===0&&f.stormT===0&&f.readyAt>=.8;})()`));
  await setup(['thunder']);
  check('Thunder counters Iron (+35%)', await evaluate(`game.inspect(1).skill='iron';game.skill();Math.abs(game.inspect(1).w-67.6)<.01`));
  await setup(['thunder']);
  check('Thunder cannot erase a high-spin boss with percentage scaling', await evaluate(`game.inspect(1).w=1000;game.skill();Math.abs(game.inspect(1).w-976)<.01`));
  await setup(['thunder']);
  check('Wet-floor backlash reduced to 8%', await evaluate(`game.setLevel(5);game.launch();game.boost(1);game.inspect(0).w=100;game.skill();Math.abs(game.inspect(0).w-92)<.01`));
  await setup(['storm', 'lotus']);
  check('Counter table applies both directions', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);f.skill='fire';const a=game.rules.skillImpact(p,f,'storm');f.skill='lotus';return Math.abs(a-1.35)<.001&&Math.abs(game.rules.skillImpact(p,f,'storm')-.65)<.001;})()`));
  check('All counter relationships match table', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);return Object.entries(game.rules.COUNTERS).every(([id,targets])=>targets.every(target=>{f.skill=target;return Math.abs(game.rules.skillImpact(p,f,id)-1.35)<.001;}));})()`));
  check('Tornado has nerfed range and duration', await evaluate(`game.skill();game.inspect(0).stormDur===3 && game.inspect(0).stormK===.65 && game.inspect(0).stormReach===4.5`));
  check('HUD keeps active Tornado name after slot swap', await evaluate(`game.selectSkill(1);game.tick(0);document.querySelector('#stormLabel').textContent.includes('Tornado')`));
  await setup(['ice']);
  check('Frost counter changes physical steering for Iron', await evaluate(`game.inspect(1).skill='iron';game.skill();game.tick(1);Math.abs(game.inspect(1).steerK-.2/1.35)<.001`));
  await setup(['ghost']);
  check('Phantom duration, refund, immunity and Thunder weakness', await evaluate(`(()=>{game.inspect(0).energy=1;game.skill();const p=game.inspect(0),f=game.inspect(1);return p.skillDur===2.6&&p.energy===.15&&game.rules.skillImpact(f,p,'fire')===0&&game.rules.skillImpact(f,p,'storm')===0&&game.rules.skillImpact(f,p,'thunder')>1;})()`));
  await evaluate(`Object.assign(game.inspect(0),{x:7,z:0,skillT:.001}); game.tick(1)`);
  check('Phantom exit safely returns inside rim', await evaluate(`game.inspect(0).alive && Math.hypot(game.inspect(0).x,game.inspect(0).z)<7.3`));
  await setup(['lotus']);
  check('Lotus reduces skill damage and reflects it', await evaluate(`(()=>{game.skill();const p=game.inspect(0),f=game.inspect(1);const before=f.w;const damage=game.rules.hurtSkill(f,p,'thunder',20);return Math.abs(damage-8)<.01&&Math.abs(f.w-(before-2))<.01;})()`));
  await setup(['dash'], 10);
  check('Dash auto aims and brakes at open edge', await evaluate(`(()=>{game.info().tops.forEach((_,i)=>{if(i>1)game.inspect(i).alive=false;});game.inspect(1).x=3;game.skill();const p=game.inspect(0);if(p.vx!==14||p.skillDur!==.6)return false;Object.assign(p,{x:7.5,z:0});game.tick(1);return p.alive&&p.x<6.3;})()`));
  await setup(['dash']);
  check('Dash adds one bonus spin hit', await evaluate(`game.inspect(1).x=1.2;game.skill();game.tick(1);game.inspect(0).dashHit&&game.inspect(1).w<=90`));
  await setup(['fire']);
  check('Fire has immediate zoning burst', await evaluate(`game.inspect(1).x=2;game.skill();Math.abs(game.inspect(1).w-92)<.001&&game.inspect(0).skillDur===3.5`));
  check('Fire trails damage rivals but spare the active caster', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);f.x=p.x;const pw=p.w,fw=f.w;for(let i=0;i<24;i++)game.rules.skillStep();return Math.abs((fw-f.w)-2.4)<.001&&p.w===pw;})()`));
  await setup(['fire']);
  await evaluate(`game.skill();holdTicks(120);`);
  check('Old self-fire costs 3 spin/s and does not credit self as attacker', await evaluate(`(()=>{const p=game.inspect(0),f=game.rules.fires()[0];Object.assign(p,{x:f.x,z:f.z,skillT:0});const w=p.w;game.rules.skillStep();return Math.abs((w-p.w)-3/120)<.001&&p.lastHitBy!==p;})()`));
  await setup(['ice','fire']);
  check('Fire melts an existing frost field', await evaluate(`game.skill();game.inspect(0).skillT=0;game.inspect(0).readyAt=0;game.selectSkill(1);game.skill();game.rules.fields()[0].until<=.4`));
  await setup(['iron']);
  check('Iron reduces skill damage while remaining weak to Thunder', await evaluate(`(()=>{game.skill();const p=game.inspect(0),f=game.inspect(1);return p.skillDur===3.5&&Math.abs(game.rules.hurtSkill(f,p,'fire',10)-7)<.001&&Math.abs(game.rules.hurtSkill(f,p,'thunder',10)-13.5)<.001;})()`));
  check('Iron remains mobile and visibly armored', await evaluate(`game.tick(1);game.inspect(0).steerK===1&&!!game.inspect(0).ironG&&document.querySelector('#tags').firstElementChild.textContent.includes('Iron Body')`));
  await setup(['lotus','iron']);
  check('Iron holds an open edge better than Lotus', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1),random=Math.random;Math.random=()=>.5;const reset=()=>{Object.assign(p,{m:2,r:.8,I:.64,x:0,z:0,vx:0,vz:0,w:100,lastHit:new Map()});Object.assign(f,{m:2,r:.8,I:.64,x:1.3,z:0,vx:-8,vz:0,w:100,lastHit:new Map()});};try{game.skill();reset();game.rules.collide(p,f);const wardPush=Math.hypot(p.vx,p.vz);p.skillT=0;p.readyAt=0;game.selectSkill(1);game.skill();reset();game.rules.collide(p,f);return Math.hypot(p.vx,p.vz)<wardPush*.8;}finally{Math.random=random;}})()`));
  await setup(['vajra']);
  check('Vajra reflects a charge without losing collision spin', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);f.x=1.2;f.vx=-10;game.skill();game.rules.collide(p,f);return p.w===100&&f.w<90&&f.vx>0&&p.vajraHits.has(f)&&p.skillDur===2.2;})()`));
  check('Vajra resists Thunder interrupts', await evaluate(`game.rules.skillImpact(game.inspect(1),game.inspect(0),'thunder')===.65`));
  await setup(['vajra']);
  check('An actual enemy Thunder cast cannot cancel Vajra', await evaluate(`game.skill();Object.assign(game.inspect(1),{skill:'thunder',energy:1});game.tick(1);game.inspect(0).active==='vajra'&&game.inspect(0).skillT>2&&game.inspect(0).w>80`));
  await setup(['ice']);
  check('Frost spares owner and chips hostile spin in its visible radius', await evaluate(`(()=>{game.skill();const p=game.inspect(0),f=game.inspect(1);const w=p.w,fw=f.w;for(let i=0;i<120;i++)game.rules.skillStep();return game.rules.frostPower(p)===0&&game.rules.fields()[0].r===3.8&&game.rules.fields()[0].until===4.5&&p.w===w&&Math.abs((fw-f.w)-3)<.001;})()`));
  await setup(['moon']);
  check('Blood Moon recovers spin against a faster rival', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);p.w=20;game.skill();game.rules.skillStep();return Math.abs(p.w-20.075)<.001&&Math.abs(f.w-99.9)<.001&&p.skillDur===2.8;})()`));
  await setup(['moon']);
  check('Blood Moon no longer gives spin to weak foes and caps healing', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);p.w=100;f.w=20;game.skill();game.rules.skillStep();if(f.w>=20)return false;p.w=p.w0*1.2;f.w=1000;game.rules.skillStep();return p.w<=p.w0*1.2+.001;})()`));
  for (const [pair, kind] of [[['thunder','dash'],'arc'],[['ghost','lotus'],'heal'],[['fire','storm'],'flare'],[['iron','vajra'],'fort'],[['ice','moon'],'rime']]) {
    for(const ids of [pair,[...pair].reverse()]) {
      await setup(ids);
      await evaluate(`game.skill();holdTicks(760);`);
      await evaluate(`document.querySelector('#btnFusion').click();`);
      check('Two-skill fusion ' + ids.join(' → '), await evaluate(`game.inspect(0).combo===${JSON.stringify(kind)}&&game.build.skills.length===2`));
      check('Fusion cooldown cannot be bypassed by slot swaps ' + ids.join('/'), await evaluate(`game.rules.comboOffer(game.inspect(0))===null`));
      if (kind === 'flare') check('Firestorm runs at original V3 strength in either order ' + ids.join(' → '), await evaluate(`(()=>{const p=game.inspect(0);return p.stormFuse===true&&p.stormLv===3&&Math.abs(p.stormDur-3.9)<.001&&p.stormT>3.5;})()`));
    }
  }
  await setup(['thunder','dash']);
  check('Switching to the other skill is allowed immediately, repeating one is not', await evaluate(`(()=>{const p=game.inspect(0);game.skill();p.skillT=0;p.energy=1;game.selectSkill(1);game.skill();const swapped=p.active==='dash'&&p.skillT>0;p.skillT=0;p.energy=1;game.skill();return swapped&&p.skillT===0;})()`));
  check('Stage 20 starts with a full bar, stage 19 does not', await evaluate(`(()=>{game.unlockAll();game.testLevel(19);const early=game.inspect(0).energy;game.testLevel(20);const p=game.inspect(0);return early===0&&p.energy===p.stormMax&&p.stormMax>=1;})()`));
  check('Energy bar refills faster later in the campaign', await evaluate(`(()=>{game.unlockAll();game.testLevel(2);const a=game.inspect(0);a.energy=0;a.stormMax=3;game.tick(2);const early=a.energy;game.testLevel(49);const b=game.inspect(0);b.energy=0;b.stormMax=3;game.tick(2);return b.energy>early*1.5;})()`));
  await evaluate(`game.unlockAll();`);
  check('Campaign has 51 stages: stage 50 is the Rumble, stage 51 the crater', await evaluate(`(()=>{game.setLevel(49);const r=game.last?.();return document.querySelector('#lvName').textContent.includes('50/51')&&document.querySelector('#lvName').textContent.includes('Rumble');})()`));
  await evaluate(`game.setLevel(49);game.closeMapIntro();game.launch();game.endStory();`);
  check('Rumble round 1 is the nine masters by their own names, in a full ring', await evaluate(`(()=>{const t=game.info().tops;return t.length===10&&t.slice(1).every(x=>!/Disciple/.test(x.n))&&new Set(t.slice(1).map(x=>x.n)).size===9&&game.info().state==='battle';})()`));
  await evaluate(`game.tick(150);game.render();game.render();`);
  { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(root, 'dist/polish-rumble.png'), Buffer.from(shot.data, 'base64')); }
  await evaluate(`game.ko();for(let i=0;i<200;i++)game.tick(1);`);
  check('Beating round 1 does not end the stage: the god raises the nine masters', await evaluate(`['interlude','battle'].includes(game.info().state)&&game.info().won===false`));
  await evaluate(`if(game.info().state==='interlude')game.endStory();`);
  await evaluate(`if(game.info().state==='revive'){for(let i=0;i<300;i++)game.tick(1);game.render();}`);
  await evaluate(`if(game.info().state==='revive')window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));`);
  await evaluate(`game.tick(150);game.render();game.render();`);
  { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(root, 'dist/polish-rumble2.png'), Buffer.from(shot.data, 'base64')); }
  check('Round 2 is the nine masters, alive and fighting, with their skills', await evaluate(`(()=>{const t=game.info().tops;return t.length===10&&t.slice(1).filter(x=>x.skill).length>=7&&t.slice(1).every(x=>!/Disciple/.test(x.n));})()`));
  await evaluate(`game.ko();for(let i=0;i<1500;i++)game.tick(1);`);
  check('Beating round 2 wins stage 50 and unlocks the crater', await evaluate(`game.info().won===true&&game.info().state!=='battle'`));
  await evaluate(`game.setLevel(50);game.closeMapIntro();game.launch();game.endStory();`);
  check('Stage 51: the Spin God alone with his skills, one on one, no clones and no Blood Moon', await evaluate(`(()=>{const t=game.info().tops;return t.length===2&&t[1].skill==='god'&&!t.some(x=>/Clone|Blood Moon|Huyết/.test(x.n));})()`));
  check('The god falling starts the rebirth into the Void', await evaluate(`(()=>{game.inspect(1).w=1;for(let i=0;i<60;i++)game.tick(1);return game.info().state==='rebirth';})()`));
  await setup(['iron','vajra']);
  await evaluate(`game.skill();holdTicks(140);document.querySelector('#btnFusion').click();`);
  check('Diamond Fortress takes 40% less skill damage and throws attackers back', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);if(!(p.fortUntil>game.info().t))return false;p.skillT=0;p.active=null;Object.assign(f,{x:p.x+1.2,z:p.z,vx:-8,vz:0,w:100,lastHit:new Map()});const w=f.w;game.rules.collide(p,f);return Math.abs(game.rules.skillImpact(f,p,'fire')-.6)<.001&&f.vx>0&&w-f.w>10;})()`));
  await setup(['iron','vajra']);
  await evaluate(`game.skill();holdTicks(140);document.querySelector('#btnFusion').click();game.tick(40);game.render();game.render();`);
  { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(root, 'dist/polish-fortress.png'), Buffer.from(shot.data, 'base64')); }
  await setup(['ice','moon']);
  await evaluate(`game.skill();holdTicks(140);document.querySelector('#btnFusion').click();`);
  check('Blood Frost opens a red field that drains rivals into you', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);const fl=game.rules.fields().find(x=>x.rime);if(!fl)return false;Object.assign(f,{x:fl.x+1,z:fl.z,vx:0,vz:0,w:100});p.w=50;const w=f.w,pw=p.w;for(let i=0;i<60;i++)game.rules.skillStep();return fl.r===5&&w-f.w>1&&p.w>pw;})()`));
  await setup(['ghost']);
  check('Phantom Form hits back on every rival it slides through', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);game.skill();Object.assign(f,{x:p.x+.5,z:p.z,vx:0,vz:0,w:100});const w=f.w;game.rules.collide(p,f);const first=w-f.w;game.rules.collide(p,f);return first>3&&f.w===w-first;})()`));
  await setup(['ghost','lotus']);
  await evaluate(`game.skill();holdTicks(140);document.querySelector('#btnFusion').click();`);
  await evaluate(`game.tick(45);game.render();game.render();`);
  { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(root, 'dist/polish-phantom.png'), Buffer.from(shot.data, 'base64')); }
  check('Phantom Lotus slips through and hits back harder, draining spin', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);if(!(p.phantomUntil>game.info().t))return false;Object.assign(f,{x:p.x+.5,z:p.z,vx:0,vz:0,w:100});p.w=60;const w=f.w,pw=p.w;game.rules.collide(p,f);return w-f.w>9&&p.w>pw&&game.rules.skillImpact(f,p,'fire')===0;})()`));
  await setup(['ghost','lotus']);
  await evaluate(`game.skill();holdTicks(60);`);
  check('Fusion is not offered before one second has passed', await evaluate(`game.rules.comboOffer(game.inspect(0))===null`));
  await evaluate(`holdTicks(80);`);
  check('Fusion opens about a second after the first cast, while it still runs', await evaluate(`(()=>{game.render();const p=game.inspect(0);return p.skillT>0&&!!game.rules.comboOffer(p)&&!document.querySelector('#btnFusion').disabled;})()`));
  await evaluate(`document.querySelector('#btnFusion').click();`);
  check('Early fusion casts at once and cuts the first skill short', await evaluate(`game.inspect(0).combo==='heal'&&game.inspect(0).active==='lotus'`));
  check('A fused cast cannot chain straight into another fusion', await evaluate(`game.rules.comboOffer(game.inspect(0))===null`));
  await evaluate(`(()=>{const p=game.inspect(0);p.skillT=0;p.energy=3;game.selectSkill(0);game.skill();holdTicks(140);})()`);
  check('Phantom Lotus rests 4 s after its effect ends: no second fusion straight away', await evaluate(`game.rules.comboOffer(game.inspect(0))===null`));
  await setup(['thunder','dash']);
  await evaluate(`game.skill();holdTicks(140);document.querySelector('#btnFusion').click();(()=>{const p=game.inspect(0);p.skillT=0;p.arcUntil=0;p.energy=3;game.selectSkill(0);game.skill();holdTicks(140);})()`);
  check('Every fusion rests 2-4 s after its effect ends, counted from the end of the effect', await evaluate(`(()=>{const p=game.inspect(0),t=game.info().t;const blocked=game.rules.comboOffer(p)===null;p.comboCd.arc=t-2.01;const open=game.rules.comboOffer(p)?.fusion.kind==='arc';p.comboCd.arc=t-1.9;const stillShut=game.rules.comboOffer(p)===null;return blocked&&open&&stillShut;})()`));
  await setup(['ghost','lotus']);
  await evaluate(`game.skill();holdTicks(140);document.querySelector('#btnFusion').click();`);
  await setup(['ghost','lotus']);
  await evaluate(`game.skill();holdTicks(140);document.querySelector('#btnFusion').click();`);
  check('A rival Thunder cast pierces and snaps a Phantom Lotus form', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);if(!(p.phantomUntil>game.info().t))return false;Object.assign(f,{skill:'thunder',energy:2,x:p.x+3,z:p.z,skillT:0,stormT:0,readyAt:0,recoveryUntil:0});for(let i=0;i<40;i++){p.phantomUntil=Math.max(p.phantomUntil,game.info().t+3);game.tick(1);if(p.phantomUntil<=game.info().t)return true;}return p.phantomUntil<=game.info().t;})()`));
  check('The Void god cannot be phased through and pierces the form', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);p.phantomUntil=game.info().t+5;f.voidGod=true;f.x=p.x+.5;f.z=p.z;f.vx=-6;f.lastHit=new Map();p.lastHit=new Map();const k=game.rules.skillImpact(f,p,'fire');game.rules.collide(p,f);const hit=Math.abs(p.vx)+Math.abs(f.vx)>0&&f.vx!==-6;f.voidGod=false;return k>0&&hit;})()`));
  await setup(['ghost','lotus']);
  await evaluate(`game.skill();holdTicks(140);document.activeElement?.blur();`);
  await key('Space');
  check('A second SPACE about a second later triggers the fusion', await evaluate(`game.inspect(0).combo==='heal'&&game.inspect(0).active==='lotus'`));
  await setup(['thunder','dash']);
  await evaluate(`game.skill();holdTicks(140);document.activeElement?.blur();`);
  await key('Space');
  check('Thunder Run: SPACE fusion sends the top along a star path', await evaluate(`(()=>{const p=game.inspect(0);if(p.combo!=='arc'||Math.abs(p.arcUntil-p.arcStart-4)>.001)return false;let far=0;const x0=p.x,z0=p.z;for(let i=0;i<300;i++){game.tick(1);far=Math.max(far,Math.hypot(p.x-x0,p.z-z0));}return far>1.5;})()`));
  await setup(['thunder','dash']);
  await evaluate(`game.skill();holdTicks(760);document.querySelector('#btnFusion').click();`);
  check('Thunder Run: sprint window opens and damage taken is cut by 10%', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);p.skillT=0;p.active=null;return p.combo==='arc'&&p.arcUntil>game.info().t&&Math.abs(game.rules.skillImpact(f,p,'fire')-.9)<.001;})()`));
  check('Thunder Run keeps calling bolts on a nearby rival while running', await evaluate(`(()=>{const p=game.inspect(0),f=game.inspect(1);Object.assign(f,{w:500,x:p.x+3,z:p.z,vx:0,vz:0});const w=f.w;for(let i=0;i<300&&p.arcUntil>game.info().t;i++){f.x=p.x+3;f.z=p.z;f.vx=f.vz=0;game.tick(1);}return w-f.w>8;})()`));
  await evaluate(`game.unlockAll()`);
  await setup(['thunder','dash','fire','storm'], 50);
  check('Final stage opens four slots for two fusion pairs', await evaluate(`game.build.skills.length===4&&document.querySelectorAll('#skillSlots button').length===4`));
  await evaluate(`game.skill();holdTicks(760);document.querySelector('#btnFusion').click();`);
  check('Final stage: first fusion pair works', await evaluate(`game.inspect(0).combo==='arc'`));
  await evaluate(`(()=>{const p=game.inspect(0);p.skillT=0;p.arcUntil=0;p.energy=3;game.selectSkill(2);game.skill();})()`);
  await evaluate(`holdTicks(760);`);
  check('Final stage: second pair is offered independently', await evaluate(`(()=>{const o=game.rules.comboOffer(game.inspect(0));return !!o&&o.fusion.kind==='flare';})()`));
  await evaluate(`document.querySelector('#btnFusion').click();`);
  check('Final stage: second fusion casts the Firestorm', await evaluate(`game.inspect(0).combo==='flare'&&game.inspect(0).stormFuse===true`));
  await setup(['thunder','dash','fire','storm'], 20);
  check('Other stages still use the first two slots and keep the saved four', await evaluate(`game.build.skills.length===4&&document.querySelectorAll('#skillSlots button').length===2`));
  await setup(['thunder','dash']);
  await evaluate(`game.skill();holdTicks(1200)`);
  check('Expired combo window hides the prompt', await evaluate(`game.rules.comboOffer(game.inspect(0))===null&&document.querySelector('#btnFusion').classList.contains('hidden')`));
  await setup(['thunder','lotus']);
  await evaluate(`game.skill();holdTicks(600)`);
  check('Unmatched equipped skills cannot fuse', await evaluate(`game.rules.comboOffer(game.inspect(0))===null&&document.querySelector('#btnFusion').classList.contains('hidden')`));
  // Boss patterns: use physics ticks, keep participants separated so random collisions
  // cannot decide the fight while assertions inspect the state machine.
  await setup(['thunder', 'lotus'], 50);
  await evaluate(`game.info().tops.forEach((_,i)=>{const a=game.inspect(i);if(i)a.skill=i===1?'god':null;if(i>1)a.alive=false;a.w=1000;a.x=i?3:-3;});`);
  check('Phase one does not expose after one cast', await evaluate(`game.inspect(1).energy=1;game.tick(1);game.inspect(1).cycleSkills===1&&game.inspect(1).recoveryUntil===0`));
  await evaluate(`for(let i=0;i<800&&game.inspect(1).recoveryUntil===0;i++){const p=game.inspect(0),g=game.inspect(1);Object.assign(p,{x:-3,z:0,vx:0,vz:0,w:1000});Object.assign(g,{x:3,z:0,vx:0,vz:0,w:1000});game.tick(1);}`);
  check('Phase one exposes for 3 s after two skills', await evaluate(`game.inspect(1).cycleSkills===0&&game.inspect(1).recoveryUntil>game.info().t && document.querySelector('#bossCycle').textContent.includes('EXPOSED')`), await evaluate(`JSON.stringify({state:game.info(),cycle:game.inspect(1).cycleSkills,recovery:game.inspect(1).recoveryUntil})`));
  await evaluate(`game.phase2();game.eulerPass(true);game.inspect(0).yOff=0;game.inspect(0).w=5000;game.inspect(1).w=5000;`);
  const bossLog = await evaluate(`(()=>{
    const log=[], skills=[];let prev=0,answered=false;
    for(let i=0;i<18000;i++){
      const p=game.inspect(0),g=game.inspect(1);p.w=5000;p.x=-3;p.z=0;g.x=3;g.z=0;p.vx=p.vz=g.vx=g.vz=0;
      const before=g.godI;game.tick(1);if(g.godI!==before)skills.push(g.lastCast);
      const s=game.ts();if(s&&!prev){log.push({casts:g.cycleSkills,t:game.info().t});answered=false;}
      if(s&&s.free===null&&s.qte&&s.mark>=(s.qte[0]+s.qte[1])*.5&&!answered){game.press();answered=true;}
      prev=!!s;if(game.comboT()!==null)return {log,skills,combo:true,time:game.info().t};
      if(!p.alive)return {log,skills,dead:true};
    }return {log,skills,timeout:true,state:game.info(),ts:game.ts()};
  })()`);
  check('Void: four time stops, each gated by two completed skills', bossLog.combo && bossLog.log.length === 4 && bossLog.log.every(x => x.casts === 2), JSON.stringify(bossLog));
  check('Void uses varied skills and longer pacing', new Set(bossLog.skills).size >= 8 && bossLog.time > 45, JSON.stringify(bossLog));
  check('Final dragon sequence completes with victory', await evaluate(`(()=>{for(let i=0;i<2400&&game.info().state!=='result';i++)game.tick(1);return game.info().state==='result'&&game.info().won;})()`));
  const balanceSamples = await evaluate(`(()=>{const out=[];for(const [skill,level] of [['storm',19],['thunder',29],['lotus',44],['dash',39],['fire',9],['iron',14],['ghost',34],['vajra',14],['ice',24],['moon',34]])out.push({level:level+1,skill,result:game.sim({m:1.6,r:.6,grip:.45,skill,fx:'(ex-x)*4-vx*.5',fz:'(ez-z)*4-vz*.5'},level,3,true)});return out;})()`);
  console.log('Balance samples: ' + JSON.stringify(balanceSamples));
  // Capture the same game UI at phone size; also check no horizontal overflow.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await setup(['dash','ghost']);
  await evaluate(`game.boost(1);game.selectSkill(1);game.skill();for(let i=0;i<100;i++)game.tick(0);game.render();`);
  const mobileShot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(root, 'dist/polish-mobile.png'), Buffer.from(mobileShot.data, 'base64'));
  check('Mobile slots fit viewport', await evaluate(`document.querySelector('#skillSlots').getBoundingClientRect().left>=0&&document.querySelector('#skillSlots').getBoundingClientRect().right<=innerWidth`));
  check('Mobile four-slot final-stage bar fits viewport', await evaluate(`(()=>{game.unlockAll();game.build.skills=['thunder','dash','fire','storm'];game.setLevel(50);const s=document.querySelector('#skillSlots');s.classList.remove('hidden');const r=s.getBoundingClientRect(),n=s.children.length;return n===4&&r.left>=0&&r.right<=innerWidth;})()`));
  check('Mobile map title fits viewport', await evaluate(`document.querySelector('#title').scrollWidth<=document.querySelector('#title').clientWidth`));
  check('Mobile cast and view buttons do not overlap', await evaluate(`document.querySelector('#btnStorm').getBoundingClientRect().right<=document.querySelector('#btnView').getBoundingClientRect().left`));
  await setup(['thunder','dash']);
  await evaluate(`game.skill();holdTicks(600);game.render();`);
  const fusionShot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(root, 'dist/polish-combo-mobile.png'), Buffer.from(fusionShot.data, 'base64'));
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const touchTarget = await evaluate(`(()=>{const r=document.querySelector('#btnFusion').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touchTarget, id: 1 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(100);
  check('Mobile touch prompt directly casts the second combo skill', await evaluate(`game.inspect(0).combo==='arc'&&game.inspect(0).skill==='dash'`));
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  check('Courses retain jump controls and no skills', await evaluate(`game.setLevel(51);game.launch();game.boost(1);game.inspect(0).yOff=0;const noSkill=game.inspect(0).skill===null;game.press();game.tick(1);noSkill&&game.inspect(0).yOff>0&&game.inspect(0).energy<.6&&document.querySelector('#skillSlots').classList.contains('hidden')`));
  await evaluate(`game.setLevel(10);document.activeElement?.blur();`);
  await key('F8');
  check('Local F8 jumps straight to current chapter boss', await evaluate(`game.info().level===14&&game.info().state==='battle'`));
  await key('F8', 8);
  check('Local Shift+F8 jumps straight to final boss', await evaluate(`game.info().level===50&&game.info().state==='battle'`));
  check('Debug navigation rejects invalid stages', await evaluate(`game.testLevel(0)===false&&game.testLevel(55)===false&&game.testLevel(NaN)===false&&game.info().level===50`));
  await evaluate(`game.setLevel(10);document.activeElement?.blur();`);
  await key('KeyK');
  check('Local K jumps straight to current chapter boss outside battle', await evaluate(`game.info().level===14&&game.info().state==='battle'`));
  await evaluate(`game.setLevel(10);document.activeElement?.blur();`);
  await key('KeyK', 8);
  check('Local Shift+K jumps straight to final boss', await evaluate(`game.info().level===50&&game.info().state==='battle'`));
  await evaluate(`localStorage.setItem('tops.seen',JSON.stringify({w9:1}))`);
  await navigate('/?debug&final&lang=vi');
  check('Final boss is never labelled as the father, even after the reveal was seen', await evaluate(`(()=>{const n=[];for(let i=0;game.inspect(i);i++)n.push(game.inspect(i).name);return n.length>1&&n.every(s=>!/Cha\\b|Dad/.test(s));})()`));
  await evaluate(`localStorage.setItem('tops.seen','{}')`);
  for(const [query,level] of [['level=25',24],['boss=6',29],['final',50],['level=54',53]]) {
    await navigate('/?debug&'+query+'&lang=en');
    check('Local debug URL '+query, await evaluate(`game.info().level===${level}&&game.info().state==='battle'&&!!document.querySelector('#debugNav')`));
  }
  await navigate('/?debug&void&eq&lang=en');
  check('Local Void shortcut opens phase two with equation', await evaluate(`game.last().void&&game.info().state==='battle'&&game.checkEuler(game.build.euler)`));
  await navigate('/?debug&lang=en&withstory');
  await evaluate(`game.unlockAll();game.setLevel(49);game.closeMapIntro();game.launch();`);
  check('Stage 50 opens with the god meeting scene before round 1', await evaluate(`!document.querySelector('#story').classList.contains('hidden')&&document.querySelector('#storyWho').textContent.length>0`));
  await evaluate(`game.endStory();`);
  await evaluate(`game.ko();for(let i=0;i<200;i++)game.tick(1);`);
  check('Round 1 ends with the god scene, then the revive cut-scene', await evaluate(`!document.querySelector('#story').classList.contains('hidden')&&game.info().state==='interlude'`));
  await evaluate(`game.endStory();for(let i=0;i<330;i++)game.tick(1);game.render();game.render();`);
  check('Revive cut-scene: dread filter on, some souls still underground, some risen', await evaluate(`(()=>{const f=[...Array(10).keys()].slice(1).map(i=>game.inspect(i).yOff);return game.info().state==='revive'&&document.body.classList.contains('dread')&&f.some(y=>y<-3)&&f.some(y=>y>-1);})()`));
  { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(root, 'dist/polish-revive.png'), Buffer.from(shot.data, 'base64')); }
  await evaluate(`for(let i=0;i<500;i++)game.tick(1);`);
  check('Revive cut-scene ends by itself and round 2 begins', await evaluate(`game.info().state==='battle'&&!document.body.classList.contains('dread')&&[...Array(10).keys()].slice(1).every(i=>game.inspect(i).yOff>-1)`));
  await navigate('/?debug&lang=en');
  await evaluate(`game.voidTune({first:.05});game.phase2();window.__g=game.inspect(1);window.__g.w=window.__g.w0*.5;window.__max=window.__g.w;for(let i=0;i<235;i++){if(window.__g.cycleSkills<2)window.__g.cycleSkills=2;window.__g.skillT=0;window.__g.stormT=0;game.tick(1);window.__max=Math.max(window.__max,Math.abs(window.__g.w));}game.render();game.render();`);
  { const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(root, 'dist/polish-void-charge.png'), Buffer.from(shot.data, 'base64')); }
  check('Each time the Void god charges through frozen time it drinks back 20% of its spin', await evaluate(`(()=>{const g=window.__g,w0=g.w0;let max=window.__max;for(let i=0;i<900;i++){if(g.cycleSkills<2)g.cycleSkills=2;g.skillT=0;g.stormT=0;game.tick(1);max=Math.max(max,Math.abs(g.w));}game.voidTune({first:7});return max>w0*.66;})()`));
  await navigate('/?debug&lang=en');
  await evaluate(`game.unlockAll();game.setLevel(50);game.closeMapIntro();game.launch();game.endStory();window.__g=game.inspect(1);window.__g.cycleDone=1;window.__g.cycleSkills=0;window.__g.recoveryUntil=0;window.__g.skillT=0;window.__prot=()=>{const p=game.inspect(0);window.__g.w=window.__g.w0;p.w=p.w0;p.phantomUntil=1e9;p.x=0;p.z=0;p.vx=p.vz=0;};for(let i=0;i<30;i++){window.__prot();game.tick(1);}`);
  check('The Spin God telegraphs a fusion (frozen and open) after the first two-cast cycle', await evaluate(`(()=>{const g=window.__g;return !!g.ult&&!g.ult.fired&&g.recoveryUntil>game.info().t;})()`));
  await evaluate(`for(let i=0;i<200;i++){window.__prot();game.tick(1);}`);
  check('Then the fusion lands (Thunder Run star path, Firestorm, Fortress or Blood Frost)', await evaluate(`(()=>{const g=window.__g,t=game.info().t;return !!g.ult&&g.ult.fired&&(g.arcUntil>t||g.stormFuse||g.fortUntil>t||game.rules.fields().some(f=>f.rime))&&!!g.combo;})()`));
  await evaluate(`for(let i=0;i<900;i++){window.__prot();game.tick(1);}`);
  check('After the fusion the usual exposed window follows and the cycle counter moves on', await evaluate(`(()=>{const g=window.__g;return g.cycleDone>=2&&!g.ult;})()`));
  await navigate('/?debug&lang=en');
  await evaluate(`game.unlockAll();game.setLevel(50);game.closeMapIntro();game.launch();game.endStory();window.__g=game.inspect(1);0;`);
  check('The Spin God cannot be thrown off the early crater even while exposed', await evaluate(`(()=>{const g=window.__g,p=game.inspect(0);g.recoveryUntil=999;p.phantomUntil=1e9;for(let i=0;i<30;i++){Object.assign(g,{x:12,z:0,vx:6,vz:0,w:g.w0});p.x=0;p.z=0;p.vx=p.vz=0;game.tick(1);}return g.alive&&Math.hypot(g.x,g.z)<12;})()`));
  check('...but once his spin is below 30% he can be thrown off', await evaluate(`(()=>{const g=window.__g,p=game.inspect(0);for(let i=0;i<30;i++){Object.assign(g,{x:12,z:0,vx:6,vz:0,w:g.w0*.25});p.x=0;p.z=0;p.vx=p.vz=0;p.w=p.w0;p.phantomUntil=1e9;game.tick(1);if(!g.alive)break;}return !g.alive&&g.why==='ring';})()`));
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: preload.identifier });
  await navigate('/dist/crazygames/index.html?debug&level=25&boss=6&final&video&cover&lang=en');
  check('Generated CrazyGames build has no debug hooks/navigation/capture mode', await evaluate(`!window.game&&!document.querySelector('#debugNav')&&!document.querySelector('canvas[data-cover]')`));
  const cgStage = await evaluate(`document.querySelector('#lvName').textContent`);
  await key('F8'); await key('F8',8);
  check('CrazyGames ignores all local debug keys and URL shortcuts', (await evaluate(`document.querySelector('#lvName').textContent`)) === cgStage);
  await key('Escape'); await key('Space'); await pause(100);
  check('CrazyGames loading lifecycle', await evaluate(`cgEvents.includes('loadingStart')&&cgEvents.includes('loadingStop')`));
  for (let i = 0; i < 4; i++) {
    await evaluate(`if(!document.querySelector('#mapIntro').classList.contains('hidden'))document.querySelector('#mapSkip').click();`);
    await key('Escape');
    await evaluate(`if(!document.querySelector('#shop').classList.contains('hidden'))document.querySelector('#go').click();`);
    await pause(100);
  }
  check('CrazyGames gameplay lifecycle starts after launch', await evaluate(`cgEvents.includes('gameplayStart')`));
  check('CrazyGames settings listener is registered', await evaluate(`typeof cgSettingsListener==='function'`));
  await evaluate(`cgSettingsListener({muteAudio:true});cgSettingsListener({muteAudio:false});`);
  await navigate('http://production.example/?debug&level=25&boss=6&final');
  check('Hosted web build refuses debug mode even with query parameters', await evaluate(`!window.game&&!document.querySelector('#debugNav')`));
  const hostedStage = await evaluate(`document.querySelector('#lvName').textContent`);
  await key('F8'); await key('F8',8);
  check('Hosted web build ignores debug keys', (await evaluate(`document.querySelector('#lvName').textContent`)) === hostedStage);
  await navigate('/?debug&lang=en');
  await evaluate(`localStorage.setItem('tops.campaign','5');localStorage.setItem('tops.build',JSON.stringify({skill:'storm',skills:['storm','thunder']}));`);
  await navigate('/?debug&lang=en');
  check('Unlearned fusion pairs stay locked with boss-unlock labels', await evaluate(`document.querySelectorAll('#comboRecipes button:disabled').length===5&&document.querySelector('#comboRecipes').textContent.includes('Unlock after stage')`));
  // Startup without an SDK remains playable in the standard web build.
  await navigate('/?lang=en');
  check('Normal local URL does not expose debug navigation', await evaluate(`!window.game&&!document.querySelector('#debugNav')`));
  for(let i=0;i<4;i++){await key('Escape');await evaluate(`if(!document.querySelector('#shop').classList.contains('hidden'))document.querySelector('#go').click();`);}
  check('Normal web build starts battle without SDK', await evaluate(`!document.querySelector('#btnStorm').classList.contains('hidden')`));
  check('No browser console/page/network errors', errors.length === 0, JSON.stringify(errors));
  await writeFile(join(root, 'dist/polish-test-results.json'), JSON.stringify({ passed: results.length, results, bossLog, balanceSamples, errors }, null, 2));
  console.log(`${results.length} checks passed. Screenshots/report in dist/.`);
  await send('Browser.close');
} finally {
  socket?.close(); chrome.kill(); server.close();
  await pause(300);
  if (dirname(work) !== resolve(tmpdir()) || !basename(work).startsWith('spin-polish-')) throw new Error('Unsafe temporary directory');
  await rm(work, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
}
