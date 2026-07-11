/* 杂学里程碑（丹道/阵法深耕台阶）门禁：验证到点解锁、幂等、效果接入。
 * 非对称三路设计（用户裁决 2026-06-30）：丹/阵不塞伤害，以里程碑解锁独占能力/被动增强。 */
const fs = require("fs"), vm = require("vm"), path = require("path");
const store = {};
const sb = { console:{log(){},warn(){},error(){}}, Math, Date, JSON, setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{}, localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}}, performance:{now:()=>Date.now()} };
sb.window=sb; sb.globalThis=sb; sb.navigator={vibrate:()=>{}};
sb.document={body:{classList:{toggle(){},add(){},remove(){}}},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},addEventListener(){}})};
sb.UI=new Proxy({},{get(){return ()=>{};}}); sb.Audio=function(){return{play(){return Promise.resolve();},pause(){},addEventListener(){}};};
const ctx=vm.createContext(sb);
["js/data.js","js/state.js","js/chapters.js","js/balance.js","js/world.js","js/npcsim.js","js/interactions.js","js/combat.js","js/explore.js","js/exploremap.js","js/loadout.js","js/dialogue.js","js/fortunes.js","js/quests.js","js/story.js","js/engine.js"].forEach(f=>{try{vm.runInContext(fs.readFileSync(path.join(__dirname,"..",f),"utf8"),ctx,{filename:f});}catch(e){console.error("LOAD "+f+": "+e.message);process.exit(1);}});
const { State, Engine } = sb;
let fails = 0;
function assert(c,m){ if(!c){ fails++; process.stdout.write("  X "+m+"\n"); } }

State.create("韩立",{root:"wu"});
const s = State.data;
s.flags = s.flags || {};

// 丹道里程碑：到 8/12/40/60 解锁（polish A5/A7：首档 20→12 本章可及·8 级自制伤药）
s.skills.alchemy = 7; Engine._checkSkillMilestones("alchemy");
assert(!s.flags.dan_ms_jinchuang, "药理7未解锁自制伤药");
s.skills.alchemy = 8; Engine._checkSkillMilestones("alchemy");
assert(s.flags.dan_ms_jinchuang, "药理8解锁自制伤药");
s.skills.alchemy = 11; Engine._checkSkillMilestones("alchemy");
assert(!s.flags.dan_ms_bianyao, "药理11未解锁辨药入门");
s.skills.alchemy = 12; Engine._checkSkillMilestones("alchemy");
assert(s.flags.dan_ms_bianyao, "药理12解锁辨药入门");
s.skills.alchemy = 40; Engine._checkSkillMilestones("alchemy");
assert(s.flags.dan_ms_anshen, "药理40解锁自炼凝神丹");
s.skills.alchemy = 60; Engine._checkSkillMilestones("alchemy");
assert(s.flags.dan_ms_chunqing, "药理60解锁丹火纯青");

// 幂等：再调用不重复（flag 已置）
const msCount1 = s.milestones.length;
Engine._checkSkillMilestones("alchemy");
assert(s.milestones.length === msCount1, "里程碑幂等·重复调用不再记年表");

// 阵法里程碑：fulu 15/30
s.skills.fulu = 15; Engine._checkSkillMilestones("fulu");
assert(s.flags.zhen_ms_wengu, "制符术15解锁布阵稳固");
s.skills.fulu = 30; Engine._checkSkillMilestones("fulu");
assert(s.flags.zhen_ms_juling, "制符术30解锁洞府聚灵阵");

// 效果接入：洞府聚灵阵 → cultivate formationMul 生效（修为增速提升）
const s2 = State.create("韩立",{root:"wu"});
s2.realmIndex = 4; s2.cultivation = 0; s2.mood = s2.moodMax; s2.demon = 0;
const before = s2.cultivation;
Engine.cultivate(1);
const gainNoFormation = s2.cultivation - before;
const s3 = State.create("韩立",{root:"wu"});
s3.realmIndex = 4; s3.cultivation = 0; s3.mood = s3.moodMax; s3.demon = 0;
s3.flags.zhen_ms_juling = true;
const before3 = s3.cultivation;
Engine.cultivate(1);
const gainFormation = s3.cultivation - before3;
assert(gainFormation > gainNoFormation, `洞府聚灵阵提升闭关修为（${gainNoFormation}→${gainFormation}）`);

// anshen 谱受里程碑 gate（未解锁不可种）
const s4 = State.create("韩立",{root:"wu"});
s4.bottle = { unlocked: true, plots: [{ crop: null, growth: 0 }] };
State.give("lingcao", 5);
delete s4.flags.dan_ms_anshen;
Engine.plantCrop(0, "anshen");
assert(s4.bottle.plots[0].crop !== "anshen", "未解锁自炼凝神丹·anshen谱种不了");
s4.flags.dan_ms_anshen = true;
Engine.plantCrop(0, "anshen");
assert(s4.bottle.plots[0].crop === "anshen", "解锁后anshen谱可种");

if (fails) { process.stdout.write("杂学里程碑门禁 FAIL ("+fails+")\n"); process.exit(1); }
process.stdout.write("杂学里程碑门禁 PASS：丹道3阶/阵法2阶 解锁+幂等+效果接入(聚灵阵/凝神丹谱) 全过。\n");
process.exit(0);
