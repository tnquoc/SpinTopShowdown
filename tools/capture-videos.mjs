// Node 22+; dependency-free CDP capture of real gameplay. Requires the root server on :5173.
// node tools/capture-videos.mjs [--preview|--check-only] [--landscape|--portrait] [--keep-frames]
// CHROME, FFMPEG, FFPROBE and GAME_URL can override the local defaults.
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = await mkdtemp(join(tmpdir(), 'spin-videos-'));
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ffmpeg = process.env.FFMPEG || 'C:/ffmpeg/bin/ffmpeg.exe';
const ffprobe = process.env.FFPROBE || join(dirname(ffmpeg), 'ffprobe.exe');
const base = process.env.GAME_URL || 'http://localhost:5173/';
const preview = process.argv.includes('--preview');
const checkOnly = process.argv.includes('--check-only');
const pause = ms => new Promise(r => setTimeout(r, ms));
const browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-background-timer-throttling', '--remote-debugging-port=0',
  `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const clips = [
  { name: 'Boss clash', level: 4, framing: { zoom: .82 }, setup: `game.video.place([{x:-.8,z:0,vx:7,vz:0},{x:.8,z:0,vx:-7,vz:0},{x:0,z:-3,vx:1,vz:4}]); game.video.clash();`, warm: 5 },
  { name: 'Tornado', level: 7, framing: { zoom: .95, height: 2.7 }, setup: `game.video.place([{x:0,z:1,vx:0,vz:0},{x:2,z:0,vx:-2,vz:1},{x:-2,z:-1,vx:3,vz:1}]); game.boost(3); game.storm();`, warm: 28 },
  { name: 'Iron Wok ring-out', level: 18, framing: { zoom: 1 }, setup: `game.video.place([{x:4.8,z:0,vx:10,vz:0},{x:6.1,z:0,vx:0,vz:0},{x:0,z:-1,vx:3,vz:3},{x:-2,z:-1,vx:3,vz:0}]); game.video.clash();`, warm: 4 },
  { name: 'Blood Moon Demon King', level: 44, framing: { zoom: .93 }, setup: `game.video.place([{x:-1,z:1.5,vx:2,vz:-2},{x:1,z:0,vx:-1,vz:2},{x:-2,z:-2,vx:2,vz:2},{x:3,z:-2,vx:-2,vz:2}]); game.video.skill(1);`, warm: 16 },
  { name: 'Raging Fire Dragon', level: 19, framing: { zoom: .85 }, setup: `game.video.place([{x:-.8,z:0,vx:6,vz:1},{x:.8,z:0,vx:-6,vz:-1},{x:0,z:-3,vx:2,vz:4},{x:3,z:-2,vx:-2,vz:2}]); game.video.skill(1); game.video.clash();`, warm: 5 },
  { name: 'Golden dragon dive and impact', level: 49, framing: {}, setup: `game.video.dragon();`, warm: 840 },
];
try {
  let port;
  for (let i = 0; i < 150; i++) {
    try { port = Number((await readFile(join(work, 'profile/DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await pause(100); }
  }
  if (!port) throw new Error('Chromium did not start');
  const pages = await (await fetch(`http://localhost:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
  let seq = 0;
  const pending = new Map(), errors = [];
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`CDP timeout: ${method}`)); }, 120000);
    pending.set(id, { ok, fail, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const three = (await readFile(join(root, 'vendor/three.module.js'))).toString('base64');
  const crazyHtml = (await readFile(join(root, 'index.html'), 'utf8')).replace("const BUILD = 'web';", "const BUILD = 'crazygames';");
  socket.onmessage = async ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id); if (!p) return; pending.delete(m.id); clearTimeout(p.timer);
      m.error ? p.fail(new Error(JSON.stringify(m.error))) : p.ok(m.result);
    } else if (m.method === 'Fetch.requestPaused') {
      const isBuildCheck = m.params.request.url.includes('capture-crazygames-check');
      await send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: isBuildCheck ? 'text/html' : 'text/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: isBuildCheck ? Buffer.from(crazyHtml).toString('base64') : three });
    } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
  };
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    if (errors.length) throw new Error(JSON.stringify(errors));
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `let captureSeed = 731; Math.random = () => { captureSeed = (Math.imul(captureSeed, 1664525) + 1013904223) >>> 0; return captureSeed / 4294967296; };` });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://cdn.jsdelivr.net/npm/three@*/build/three.module.js' }, { urlPattern: '*capture-crazygames-check*' }] });
  const out = join(root, 'store', 'shared'), review = join(root, 'reports', 'capture'); await mkdir(out, { recursive: true }); await mkdir(review, { recursive: true });
  const sizes = [ ['landscape', 1920, 1080], ['portrait', 1080, 1920] ].filter(([name]) =>
    !process.argv.includes('--landscape') && !process.argv.includes('--portrait') || process.argv.includes(`--${name}`));
  const manifest = [];
  for (const [name, width, height] of checkOnly ? [] : sizes) {
    const frames = join(work, name); await mkdir(frames);
    const samples = join(work, `${name}-samples`); await mkdir(samples);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    for (const [ci, clip] of clips.entries()) {
      errors.length = 0;
      await send('Page.navigate', { url: `${base}?debug&video&lang=en` });
      let ready = false;
      for (let i = 0; i < 200; i++) {
        await pause(100);
        if (await evaluate('!!window.game?.video')) { ready = true; break; }
      }
      if (!ready) throw new Error('Video debug hooks did not load');
      await evaluate(`game.video.stage(${clip.level},${JSON.stringify(clip.framing)}); ${clip.setup} game.video.frame(${clip.warm},false); game.video.snap(); game.video.frame(1);`);
      console.log(`${name}: ${ci + 1}/6 ${clip.name}`);
      let state;
      for (let f = 0; f < 90; f++) {
        if (f) state = await evaluate(`game.video.frame(2,${!preview || [0, 30, 75].includes(f)})`);
        if (state && !['battle', 'ending', 'combo'].includes(state.state)) throw new Error(`Unexpected game state: ${JSON.stringify(state)}`);
        if (preview && ![0, 30, 75].includes(f)) continue;
        const capture = await send('Page.captureScreenshot', { format: 'jpeg', quality: 95, captureBeyondViewport: false, fromSurface: true });
        const bytes = Buffer.from(capture.data, 'base64');
        const path = join(frames, `${String(ci * 90 + f).padStart(5, '0')}.jpg`);
        await writeFile(path, bytes);
        if ([0, 30, 75].includes(f)) await writeFile(join(samples, `${ci}-${f}.jpg`), bytes);
        if (f === 45) console.log(`  ${name} ${ci + 1}/6 halfway`);
      }
      console.log(`  end: ${JSON.stringify(state)}`);
    }
    if (preview) {
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-pattern_type', 'sequence', '-i', join(samples, '%d-0.jpg'),
        '-vf', `scale=${width > height ? 640 : 270}:-1,tile=3x2`, '-frames:v', '1', join(review, `video-${name}-preview.jpg`)], { windowsHide: true });
      continue;
    }
    const path = join(out, `video-${name}.mp4`);
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(frames, '%05d.jpg'),
      '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '6M', '-bufsize', '12M',
      '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', path], { windowsHide: true });
    const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { encoding: 'utf8', windowsHide: true }));
    const s = probe.streams[0], bytes = (await stat(path)).size;
    if (probe.streams.length !== 1 || s.codec_name !== 'h264' || s.pix_fmt !== 'yuv420p' || s.width !== width || s.height !== height ||
      s.avg_frame_rate !== '30/1' || +probe.format.duration !== 18 || bytes >= 15000000) throw new Error(`Video verification failed: ${JSON.stringify(probe)}`);
    const result = { file: path, duration: +probe.format.duration, bytes, width, height, fps: s.avg_frame_rate, codec: s.codec_name, pix_fmt: s.pix_fmt,
      audioStreams: probe.streams.filter(s => s.codec_type === 'audio').length, clips: clips.map(c => c.name) };
    manifest.push(result); console.log(JSON.stringify(result));
    // These frames come from the encoded deliverable, for visual review.
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', path, '-vf', `fps=1,scale=${width > height ? 480 : 240}:-1,tile=${width > height ? '3x6' : '6x3'}`,
      '-frames:v', '1', join(review, `video-${name}-review.jpg`)], { windowsHide: true });
  }
  // Ensure the capture gate cannot affect either normal play or the CrazyGames build.
  for (const query of ['?lang=en', '?video&lang=en', '?debug&video&capture-crazygames-check&lang=en']) {
    errors.length = 0;
    await send('Page.navigate', { url: `${base}${query}` });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      await pause(100);
      if (await evaluate('!!document.querySelector("canvas") && document.querySelector("#roster").children.length > 0 && !window.game?.video && getComputedStyle(document.querySelector("#shop")).display !== "none"')) { ready = true; break; }
    }
    if (!ready) throw new Error(`Normal startup failed: ${query}`);
    console.log(`Capture gate verified: ${query}`);
  }
  if (!preview && !checkOnly) await writeFile(join(review, 'video-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await send('Browser.close');
} finally {
  socket?.close(); browser.kill(); await pause(500);
  if (dirname(work) !== resolve(tmpdir()) || !basename(work).startsWith('spin-videos-')) throw new Error('Unexpected temp directory');
  if (!preview && !process.argv.includes('--keep-frames')) await rm(work, { recursive: true, force: true, maxRetries: 5 });
  else console.log(`Capture files: ${work}`);
}
