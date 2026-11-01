import { readFile, writeFile, mkdir, rm, cp, stat, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// One submission folder per portal: node tools/build.mjs [itch|crazygames|gamemonetize ...] (no argument: all of them).
// dist/<portal>/ holds spin-top-<portal>.zip (upload this), game/ (the unzipped build, for a local check)
// and every store asset that portal asks for: store/shared/ plus store/<portal>/.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist'), store = join(root, 'store');

// GameMonetize: the game already speaks the CrazyGames SDK interface (init, gameplay events, settings, requestAd),
// so instead of a second integration this injects a small adapter that serves that interface from GameMonetize's SDK:
// SDK_GAME_PAUSE / SDK_GAME_START mute and unmute through the settings listener and drive the midgame ad callbacks.
// Ads only ever show from nextResult(), i.e. after a battle, never on a timer mid-play.
// GM_GAME_ID overrides the game ID from the GameMonetize dashboard.
const GM_GAME_ID = process.env.GM_GAME_ID || 'g9sv3kos0hloibq30lo6uomt22kt92x6';
const gmAdapter = id => `<script>
(() => {
  const noop = () => {};
  let ad = null, onSettings = null, timer = 0;
  const mute = muteAudio => { try { if (onSettings) onSettings({ muteAudio }); } catch (e) {} };
  const end = name => { clearTimeout(timer); const a = ad; ad = null; if (a && a[name]) a[name](); };
  window.SDK_OPTIONS = {
    gameId: '${id}',
    onEvent(e) {
      if (e.name === 'SDK_GAME_PAUSE') { mute(true); clearTimeout(timer); if (ad && ad.adStarted) ad.adStarted(); }
      else if (e.name === 'SDK_GAME_START') { mute(false); end('adFinished'); }
    },
  };
  window.CrazyGames = { SDK: {
    init: async () => {},
    game: { settings: { muteAudio: false }, loadingStart: noop, loadingStop: noop, gameplayStart: noop, gameplayStop: noop,
      happytime: noop, addSettingsChangeListener: fn => { onSettings = fn; } },
    ad: { requestAd: (type, callbacks) => {
      if (typeof sdk === 'undefined' || typeof sdk.showBanner !== 'function') { if (callbacks.adError) callbacks.adError(); return; }
      ad = callbacks;
      timer = setTimeout(() => end('adError'), 3000);   // no ad started: carry on rather than hang on the result screen
      try { sdk.showBanner(); } catch (e) { end('adError'); }
    } },
  } };
})();
</script>
</head>`;

// Each portal edits the shared production HTML through replaceOnce.
const PORTALS = {
  // self-contained (local Three.js, sounds), no SDK
  itch: () => {},
  crazygames: replaceOnce => {
    replaceOnce("const BUILD = 'web';", "const BUILD = 'crazygames';");
    replaceOnce('</head>', '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n</head>');
  },
  gamemonetize: replaceOnce => {
    if (!/^[a-z0-9]{32}$/.test(GM_GAME_ID)) throw new Error(`Unexpected GameMonetize game ID: ${GM_GAME_ID}`);
    replaceOnce("const BUILD = 'web';", "const BUILD = 'gamemonetize';");
    replaceOnce('</head>', gmAdapter(GM_GAME_ID));
    // The SDK reads document.body as soon as it runs, so it loads at the end of the body, not in the head.
    replaceOnce('</body>', '<script src="https://api.gamemonetize.com/sdk.js" id="gamemonetize-sdk"></script>\n</body>');
    // First ad after the first finished battle (so Verify Game can see one quickly), then at most every 2 minutes.
    replaceOnce('cgBattles = 0, cgLastAd = performance.now(), cgGain', 'cgBattles = 0, cgLastAd = -Infinity, cgGain');
    replaceOnce('cgBattles < 2 || performance.now() - cgLastAd < 180000', 'cgBattles < 1 || performance.now() - cgLastAd < 120000');
  },
};

const names = process.argv.slice(2);
for (const name of names) if (!PORTALS[name]) throw new Error(`Unknown portal "${name}". Use: ${Object.keys(PORTALS).join(', ')}`);

const source = await readFile(join(root, 'index.html'), 'utf8');
await stat(join(root, 'vendor', 'three.module.js'));
await stat(join(root, 'sounds'));

for (const name of names.length ? names : Object.keys(PORTALS)) {
  let html = source;
  const replaceOnce = (from, to) => {
    if (html.split(from).length !== 2) throw new Error(`${name}: expected exactly one match: ${from}`);
    html = html.replace(from, () => to);
  };
  replaceOnce('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', './three.module.js');
  PORTALS[name](replaceOnce);
  // Remove local test navigation itself, not just its runtime gate.
  const debugRegions = html.match(/\/\/ DEBUG NAV BEGIN[\s\S]*?\/\/ DEBUG NAV END\r?\n/g) || [];
  if (debugRegions.length !== 2) throw new Error('Expected both local debug navigation regions');
  html = html.replace(/\/\/ DEBUG NAV BEGIN[\s\S]*?\/\/ DEBUG NAV END\r?\n/g, '');
  if (/game\.testLevel|debugNav|debugLevel|params\.get\('(?:level|boss)'\)|code !== 'F8'/.test(html)) throw new Error('Local debug navigation leaked into production');

  // Only clear the generated portal directory.
  const out = join(dist, name), game = join(out, 'game'), zip = join(out, `spin-top-${name}.zip`);
  if (dirname(out) !== dist || !out.startsWith(root + '\\') && !out.startsWith(root + '/'))
    throw new Error(`Unsafe build directory: ${out}`);
  await rm(out, { recursive: true, force: true });
  await mkdir(game, { recursive: true });
  await writeFile(join(game, 'index.html'), html);
  await cp(join(root, 'vendor', 'three.module.js'), join(game, 'three.module.js'));
  await cp(join(root, 'sounds'), join(game, 'sounds'), { recursive: true });
  for (const dir of [join(store, 'shared'), join(store, name)]) {
    const entries = await readdir(dir).catch(() => []);
    for (const entry of entries) await cp(join(dir, entry), join(out, entry), { recursive: true });
  }

  if (process.platform === 'win32') {
    const psQuote = s => "'" + s.replaceAll("'", "''") + "'";
    // Compress-Archive on Windows PowerShell 5.1 writes backslash paths; rewrite entries with forward slashes.
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
      $ErrorActionPreference = 'Stop'
      Compress-Archive -Path .\\* -DestinationPath ${psQuote(zip)} -Force
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      $archive = [IO.Compression.ZipFile]::Open(${psQuote(zip)}, 'Update')
      try {
        foreach ($entry in @($archive.Entries)) {
          if (!$entry.FullName.Contains('\\')) { continue }
          $name = $entry.FullName.Replace('\\', '/')
          $buffer = [IO.MemoryStream]::new()
          $stream = $entry.Open()
          try { $stream.CopyTo($buffer) } finally { $stream.Dispose() }
          $entry.Delete()
          $target = $archive.CreateEntry($name).Open()
          try { $buffer.Position = 0; $buffer.CopyTo($target) }
          finally { $target.Dispose(); $buffer.Dispose() }
        }
      } finally { $archive.Dispose() }
    `], { cwd: game, stdio: 'inherit' });
  } else {
    execFileSync('tar', ['-a', '-cf', zip, 'index.html', 'three.module.js', 'sounds'], { cwd: game, stdio: 'inherit' });
  }
  const archive = await readFile(zip);
  if (archive.readUInt32LE(0) !== 0x04034b50) throw new Error('Archive is not a real ZIP (tar must support ZIP output).');
  console.log(`Built ${zip} (${archive.length} bytes)${name === 'gamemonetize' ? `, game ID ${GM_GAME_ID}` : ''}`);
}
