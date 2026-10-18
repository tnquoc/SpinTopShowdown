import { readFile, writeFile, mkdir, rm, cp, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist'), out = join(dist, 'crazygames');
const zip = join(dist, 'spin-top-crazygames.zip');
let html = await readFile(join(root, 'index.html'), 'utf8');
function replaceOnce(from, to) {
  if (html.split(from).length !== 2) throw new Error(`Expected exactly one match: ${from}`);
  html = html.replace(from, () => to);
}
replaceOnce('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', './three.module.js');
replaceOnce("const BUILD = 'web';", "const BUILD = 'crazygames';");
replaceOnce('</head>', '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n</head>');
// Remove local test navigation itself, not just its runtime gate.
const debugRegions = html.match(/\/\/ DEBUG NAV BEGIN[\s\S]*?\/\/ DEBUG NAV END\r?\n/g) || [];
if (debugRegions.length !== 2) throw new Error('Expected both local debug navigation regions');
html = html.replace(/\/\/ DEBUG NAV BEGIN[\s\S]*?\/\/ DEBUG NAV END\r?\n/g, '');
if (/game\.testLevel|debugNav|debugLevel|params\.get\('(?:level|boss)'\)|code !== 'F8'/.test(html)) throw new Error('Local debug navigation leaked into production');
await stat(join(root, 'vendor', 'three.module.js'));
await stat(join(root, 'sounds'));

// Only clear the generated build directory.
if (dirname(out) !== dist || !out.startsWith(root + '\\') && !out.startsWith(root + '/'))
  throw new Error(`Unsafe build directory: ${out}`);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await writeFile(join(out, 'index.html'), html);
await cp(join(root, 'vendor', 'three.module.js'), join(out, 'three.module.js'));
await cp(join(root, 'sounds'), join(out, 'sounds'), { recursive: true });

if (process.platform === 'win32') {
  const psQuote = s => "'" + s.replaceAll("'", "''") + "'";
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
  `], { cwd: out, stdio: 'inherit' });
} else {
  execFileSync('tar', ['-a', '-cf', zip, 'index.html', 'three.module.js', 'sounds'], { cwd: out, stdio: 'inherit' });
}
const archive = await readFile(zip);
if (archive.readUInt32LE(0) !== 0x04034b50) throw new Error('Archive is not a real ZIP (tar must support ZIP output).');
console.log(`Built ${zip} (${archive.length} bytes)`);
