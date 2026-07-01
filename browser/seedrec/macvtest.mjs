import { chromium } from "playwright"; import fs from "fs";
const b = await chromium.launch({ headless: true, channel: "chrome", args:["--disable-renderer-backgrounding","--disable-background-timer-throttling"] });
const c = await b.newContext({ recordVideo:{ dir:"/tmp/macvt", size:{width:1280,height:720} }, viewport:{width:1280,height:720} });
const p = await c.newPage();
await p.goto("http://100.92.41.124:7686/", { waitUntil:"domcontentloaded", timeout:25000 });
await new Promise(r=>setTimeout(r,10000));
await c.close(); const v = await p.video().path(); fs.copyFileSync(v,"/tmp/macvt.webm"); await b.close();
console.log("video bytes", fs.statSync(v).size);
