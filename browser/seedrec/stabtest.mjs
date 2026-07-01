import { chromium } from "playwright"; import fs from "fs";
const b = await chromium.launch({ headless:true, channel:"chrome", args:[
  "--no-sandbox","--disable-dev-shm-usage","--disable-renderer-backgrounding",
  "--disable-background-timer-throttling","--disable-backgrounding-occluded-windows"]});
const c = await b.newContext({ recordVideo:{dir:"/tmp/stab",size:{width:1280,height:720}}, viewport:{width:1280,height:720} });
const p = await c.newPage();
let crashed=false; p.on("crash",()=>{crashed=true; console.log("PAGE CRASHED at", Math.round((Date.now()-t0)/1000)+"s");});
const t0=Date.now();
await p.goto("http://100.92.41.124:7686/",{waitUntil:"domcontentloaded",timeout:25000});
for(let i=0;i<60 && !crashed;i++){ await new Promise(r=>setTimeout(r,1000)); }
console.log("ran", Math.round((Date.now()-t0)/1000)+"s crashed="+crashed);
await c.close(); const v=await p.video().path(); fs.copyFileSync(v,"/tmp/stab.webm"); await b.close();
console.log("video bytes", fs.statSync(v).size);
