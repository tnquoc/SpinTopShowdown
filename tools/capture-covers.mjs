// Dependency-free Chromium capture; uses the vendored Three.js for offline rendering.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'spin-cover-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9224', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(r => setTimeout(r, ms));
let socket;
try {
  let pages;
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch('http://localhost:9224/json/list')).json(); break; }
    catch { await pause(100); }
  }
  if (!pages) throw new Error('Chromium did not start');
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; });
  let seq = 0;
  const pending = new Map(), errors = [];
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++seq; pending.set(id, { ok, fail }); socket.send(JSON.stringify({ id, method, params }));
  });
  const three = (await readFile(join(root, 'vendor/three.module.js'))).toString('base64');
  socket.onmessage = async ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.fail(new Error(JSON.stringify(m.error))) : p.ok(m.result);
    } else if (m.method === 'Fetch.requestPaused') {
      await send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: three });
    } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://cdn.jsdelivr.net/npm/three@*/build/three.module.js' }] });
  await mkdir(join(root, 'store', 'shared'), { recursive: true });
  const sizes = process.argv.slice(2).length ? process.argv.slice(2) : ['1920x1080', '800x1200', '800x800'];
  for (const size of sizes) {
    const [width, height] = size.split('x').map(Number);
    errors.length = 0;
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:5173/?debug&cover&lang=en' });
    let ready = false;
    for (let i = 0; i < 150; i++) {
      await pause(100);
      if (errors.length) throw new Error(JSON.stringify(errors));
      const r = await send('Runtime.evaluate', { expression: 'document.documentElement.dataset.coverReady === "true"', returnByValue: true });
      if (r.result.value) { ready = true; break; }
    }
    if (!ready) throw new Error(`Cover scene did not become ready: ${size}`);
    await pause(500);
    const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
    const path = resolve(root, `store/shared/cover-${size}.png`);
    const bytes = Buffer.from(png.data, 'base64');
    if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) throw new Error(`Incorrect PNG dimensions: ${size}`);
    await writeFile(path, bytes);
    console.log(path);
  }
  // Verify that the normal game still starts, including when cover lacks debug.
  for (const query of ['?lang=en', '?debug&lang=en', '?cover&lang=en']) {
    errors.length = 0;
    await send('Page.navigate', { url: `http://localhost:5173/${query}` });
    let normal = false;
    for (let i = 0; i < 100; i++) {
      await pause(100);
      if (errors.length) throw new Error(JSON.stringify(errors));
      const r = await send('Runtime.evaluate', { expression: '!!document.querySelector("canvas") && document.querySelector("#roster").children.length > 0 && !document.querySelector("canvas[data-cover]")', returnByValue: true });
      if (r.result.value) { normal = true; break; }
    }
    if (!normal) throw new Error(`Normal game did not start: ${query}`);
    console.log(`Normal startup verified: ${query}`);
  }
  await send('Browser.close');
} finally {
  socket?.close(); browser.kill();
  await pause(500);
  if (dirname(profile) !== resolve(tmpdir()) || !basename(profile).startsWith('spin-cover-')) throw new Error('Unexpected browser profile path');
  await rm(profile, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
}
