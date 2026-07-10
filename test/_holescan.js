/* 一次性体检：扫描立绘/战姿 PNG，找“人物剪影内部的透明孔洞”（抠图误吃衣物的伤）。
 * 启发式：对每个透明像素，若其所在行左右两侧与所在列上下两侧都存在不透明像素（即位于剪影包络内），
 * 记为“内部透明”；内部透明占剪影包络面积比例 > 阈值 → 报告疑似破损。
 * 用法: node test/_holescan.js [dir=assets/portraits] [thr=0.02] */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
function readPNG(buf){let off=8,w=0,h=0,ct=0,idat=[];while(off<buf.length){const len=buf.readUInt32BE(off);const t=buf.toString("ascii",off+4,off+8);const d=buf.slice(off+8,off+8+len);if(t==="IHDR"){w=d.readUInt32BE(0);h=d.readUInt32BE(4);ct=d[9];}else if(t==="IDAT")idat.push(d);else if(t==="IEND")break;off+=12+len;}if(ct!==6)return null;const ch=4;const raw=zlib.inflateSync(Buffer.concat(idat));const stride=w*ch;const out=Buffer.alloc(h*stride);let p=0;for(let y=0;y<h;y++){const ft=raw[p++];for(let x=0;x<stride;x++){const rv=raw[p++];const a=x>=ch?out[y*stride+x-ch]:0;const b=y>0?out[(y-1)*stride+x]:0;const c=(x>=ch&&y>0)?out[(y-1)*stride+x-ch]:0;let v;switch(ft){case 0:v=rv;break;case 1:v=rv+a;break;case 2:v=rv+b;break;case 3:v=rv+((a+b)>>1);break;case 4:{const pa=Math.abs(b-c),pb=Math.abs(a-c),pc=Math.abs(a+b-2*c);const pr=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);v=rv+pr;break;}default:v=rv;}out[y*stride+x]=v&0xff;}}return{w,h,data:out};}
const dir = process.argv[2] || "assets/portraits";
const THR = parseFloat(process.argv[3] || "0.02");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".png"));
const sus = [];
for (const f of files) {
  let png; try { png = readPNG(fs.readFileSync(path.join(dir, f))); } catch (e) { continue; }
  if (!png) continue;
  const { w, h, data } = png;
  const A = (x, y) => data[(y * w + x) * 4 + 3];
  // 每行左右边界、每列上下边界（不透明包络）
  const rowL = new Int32Array(h).fill(-1), rowR = new Int32Array(h).fill(-1);
  const colT = new Int32Array(w).fill(-1), colB = new Int32Array(w).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A(x, y) > 60) { if (rowL[y] < 0) rowL[y] = x; rowR[y] = x; }
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (A(x, y) > 60) { if (colT[x] < 0) colT[x] = y; colB[x] = y; }
  let hull = 0, holes = 0;
  for (let y = 0; y < h; y++) {
    if (rowL[y] < 0) continue;
    for (let x = rowL[y]; x <= rowR[y]; x++) {
      if (colT[x] < 0 || y < colT[x] || y > colB[x]) continue;
      hull++;
      if (A(x, y) <= 8) holes++;
    }
  }
  const ratio = hull ? holes / hull : 0;
  if (ratio > THR) sus.push({ f, ratio: (ratio * 100).toFixed(1) + "%", holes });
}
sus.sort((a, b) => parseFloat(b.ratio) - parseFloat(a.ratio));
if (!sus.length) console.log("OK：未发现疑似内部孔洞破损。");
else { console.log("疑似抠图破损（内部透明占剪影比例）："); for (const s of sus) console.log(`  ${s.f}  ${s.ratio}  (${s.holes}px)`); }
