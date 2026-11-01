// Node 22+, Chrome and FFmpeg. No npm dependencies, no changes to the game source.
// node tools/capture-trailer.mjs [--preview|--audio-check] [--landscape|--portrait] [--keep-frames]
// CHROME, FFMPEG, FFPROBE and GAME_URL override the defaults. Starts a private local
// server if GAME_URL is absent. All intermediate files live in the OS temp folder.
// Partial refresh: --landscape --reuse-frames=TEMP/landscape --shots=arc,flare
// Keeps all other source frames and copies the existing MP4's audio without re-encoding.
// Re-edit approved footage: --landscape --recut-frames=TEMP/landscape
// Copies retained shots by name and the original end card from cached JPEGs;
// synthesises a fresh continuous score with SFX at the shortened edit points.
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const root = fileURLToPath(new URL('../', import.meta.url));
const work = await mkdtemp(join(tmpdir(), 'spin-trailer-'));
const out = join(root, 'store', 'shared'), review = join(root, 'reports', 'capture');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ffmpeg = process.env.FFMPEG || 'C:/ffmpeg/bin/ffmpeg.exe';
const ffprobe = process.env.FFPROBE || join(dirname(ffmpeg), 'ffprobe.exe');
const preview = process.argv.includes('--preview');
const audioCheck = process.argv.includes('--audio-check');
const reuseFrames = process.argv.find(a=>a.startsWith('--reuse-frames='))?.slice(15);
const recutFrames = process.argv.find(a=>a.startsWith('--recut-frames='))?.slice(15);
const inputFrames = reuseFrames || recutFrames;
const selectedShots = process.argv.find(a=>a.startsWith('--shots='))?.slice(8).split(',');
if(inputFrames && preview || recutFrames && (reuseFrames || selectedShots))throw new Error('Recut, preview and partial refresh are separate modes');
if(inputFrames && (!resolve(inputFrames).startsWith(resolve(tmpdir())+ '\\') && !resolve(inputFrames).startsWith(resolve(tmpdir())+'/') || !process.argv.includes('--landscape') && !process.argv.includes('--portrait'))) throw new Error('Reuse/recut requires a temp frame directory and one orientation');
const pause = ms => new Promise(r => setTimeout(r, ms));
const run = (exe, args) => execFileSync(exe, args, { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
for (const exe of [chrome, ffmpeg, ffprobe]) await stat(exe);
const source = await readFile(join(root, 'index.html'), 'utf8');

// These hooks are inserted ONLY in the intercepted localhost capture response.
// The source index.html and the distributable game are never written or modified.
const hooks = `
if (DEBUG && params.has('video') && params.has('trailer')) {
  document.head.insertAdjacentHTML('beforeend', '<style>body>*:not(canvas){display:none!important}canvas{filter:none!important}</style>');
  game.trailer = {
    prepare(kind, framing, arena = null) {
      voiceOn = false; musicOn = false;
      game.video.stage(arena ?? (kind === 'rumble' ? 49 : kind === 'crater' || kind === 'void' || kind === 'equation' || kind === 'dragon' ? 50 : 24), framing);
      closeMapIntro(); endStory(); cine = null;
      tops.forEach((a,i) => { a.x = i === 0 ? -1.1 : i === 1 ? 1.1 : Math.cos(i*2)*3.8; a.z = i<2 ? 0 : Math.sin(i*2)*3.8; a.vx = i===0 ? 4 : -2; a.vz=0; a.yOff=0; a.vy=0; });
      if(kind === 'rumble') reviveBegin();
      if(kind === 'crater') { simT=27; tops.forEach(a=>{a.x=a.isPlayer?-1.5:1.5;a.z=0;}); }
      if(kind === 'void' || kind === 'equation') {
        enterVoid(); beginPhase2();
        tops.forEach((a,i)=>{a.x=i ? 2 : -2;a.z=0;a.yOff=0;a.vy=0;});
        eulerOverride=true; startTimeStop(tops.find(a=>a.voidGod));
        if(kind === 'equation') { tstop.t=.9; qteDecide(tstop,true); }
      }
      if(kind === 'dragon') game.video.dragon();
      return game.info();
    },
    cast(id) { build.skills=[id]; build.skill=player.skill=id; player.energy=3; player.stormMax=3; player.readyAt=player.restAt=player.recoveryUntil=0; castSkill(player); },
    fuse(kind) {
      const f=FUSIONS.find(f=>f.kind===kind); build.skills=[...f.ids];
      build.skill=player.skill=f.ids[0]; player.energy=3; player.stormMax=3;
      player.readyAt=player.restAt=player.recoveryUntil=0;
      castSkill(player); game.tick(144);
      player.energy=3; player.readyAt=player.recoveryUntil=0;
      if(!castFusion() || player.combo!==kind) throw new Error('Fusion failed: '+kind+' '+JSON.stringify({t:simT,offer:comboOffer(player),last:player.lastCast,ready:player.readyAt,recovery:player.recoveryUntil}));
      return player.combo;
    },
    frame(count, shot, u) {
      const info=game.video.frame(count,false);
      if(!shot.natural) {
        const p=innerHeight>innerWidth, a=tops[0], b=tops[1];
        const x=shot.center ? 0 : (a.x+(b?.x||0))*.5, z=shot.center ? 0 : (a.z+(b?.z||0))*.5;
        const baseRadius=p?Math.max(13,shot.radius||10):shot.radius||10;
        const angle=(shot.angle||0)+u*(shot.orbit||.2), r=baseRadius*(p?.85:1)*(1-u*.06);
        const y=p?Math.max(12,baseRadius*1.45):shot.y||5.5;
        camera.position.set(x+Math.sin(angle)*r,y,z+Math.cos(angle)*r);
        camera.fov=p?57:49; camera.updateProjectionMatrix(); camera.lookAt(x,shot.lookY||.8,z);
      }
      // The sky vortex is an edge-on billboard in the final tracking shot.
      // Hide that one VFX layer for capture; retain the real dragon, rider and impact.
      if(shot.natural && combo) combo.vortex.visible=false;
      shake=0; renderer.render(scene,camera); return {...info, t:simT, combo:player.combo, ts:game.ts()};
    },
    async soundtrack(duration, events) {
      // Reuse the game's actual tone/noise synthesiser in an offline audio context.
      // A new sparse minor score is arranged here; no recordings or external music.
      if(ac) await ac.close();
      // Both aspect ratios use the same arrangement and seeded noise.
      let scoreSeed=98245;Math.random=()=>{scoreSeed=(Math.imul(scoreSeed,1664525)+1013904223)>>>0;return scoreSeed/4294967296;};
      const offline=new OfflineAudioContext(2,Math.ceil(duration*48000),48000); let cursor=0;
      ac=new Proxy(offline,{get(t,k){if(k==='currentTime')return cursor; const v=t[k];return typeof v==='function'?v.bind(t):v;}});
      const comp=ac.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=5;comp.connect(ac.destination);
      master=ac.createGain();master.gain.value=.48;master.connect(comp);
      musicGain=ac.createGain();musicGain.gain.value=.30;musicGain.connect(comp);
      noiseBuf=ac.createBuffer(1,96000,48000);const nd=noiseBuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
      // Seven complete bars lead into the Rumble downbeat. Nothing is spliced:
      // pads and percussion share one continuous audio clock across every cut.
      const titleAt=duration-3.5, riseAt=events.find(e=>e.name==='Nine masters rise').at;
      const beatLength=riseAt/28, barLength=beatLength*4;
      for(let bar=0;bar*barLength<titleAt;bar++) {
        const at=bar*barLength, root=[55,55,43.654,48.999][Math.floor(bar/2)%4];
        for(const f of [root,root*2,root*2.3784,root*3]) mTone('triangle',f,at,Math.min(2.6,titleAt-at+.65),.15,950);
        for(let beat=0;beat<4;beat++) {
          const t=at+beat*beatLength;if(t>=titleAt)continue;
          mTone('sine',100,t,.30,.9,0,32);
          if(bar>=3) mNoise(t,.15,'lowpass',200,.42);
          if(bar>=5) for(let s=0;s<2;s++)if(t+s*beatLength/2<titleAt)mTone('triangle',root*4*[1,1.5,1.1892,2][(beat+s)%4],t+s*beatLength/2,.18,.12,1500);
        }
      }
      for(const e of events){cursor=e.at;Object.keys(lastPlayed).forEach(k=>lastPlayed[k]=-999999);sfx[e.sfx]?.(1);}
      cursor=riseAt;sfx.boom();
      cursor=titleAt;sfx.boom();[55,110,130.81,164.81].forEach(f=>mTone('triangle',f,titleAt,3.4,.24,1000));
      const buffer=await offline.startRendering();
      const bytes=new Uint8Array(44+buffer.length*4),v=new DataView(bytes.buffer);const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
      str(0,'RIFF');v.setUint32(4,bytes.length-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,48000,true);v.setUint32(28,192000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,bytes.length-44,true);
      for(let i=0;i<buffer.length;i++)for(let c=0;c<2;c++)v.setInt16(44+i*4+c*2,Math.max(-1,Math.min(1,buffer.getChannelData(c)[i]))*32767,true);
      let encoded='';for(let i=0;i<bytes.length;i+=32768)encoded+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(encoded);
    }
  };
}
`;
const marker = '// Frozen promotional scene: web debug only; never entered by the CrazyGames build.';
if (source.split(marker).length !== 2) throw new Error('Capture insertion marker changed');
const captureHtml = source.replace(marker, () => hooks + '\n' + marker);
let server;
let base = process.env.GAME_URL;
if (!base) {
  server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      const path=resolve(root,'.'+pathname);
      if(!path.startsWith(resolve(root)+'\\') && !path.startsWith(resolve(root)+'/')) {res.writeHead(403).end();return;}
      const data=await readFile(path);res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript':'application/octet-stream'}).end(data);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;
}

const clips = [
  {name:'Impact / cold open',kind:'clash',seconds:2,step:1,warm:3,shot:{radius:6.4,y:3.5,angle:-.3,orbit:.25},setup:'game.video.place([{x:-.85,z:0,vx:9,vz:0},{x:.85,z:0,vx:-9,vz:0}]);game.video.clash();',sfx:'clang'},
  {name:'Over the edge',kind:'ring',seconds:2,step:2,warm:3,shot:{radius:9,y:5,angle:.7},setup:'game.video.stage(18);game.video.place([{x:4.8,z:0,vx:10,vz:0},{x:6.1,z:0,vx:0,vz:0},{x:0,z:-1,vx:3,vz:3}]);game.video.clash();',sfx:'out'},
  {name:'Tornado',seconds:2,step:1,warm:34,shot:{radius:12,y:7,center:true},setup:"game.trailer.cast('storm');",sfx:'wind'},
  {name:'Thunderbolt',seconds:1,step:1,warm:1,shot:{radius:9,y:6,angle:-.5},setup:"game.trailer.cast('thunder');",sfx:'zap'},
  {name:'Ice',seconds:1.25,step:2,warm:12,shot:{radius:10,y:8,center:true},setup:"game.trailer.cast('ice');",sfx:'freeze'},
  {name:'Fire',seconds:1.25,step:2,warm:20,shot:{radius:9,y:5},setup:"game.trailer.cast('fire');",sfx:'boom'},
  ...[['arc','Thunder Run'],['flare','Firestorm']].map(([fusion,name])=>({name,fusion,arena:fusion==='flare'?19:undefined,seconds:2,step:fusion==='arc'?2:1,warm:3,shot:{radius:fusion==='flare'?12:10,y:fusion==='arc'?11:6,center:true,angle:.2,orbit:.3},setup:`game.trailer.fuse('${fusion}');`,sfx:fusion==='arc'?'zap':'boom'})),
  {name:'Nine masters rise',kind:'rumble',seconds:4.5,step:3,warm:82,shot:{natural:true},sfx:'rumble'},
  {name:'The collapsing crater',kind:'crater',seconds:3,step:3,warm:10,shot:{radius:18,y:12,center:true,angle:.5,orbit:.35},sfx:'rumble'},
  {name:'Time stops',kind:'void',seconds:2,step:1,warm:2,shot:{radius:12,y:9,center:true},sfx:'sting'},
  {name:'The equation answers',kind:'equation',seconds:2.5,step:1,warm:6,shot:{radius:13,y:10,center:true,orbit:-.3},sfx:'shatter'},
  {name:'Dragon Warrior',kind:'dragon',seconds:3,step:2,warm:900,shot:{natural:true},sfx:'rumble'},
];
const removedShots=[
  {name:'Phantom Lotus',previousStart:346/30,duration:2},
  {name:'Diamond Fortress',previousStart:466/30,duration:2},
  {name:'Blood Frost',previousStart:526/30,duration:2},
];
// Fractional edit lengths are quantised to whole frames; the edit is about 32 s.
clips.forEach(c=>c.frames=Math.round(c.seconds*30));
const gameplayFrames=clips.reduce((n,c)=>n+c.frames,0),titleFrames=105,totalFrames=gameplayFrames+titleFrames;
const duration=totalFrames/30;
if(selectedShots?.some(s=>!clips.some(c=>(c.fusion||c.kind||c.name)===s)))throw new Error('Unknown shot selector');
const reviewTimes=[.5,5,10.5,12.5,14.5,16.5,18.5,22,25.5,25.6,26.1,28,30,31.6];
const cutReviews=[{frame:345,label:'cut-01-before'},{frame:346,label:'cut-01-after'},{frame:405,label:'cut-02-before'},{frame:406,label:'cut-02-after'}];
const browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--remote-debugging-port=0',`--user-data-dir=${join(work,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;
try {
  let port;
  for(let i=0;i<150;i++){try{port=Number((await readFile(join(work,'profile/DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await pause(100);}}
  if(!port)throw new Error('Chrome did not start');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((ok,fail)=>{socket.onopen=ok;socket.onerror=fail;});
  let seq=0;const pending=new Map(),errors=[];
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);fail(new Error(`Timeout: ${method}`));},180000);pending.set(id,{ok,fail,timer});socket.send(JSON.stringify({id,method,params}));});
  const three=(await readFile(join(root,'vendor/three.module.js'))).toString('base64');
  socket.onmessage=async({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.fail(new Error(JSON.stringify(m.error))):p.ok(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Fetch.requestPaused'){
    const html=m.params.request.url.includes('trailer');await send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:html?'text/html; charset=utf-8':'text/javascript'},{name:'Access-Control-Allow-Origin',value:'*'}],body:html?Buffer.from(captureHtml).toString('base64'):three});
  }};
  const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));if(errors.length)throw new Error(JSON.stringify(errors));return r.result.value;};
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'let seed=731;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};'});
  await send('Fetch.enable',{patterns:[{urlPattern:'*?*trailer*'},{urlPattern:'https://cdn.jsdelivr.net/npm/three@*/build/three.module.js'}]});
  if(audioCheck){
    await send('Page.navigate',{url:`${base}?debug&video&trailer&nostory&lang=en`});
    let ready=false;for(let i=0;i<150;i++){await pause(100);if(await evaluate('!!window.game?.trailer')){ready=true;break;}}
    if(!ready)throw new Error('Trailer hooks unavailable');
    await evaluate("game.trailer.prepare('battle',{})");
    let at=0;const events=clips.map(c=>{const event={at,sfx:c.sfx,name:c.name};at+=c.frames/30;return event;});
    const path=join(work,'score-check.wav');await writeFile(path,Buffer.from(await evaluate(`game.trailer.soundtrack(${duration},${JSON.stringify(events)})`),'base64'));
    console.log(run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',path]).toString());
    console.log(run(ffmpeg,['-hide_banner','-i',path,'-af','volumedetect','-f','null','-']).toString());
  }
  await mkdir(out,{recursive:true});await mkdir(review,{recursive:true});
  const sizes=(audioCheck?[]:[['landscape',1920,1080],['portrait',1080,1920]]).filter(([name])=>!process.argv.includes('--landscape')&&!process.argv.includes('--portrait')||process.argv.includes('--'+name));
  const manifest=[];
  let soundtrack;
  for(const [name,width,height] of sizes){
    const frames=reuseFrames ? resolve(reuseFrames) : join(work,name);if(!reuseFrames)await mkdir(frames);
    let previous=null;
    if(inputFrames){
      try{previous=JSON.parse(await readFile(join(resolve(inputFrames),'capture-manifest.json'),'utf8'));}
      catch(error){if(error.code!=='ENOENT')throw error;previous=JSON.parse(await readFile(join(review,'video-manifest.json'),'utf8')).find(m=>m.file.endsWith('video-'+name+'.mp4'));}
    }
    if(inputFrames&&!previous)throw new Error('No previous manifest entry for '+name);
    if(reuseFrames&&Math.abs(previous.duration-duration)>.1)throw new Error('Timeline changed; use --recut-frames to rebuild the score and shot order');
    if(reuseFrames)for(let i=0;i<totalFrames;i++)await stat(join(frames,`${String(i).padStart(5,'0')}.jpg`));
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    let frameIndex=0,at=0;const events=[],timeline=[];
    for(const [ci,c] of clips.entries()){
      if(recutFrames){
        const old=previous.timeline.find(s=>s.name===c.name);
        if(!old||Math.round(old.duration*30)!==c.frames)throw new Error('Missing or changed source shot: '+c.name);
        const first=Math.round(old.start*30);
        for(let f=0;f<c.frames;f++)await copyFile(join(resolve(recutFrames),`${String(first+f).padStart(5,'0')}.jpg`),join(frames,`${String(frameIndex++).padStart(5,'0')}.jpg`));
        timeline.push({...old,start:at,sourceStart:old.start,sourceFramesReused:true});events.push({at,sfx:c.sfx,name:c.name});at+=c.frames/30;
        console.log(`${name}: retained ${c.name} @ ${(at-c.frames/30).toFixed(3)}s`);continue;
      }
      if(selectedShots && !selectedShots.includes(c.fusion||c.kind||c.name)){
        if(reuseFrames){timeline.push(previous.timeline.find(s=>s.name===c.name));frameIndex+=c.frames;}
        events.push({at,sfx:c.sfx,name:c.name});at+=c.frames/30;continue;
      }
      errors.length=0;await send('Page.navigate',{url:`${base}?debug&video&trailer&nostory&lang=en`});
      let ready=false;for(let i=0;i<150;i++){await pause(100);if(await evaluate('!!window.game?.trailer')){ready=true;break;}}
      if(!ready)throw new Error('Trailer hooks unavailable');
      await evaluate(`game.trailer.prepare(${JSON.stringify(c.kind||'battle')},{},${c.arena??'null'});${c.setup||''}game.video.frame(${c.warm||0},false);`);
      console.log(`${name} ${ci+1}/${clips.length}: ${c.name} @ ${at.toFixed(2)}s`);
      let last;
      for(let f=0;f<c.frames;f++){
        if(preview && f!==Math.floor(c.frames*.4))continue;
        last=await evaluate(`game.trailer.frame(${preview?f*c.step:f?c.step:0},${JSON.stringify(c.shot)},${f/c.frames})`);
        if(!['battle','ending','revive','combo'].includes(last.state))throw new Error(`Unexpected state in ${c.name}: ${JSON.stringify(last)}`);
        const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:94,fromSurface:true,captureBeyondViewport:false});
        await writeFile(join(frames,`${String(frameIndex).padStart(5,'0')}.jpg`),Buffer.from(shot.data,'base64'));frameIndex++;
        if(f && f%45===0)console.log(`  ${f}/${c.frames}`);
      }
      console.log(`  ${JSON.stringify(last)}`);events.push({at,sfx:c.sfx,name:c.name});timeline.push({name:c.name,arena:c.arena,start:at,duration:c.frames/30,simulationFramesPerOutputFrame:c.step,last});at+=c.frames/30;
    }
    // Restrained, vector-sharp end card, rendered at each deliverable's native size.
    if(recutFrames){
      const oldTitle=Math.round(previous.timeline.reduce((n,c)=>n+c.duration,0)*30);
      for(let i=0;i<titleFrames;i++)await copyFile(join(resolve(recutFrames),`${String(oldTitle+i).padStart(5,'0')}.jpg`),join(frames,`${String(frameIndex++).padStart(5,'0')}.jpg`));
      errors.length=0;await send('Page.navigate',{url:`${base}?debug&video&trailer&nostory&lang=en`});
      let ready=false;for(let i=0;i<150;i++){await pause(100);if(await evaluate('!!window.game?.trailer')){ready=true;break;}}
      if(!ready)throw new Error('Audio synthesiser hooks unavailable');
      await evaluate("game.trailer.prepare('battle',{})");
    }
    if(!inputFrames){
    await evaluate(`document.body.insertAdjacentHTML('beforeend', '<div id="trailerTitle"></div>');document.head.insertAdjacentHTML('beforeend','<style>#trailerTitle{display:flex!important;position:fixed;inset:0;z-index:999;background:radial-gradient(ellipse at 50% 46%,#182438 0%,#070b14 65%);align-items:center;justify-content:center;flex-direction:column;color:#f3e9cb;text-align:center;font-family:Georgia,serif}#trailerTitle small{font:400 ${width>height?20:23}px Arial,sans-serif;letter-spacing:.48em;color:#9aa6b8;margin-bottom:32px}#trailerTitle strong{font-size:${width>height?166:103}px;line-height:1.04;letter-spacing:.045em;font-weight:700;text-shadow:0 2px 24px #b78c3c33}#trailerTitle i{display:block;width:110px;height:2px;background:#c4a36a;margin:40px 0 28px}#trailerTitle em{font:400 ${width>height?19:24}px Arial,sans-serif;letter-spacing:.25em;color:#b9c0cb;font-style:normal}</style>');document.querySelector('#trailerTitle').innerHTML='<strong>${width>height?'SPIN TOP<br>SHOWDOWN':'SPIN TOP<br>SHOWDOWN'}</strong><i></i><em>ĐẠI CHIẾN CON QUAY</em>';`);
    const card=Buffer.from((await send('Page.captureScreenshot',{format:'jpeg',quality:98,fromSurface:true,captureBeyondViewport:false})).data,'base64');
    if(preview){
      await writeFile(join(frames,`${String(frameIndex).padStart(5,'0')}.jpg`),card);
      run(ffmpeg,['-y','-v','error','-framerate','1','-i',join(frames,'%05d.jpg'),'-vf',`scale=${width>height?480:216}:-1,tile=4x5`,'-frames:v','1',join(review,`video-${name}-preview.jpg`)]);continue;
    }
    for(let i=0;i<titleFrames;i++)await writeFile(join(frames,`${String(frameIndex++).padStart(5,'0')}.jpg`),card);
    }
    if(!reuseFrames&&!soundtrack){soundtrack=join(work,'score.wav');await writeFile(soundtrack,Buffer.from(await evaluate(`game.trailer.soundtrack(${duration},${JSON.stringify(events)})`),'base64'));}
    const path=join(out,`video-${name}.mp4`),encoded=join(work,`video-${name}.mp4`);
    run(ffmpeg,['-y','-v','error','-framerate','30','-i',join(frames,'%05d.jpg'),'-i',reuseFrames?path:soundtrack,'-map','0:v:0','-map','1:a:0','-vf',`eq=contrast=1.045:saturation=1.08:brightness=-0.008,vignette=PI/7,fade=t=out:st=${duration-.6}:d=0.6`,...reuseFrames?['-c:a','copy']:['-af',`loudnorm=I=-16:TP=-3:LRA=9,afade=t=out:st=${duration-1.2}:d=1.2`,'-c:a','aac','-b:a','160k','-ar','48000'],'-c:v','libx264','-preset','slow','-crf','21','-maxrate','3500k','-bufsize','7000k','-pix_fmt','yuv420p','-r','30','-t',String(duration),'-movflags','+faststart',encoded]);
    const probe=JSON.parse(run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',encoded]).toString());
    const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio'),bytes=(await stat(encoded)).size;
    if(video.codec_name!=='h264'||video.width!==width||video.height!==height||video.avg_frame_rate!=='30/1'||!audio||bytes>=20000000||Math.abs(+probe.format.duration-duration)>.1)throw new Error('Deliverable verification failed');
    await copyFile(encoded,path);
    // All review images are decoded from the FINAL MP4, never from source screenshots.
    run(ffmpeg,['-y','-v','error','-i',path,'-vf',`fps=1/2,scale=${width>height?480:216}:-1,tile=4x4`,'-frames:v','1',join(review,`video-${name}-review.jpg`)]);
    const reviewDir=join(review,`trailer-${name}-frames`);await mkdir(reviewDir,{recursive:true});
    for(const t of reviewTimes)run(ffmpeg,['-y','-v','error','-ss',String(t),'-i',path,'-frames:v','1','-update','1',join(reviewDir,`${String(t).replace('.','-')}s.jpg`)]);
    const cutSamples=join(work,`${name}-cuts`);await mkdir(cutSamples);
    for(const [i,c]of cutReviews.entries()){
      const file=join(reviewDir,c.label+'.jpg');
      run(ffmpeg,['-y','-v','error','-i',path,'-vf',`select=eq(n\\,${c.frame})`,'-frames:v','1','-update','1',file]);
      await copyFile(file,join(cutSamples,`${i}.jpg`));
    }
    run(ffmpeg,['-y','-v','error','-framerate','1','-i',join(cutSamples,'%d.jpg'),'-vf',`scale=${width>height?640:270}:-1,tile=2x2`,'-frames:v','1',join(review,`video-${name}-cuts-review.jpg`)]);
    const reviewFrames=[...reviewTimes.map(t=>({time:t,file:`reports/capture/trailer-${name}-frames/${String(t).replace('.','-')}s.jpg`})),...cutReviews.map(c=>({time:c.frame/30,frame:c.frame,file:`reports/capture/trailer-${name}-frames/${c.label}.jpg`}))];
    // Remove only stale JPEGs explicitly listed by the preceding video manifest.
    if(previous)for(const old of previous.reviewFrames||[]){
      const oldPath=resolve(root,old.file);
      if(!reviewFrames.some(f=>f.file===old.file)&&dirname(oldPath)===resolve(reviewDir)&&oldPath.endsWith('.jpg'))await rm(oldPath,{force:true});
    }
    const riseAt=timeline.find(c=>c.name==='Nine masters rise').start;
    const result={file:`store/shared/video-${name}.mp4`,bytes,width,height,fps:30,codec:video.codec_name,pix_fmt:video.pix_fmt,duration:+probe.format.duration,removedShots,titleCard:{start:gameplayFrames/30,duration:titleFrames/30,originalSourceFramesReused:!!recutFrames},audio:{codec:audio.codec_name,sampleRate:audio.sample_rate,channels:audio.channels,source:'Continuous original score using game tone/noise synthesiser; newly arranged on the shortened timeline, no spliced audio.',rumbleDownbeat:riseAt,beatLength:riseAt/28,sfx:events},reviewSheet:`reports/capture/video-${name}-review.jpg`,cutReviewSheet:`reports/capture/video-${name}-cuts-review.jpg`,reviewFrames,timeline};manifest.push(result);console.log(JSON.stringify({file:result.file,bytes,duration:result.duration,shots:timeline.length,rumbleDownbeat:riseAt,frames:video.nb_frames}));
    await writeFile(join(frames,'capture-manifest.json'),JSON.stringify(result,null,2)+'\n');
  }
  if(!preview&&!audioCheck){
    const manifestPath=join(review,'video-manifest.json');let old=[];try{old=JSON.parse(await readFile(manifestPath,'utf8'));}catch{}
    const files=new Set(manifest.map(m=>m.file.split('/').pop()));
    await writeFile(manifestPath,JSON.stringify([...old.filter(m=>!files.has(m.file.split(/[\\/]/).pop())),...manifest],null,2)+'\n');
  }
  await send('Browser.close');
} finally {
  socket?.close();browser.kill();server?.close();await pause(500);
  if(dirname(work)!==resolve(tmpdir())||!basename(work).startsWith('spin-trailer-'))throw new Error('Unsafe temp path');
  if(process.argv.includes('--keep-frames'))console.log(`Scratch: ${work}`);
  else await rm(work,{recursive:true,force:true,maxRetries:5}).catch(e=>console.error(`Temp cleanup: ${e.message}`));
}
