/* 活世界·命途资源竞争门禁（drift-audit #4 落地）：
 * 验证——①寿元将尽(desperate)的背景修士主动找上门求丹；②玩家的续命丹分级救助、真改 npcsim 命途；
 *        ③丹有数→救一个就少一颗（资源竞争·非好感数值条）。 */
const fs = require("fs"), vm = require("vm"), path = require("path");
const store = {};
const sb = { console:{log(){},warn(){},error(){}}, Math, Date, JSON, setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{}, localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}}, performance:{now:()=>Date.now()} };
sb.window=sb; sb.globalThis=sb; sb.navigator={vibrate:()=>{}};
sb.document={body:{classList:{toggle(){},add(){},remove(){}}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},addEventListener(){}})};
sb.UI=new Proxy({},{get(){return ()=>{};}}); sb.Audio=function(){return{play(){return Promise.resolve();},pause(){},addEventListener(){}};};
const ctx=vm.createContext(sb);
["js/data.js","js/state.js","js/chapters.js","js/balance.js","js/world.js","js/npcsim.js","js/interactions.js","js/combat.js","js/explore.js","js/exploremap.js","js/loadout.js","js/dialogue.js","js/fortunes.js","js/quests.js","js/story.js","js/engine.js"].forEach(f=>{try{vm.runInContext(fs.readFileSync(path.join(__dirname,"..",f),"utf8"),ctx,{filename:f});}catch(e){console.error("LOAD "+f+": "+e.message);process.exit(1);}});
const { State, INTERACTIONS } = sb;
let fails = 0;
function assert(c,m){ if(!c){ fails++; process.stdout.write("  X "+m+"\n"); } }

const s = State.create("韩立",{root:"wu"});
s.flags.is_modafu = true;   // 以医毒闻名（求药名头）
// 造一个寿元将尽的背景修士
const dying = s.npcFates[0];
dying.desperate = true; dying.status = "alive";
const lifeBefore = dying.lifespan;

// ① desperate 优先来访：rng 调低使 pick 命中 desperate 分支
let r = null;
for (let i = 0; i < 50; i++) { r = INTERACTIONS.pick(s, () => 0.01); if (r && r.kind === "beg_pill") break; }
assert(r && r.kind === "beg_pill" && r.npcId === dying.id, "寿元将尽者主动上门求丹（desperate 优先）");

// ② 多丹分级救助：给玩家养元丹，build 出救助选项
State.give("qingyuan_dan", 2);
const built = INTERACTIONS.build({ kind: "beg_pill", npcId: dying.id, npcName: dying.name }, s);
assert(built.choices.some(c => /养元丹/.test(c.text) && /赠以/.test(c.text)), "持养元丹→出现赠丹选项");
// 救助：执行赠养元丹
const giveChoice = built.choices.find(c => /赠以养元丹/.test(c.text));
const danBefore = State.count("qingyuan_dan");
giveChoice.effect(s);
assert(State.count("qingyuan_dan") === danBefore - 1, "③资源竞争：救一人耗一颗丹（养元丹 2→1）");
assert(dying.lifespan > lifeBefore, `续命真改命途（lifespan ${lifeBefore}→${dying.lifespan}）`);
assert(!dying.desperate, "救助后该修士脱离垂死状态");

// 无丹时：仍有"爱莫能助"出口，不卡死
const s2 = State.create("韩立",{root:"wu"});
s2.flags.is_modafu = true;
const d2 = s2.npcFates[1]; d2.desperate = true;
const built2 = INTERACTIONS.build({ kind: "beg_pill", npcId: d2.id, npcName: d2.name }, s2);
assert(built2.choices.length >= 1 && /爱莫能助/.test(built2.choices[built2.choices.length-1].text), "无丹也有爱莫能助出口（不卡死）");

if (fails) { process.stdout.write("活世界命途门禁 FAIL ("+fails+")\n"); process.exit(1); }
process.stdout.write("活世界命途门禁 PASS：垂死者主动求丹+多丹分级救助+资源竞争(救一人耗一丹)+真改命途 全过。\n");
process.exit(0);
