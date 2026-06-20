/* ============================================================
 * holefill.js — 抠图后处理：清掉"被人物包住、边缘洪泛进不去"的内部白底孔洞
 *   （如抬手两指诀与躯干夹角处困住的纯白背景、持械火光与衣摆间的白缝）。
 * cutout.js 只从四边洪泛、删与边缘连通的背景；被前景完全包围的白底岛删不掉。
 * 本步只删"被前景完全包围、不接触画面边界"的近白不透明连通岛（阈值高 thr=246、
 * 体量≥minsize），衣物高光（多在 235 以下且连成片不孤立）不受影响。
 * 删除后 choke 1px 吃掉夹角抗锯齿白边 + 双级羽化 + un-matte（按白底反解）。
 * 用法: node scripts/holefill.js <in.png> <out.png> [thr=246] [minsize=30]
 * ============================================================ */
const fs = require("fs");
const zlib = require("zlib");
function readPNG(buf){let off=8,w=0,h=0,ct=0,idat=[];while(off<buf.length){const len=buf.readUInt32BE(off);const t=buf.toString("ascii",off+4,off+8);const d=buf.slice(off+8,off+8+len);if(t==="IHDR"){w=d.readUInt32BE(0);h=d.readUInt32BE(4);ct=d[9];}else if(t==="IDAT")idat.push(d);else if(t==="IEND")break;off+=12+len;}const ch=ct===6?4:3;const raw=zlib.inflateSync(Buffer.concat(idat));const stride=w*ch;const out=Buffer.alloc(h*stride);let p=0;for(let y=0;y<h;y++){const ft=raw[p++];for(let x=0;x<stride;x++){const rv=raw[p++];const a=x>=ch?out[y*stride+x-ch]:0;const b=y>0?out[(y-1)*stride+x]:0;const c=(x>=ch&&y>0)?out[(y-1)*stride+x-ch]:0;let v;switch(ft){case 0:v=rv;break;case 1:v=rv+a;break;case 2:v=rv+b;break;case 3:v=rv+((a+b)>>1);break;case 4:{const pa=Math.abs(b-c),pb=Math.abs(a-c),pc=Math.abs(a+b-2*c);const pr=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);v=rv+pr;break;}default:v=rv;}out[y*stride+x]=v&0xff;}}const rgba=Buffer.alloc(w*h*4);for(let i=0;i<w*h;i++){rgba[i*4]=out[i*ch];rgba[i*4+1]=out[i*ch+1];rgba[i*4+2]=out[i*ch+2];rgba[i*4+3]=ch===4?out[i*ch+3]:255;}return{w,h,rgba};}
let CRC=null;function crc32(b){if(!CRC){CRC=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);CRC[n]=c>>>0;}}let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xff]^(c>>>8);return(c^0xffffffff)>>>0;}
function writePNG(w,h,rgba){const stride=w*4;const raw=Buffer.alloc(h*(stride+1));for(let y=0;y<h;y++){raw[y*(stride+1)]=0;rgba.copy(raw,y*(stride+1)+1,y*stride,y*stride+stride);}const idat=zlib.deflateSync(raw,{level:9});const mk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const tb=Buffer.from(t,"ascii");const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(Buffer.concat([tb,d]))>>>0,0);return Buffer.concat([l,tb,d,cr]);};const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),mk("IHDR",ih),mk("IDAT",idat),mk("IEND",Buffer.alloc(0))]);}

const [inp,outp,thrStr,minStr]=process.argv.slice(2);
if(!inp||!outp){console.error("用法: node scripts/_holefill.js <in.png> <out.png> [thr=246] [minsize=30]");process.exit(1);}
const THR=thrStr?parseInt(thrStr,10):246;
const MIN=minStr?parseInt(minStr,10):30;
const {w,h,rgba}=readPNG(fs.readFileSync(inp));
const N=w*h;
const isWhiteOpaque=(i)=>rgba[i*4+3]>=180 && rgba[i*4]>=THR && rgba[i*4+1]>=THR && rgba[i*4+2]>=THR;
// 连通分量（4-邻），找被前景包住、不接触画面边界的近白不透明岛
const comp=new Int32Array(N).fill(-1);
const remove=new Uint8Array(N);
let removed=0,islands=0;
for(let s=0;s<N;s++){
  if(comp[s]!==-1||!isWhiteOpaque(s))continue;
  const stack=[s];comp[s]=s;const px=[];let touchesEdge=false;
  while(stack.length){
    const idx=stack.pop();px.push(idx);
    const x=idx%w,y=(idx/w)|0;
    if(x===0||y===0||x===w-1||y===h-1)touchesEdge=true;
    const nb=[x>0?idx-1:-1,x<w-1?idx+1:-1,y>0?idx-w:-1,y<h-1?idx+w:-1];
    for(const ni of nb){if(ni>=0&&comp[ni]===-1&&isWhiteOpaque(ni)){comp[ni]=s;stack.push(ni);}}
  }
  if(!touchesEdge && px.length>=MIN){islands++;for(const i of px){remove[i]=1;removed++;}}
}
// choke: 把删除区向前景膨胀 1 圈，吃掉夹角处的抗锯齿白边
const grow=[];
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(remove[i])continue;if(rgba[i*4+3]===0)continue;if((x>0&&remove[i-1])||(x<w-1&&remove[i+1])||(y>0&&remove[i-w])||(y<h-1&&remove[i+w]))grow.push(i);}
for(const i of grow)remove[i]=1;
for(let i=0;i<N;i++)if(remove[i])rgba[i*4+3]=0;
// 双级羽化 + un-matte（按白底反解）
const edge1=[];
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(remove[i]||rgba[i*4+3]===0)continue;if((x>0&&remove[i-1])||(x<w-1&&remove[i+1])||(y>0&&remove[i-w])||(y<h-1&&remove[i+w]))edge1.push(i);}
const e1=new Uint8Array(N);for(const i of edge1)e1[i]=1;
const edge2=[];
for(const i of edge1){const x=i%w,y=(i/w)|0;[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].forEach(([nx,ny])=>{if(nx<0||ny<0||nx>=w||ny>=h)return;const ni=ny*w+nx;if(!remove[ni]&&!e1[ni]&&rgba[ni*4+3]!==0)edge2.push(ni);});}
for(const i of edge1)rgba[i*4+3]=Math.min(rgba[i*4+3],110);
for(const i of edge2)rgba[i*4+3]=Math.min(rgba[i*4+3],200);
const unmatte=(i)=>{const a=rgba[i*4+3]/255;if(a<=0.02||a>=0.99)return;for(let c=0;c<3;c++){const v=rgba[i*4+c];rgba[i*4+c]=Math.max(0,Math.min(255,Math.round((v-255*(1-a))/a)));}};
for(const i of edge1)unmatte(i);for(const i of edge2)unmatte(i);
fs.writeFileSync(outp,writePNG(w,h,rgba));
console.log(`holefill ${outp}  岛=${islands} 删像素=${removed} (${w}x${h}, thr=${THR})`);
