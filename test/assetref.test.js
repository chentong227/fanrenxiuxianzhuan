/* 资产引用完整性测试：防"资产已画好但代码漏注册/引用拼错"这类静默断链。
 *   1) STORY 节点的 cg 引用：若磁盘有 assets/cg/cg_<id>.png 却未在 art.js CG 注册 → FAIL（画了不显示）。
 *   2) give/take/count 的物品 id 必须在 DATA.items 或 DATA.gear。
 *   3) startEncounterFight 的敌人 id 必须在 WORLD.enemies。
 *   4) meetNpc 的 NPC id 必须在 WORLD.npcs。
 * 跑：node test/assetref.test.js */
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, "..");
const sb = { console:{log(){},warn(){},error(){}}, Math, Date, JSON, setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, performance:{now:()=>Date.now()} };
sb.window=sb; sb.globalThis=sb; sb.navigator={vibrate:()=>{}};
sb.document={body:{classList:{toggle(){},add(){},remove(){}}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},addEventListener(){}})};
sb.UI=new Proxy({},{get(){return ()=>{};}});
sb.Audio=function(){return {play(){return Promise.resolve();},pause(){},addEventListener(){}};};
const ctx=vm.createContext(sb);
for (const f of ["js/data.js","js/state.js","js/chapters.js","js/balance.js","js/world.js","js/npcsim.js","js/interactions.js","js/combat.js","js/explore.js","js/exploremap.js","js/loadout.js","js/dialogue.js","js/fortunes.js","js/quests.js","js/story.js","js/engine.js"]) {
  try { vm.runInContext(fs.readFileSync(path.join(ROOT,f),"utf8"), ctx, {filename:f}); } catch(e){}
}
const { DATA, WORLD, CombatAPI, STORY } = sb;
const items = DATA.items||{}, gear = DATA.gear||{}, enemies=(WORLD&&WORLD.enemies)||{};
const npcs = {}; ((WORLD&&WORLD.npcs)||[]).forEach(n=>npcs[n.id]=1);

// art.js CG 注册表（静态解析 const CG = {...}）
const artCode = fs.readFileSync(path.join(ROOT,"js","art.js"),"utf8");
const cgReg = new Set();
{ const m = /const\s+CG\s*=\s*\{([\s\S]*?)\n\s*\};/m.exec(artCode);
  if (m) { let k; const re=/([a-z_][\w]*)\s*:/gi; while((k=re.exec(m[1]))) cgReg.add(k[1]); } }

let pass=0, fail=0;
function bad(msg){ fail++; console.log("  X "+msg); }
function ok(){ pass++; }

console.log("== 1. STORY cg 引用：磁盘有图却未注册 = 画了不显示（FAIL）==");
const cgSeen=new Set();
STORY.forEach(node=>{
  if(!node.cg||cgSeen.has(node.cg))return; cgSeen.add(node.cg);
  const onDisk = fs.existsSync(path.join(ROOT,"assets","cg","cg_"+node.cg+".png"));
  if(onDisk && !cgReg.has(node.cg)) bad(`节点 ${node.id}: CG "${node.cg}" 磁盘有图但 art.js 未注册（剧情大图不显示）`);
  else ok();
});

console.log("== 2. give/take/count 物品 id 存在 ==");
const code = fs.readFileSync(path.join(ROOT,"js","story.js"),"utf8")+"\n"+fs.readFileSync(path.join(ROOT,"js","engine.js"),"utf8");
const Q="[\"'`]";
function scan(re,label,exists){ let m;re.lastIndex=0;const seen=new Set(); while((m=re.exec(code))){const id=m[1];if(seen.has(id))continue;seen.add(id);if(!exists(id))bad(`${label}: "${id}" 不存在`);else ok();} }
scan(new RegExp(`State\\.(?:give|take|count)\\(\\s*${Q}([^"'\`]+)${Q}`,"g"),"物品",id=>items[id]||gear[id]);
console.log("== 3. startEncounterFight 敌人 id 存在 ==");
scan(new RegExp(`startEncounterFight\\(\\s*${Q}([^"'\`]+)${Q}`,"g"),"敌人",id=>enemies[id]);
console.log("== 4. meetNpc NPC id 存在 ==");
scan(new RegExp(`meetNpc\\(\\s*${Q}([^"'\`]+)${Q}`,"g"),"NPC",id=>npcs[id]);

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail?1:0);
