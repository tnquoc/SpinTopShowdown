// node tools/review-finale.mjs — native screenshots of the ordinary game, including
// its CSS filters, flash and glory overlay (no ?video / trailer presentation hooks).
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const work=await mkdtemp(join(tmpdir(),'spin-finale-review-'));
const out=join(root,'reports/finale-review');await mkdir(out,{recursive:true});
const base=process.env.GAME_URL||'http://127.0.0.1:5173/';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let server;
try{await fetch(base);}catch{server=spawn(process.execPath,[join(root,'tools/serve-local.mjs')],{windowsHide:true,stdio:'ignore'});await pause(1000);}
const browser=spawn(process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--no-sandbox','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--hide-scrollbars','--no-first-run','--no-default-browser-check','--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=0',`--user-data-dir=${join(work,'profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;
try{
  let port;for(let i=0;i<150;i++){try{port=Number((await readFile(join(work,'profile/DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await pause(100);}}
  if(!port)throw new Error('Chrome did not start');
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{socket.onopen=ok;socket.onerror=fail;});
  let seq=0;const pending=new Map(),errors=[];
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++seq,timer=setTimeout(()=>fail(new Error('CDP timeout: '+method)),120000);pending.set(id,{ok,fail,timer});socket.send(JSON.stringify({id,method,params}));});
  socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.fail(new Error(JSON.stringify(m.error))):p.ok(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);};
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));if(errors.length)throw new Error(JSON.stringify(errors));return r.result.value;};
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.requestAnimationFrame=()=>0;localStorage.setItem('tops.voice','0');
    let seed=731;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  `});
  const moments=[['souls',3.5],['fusion',4.5],['coil',6.8],['ride',11.6],['dive',15.35],['landing',16.4]];
  const report={sourceSHA256:createHash('sha256').update(await readFile(join(root,'index.html'))).digest('hex'),mode:'Ordinary web debug game, RAF paused, game.tick(0) at 60 Hz. Real overlays and CSS retained.',moments:[],errors};
  for(const [name,width,height]of [['landscape',1920,1080],['portrait',1080,1920]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:base+'?debug&lang=en&nostory&void'});
    let ready=false;for(let i=0;i<150;i++){await pause(100);if(await evaluate('!!window.game && game.info().state === "battle"')){ready=true;break;}}
    if(!ready)throw new Error('Void debug stage did not launch');
    await evaluate(`
      document.head.insertAdjacentHTML('beforeend','<style>#debugNav{display:none!important}</style>');
      game.tick(180);document.body.classList.add('timefree');game.ko();
      window.reviewT=0;window.reviewAnimations=new WeakMap();
      window.reviewAdvance=n=>{for(let i=0;i<n;i++){game.tick(0);reviewT+=1000/60;
        for(const a of document.getAnimations()){if(!reviewAnimations.has(a))reviewAnimations.set(a,reviewT);a.pause();a.currentTime=reviewT-reviewAnimations.get(a);}}
        game.render();return {combo:game.comboT(),state:game.info().state,filter:getComputedStyle(document.querySelector('canvas')).filter,flash:getComputedStyle(document.querySelector('#flash')).backgroundColor};};
    `);
    let frame=0;
    for(const [moment,t]of moments){
      const target=Math.round(t*60),state=await evaluate(`reviewAdvance(${target-frame})`);frame=target;
      if(state.state!=='combo'||!state.filter.includes('1.12')||state.flash!=='rgb(255, 240, 189)')throw new Error('Finale presentation gate failed: '+JSON.stringify(state));
      const file=`${name}-${moment}.jpg`,shot=await send('Page.captureScreenshot',{format:'jpeg',quality:95,fromSurface:true,captureBeyondViewport:false});
      await writeFile(join(out,file),Buffer.from(shot.data,'base64'));report.moments.push({file:`reports/finale-review/${file}`,time:t,...state});console.log(`${name} ${moment} ${JSON.stringify(state)}`);
    }
    // CB_END remains 18.8 s. Advance through the original handoff, then score it.
    const cleanup=await evaluate(`reviewAdvance(${Math.ceil(18.85*60)-frame});game.tick(1);({state:game.info().state,won:game.info().won,combo:game.comboT(),classRemoved:!document.body.classList.contains('dragon-finale')})`);
    if(cleanup.combo!==null||!cleanup.classRemoved||!cleanup.won)throw new Error('Original win/cleanup handoff failed: '+JSON.stringify(cleanup));
    report[name+'Cleanup']=cleanup;
    // Input order is explicit because the story moments are not alphabetic.
    const args=['-y','-v','error'];for(const[moment]of moments)args.push('-i',join(out,`${name}-${moment}.jpg`));
    args.push('-filter_complex',moments.map((_,i)=>`[${i}:v]scale=${width>height?480:216}:-1[v${i}]`).join(';')+';'+moments.map((_,i)=>`[v${i}]`).join('')+`xstack=inputs=6:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0`, '-frames:v','1',join(out,`${name}-review.jpg`));
    execFileSync(process.env.FFMPEG||'C:/ffmpeg/bin/ffmpeg.exe',args,{windowsHide:true});
  }
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await send('Browser.close');
}finally{
  socket?.close();browser.kill();server?.kill();await pause(400);
  if(dirname(work)!==resolve(tmpdir())||!basename(work).startsWith('spin-finale-review-'))throw new Error('Unsafe temp path');
  await rm(work,{recursive:true,force:true,maxRetries:5}).catch(()=>{});
}
