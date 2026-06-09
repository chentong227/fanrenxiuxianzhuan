/* 体验审计：模拟"新手玩家"打通七玄门篇，记录每步、用时、卡点，供打磨参考。
 * node test/playthrough.audit.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const store = {};
const sandbox = {
  console, Math, Date, window: {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  setTimeout: () => 0, clearTimeout: () => {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.UI = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);
for (const f of ["js/data.js","js/state.js","js/chapters.js","js/balance.js","js/world.js","js/npcsim.js","js/interactions.js","js/combat.js","js/explore.js","js/loadout.js","js/dialogue.js","js/fortunes.js","js/quests.js","js/story.js","js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,"..",f),"utf8"), ctx, { filename:f });
}
const { State, Engine, STORY, DATA, Chapters } = sandbox;

function autopilotCombat() {
  let g=0;
  while (State.data.combat && g++<300) {
    const cc=Engine._combat; if(!cc)break;
    const aff=cc.affordableSpells();
    if(aff.length){const t=cc.enemies.findIndex(e=>e.alive);const e=t>=0?cc.enemies[t]:null;let ch=null;const SP=sandbox.CombatAPI.SPELLS;
      if(e){if(cc.player.hp<cc.player.hpMax*0.3&&aff.includes("tuna"))ch="tuna";else if(e.soulOnly)ch=aff.find(id=>SP[id].type==="soul");else if(!e.immunePoison&&!e.soulOnly&&!e.status.poison&&aff.includes("weidu"))ch="weidu";else if(aff.includes("feizhen"))ch="feizhen";else ch=aff.find(id=>SP[id].type==="atk");}
      if(ch){Engine.combatCast(ch,t);continue;}}
    Engine.combatEndRound();
  }
}

State.create("韩立","si");
Engine.checkStory();
let guard=0, actions=0;
const startAbs = State.absMonth();
const stagesSeen = [];
while (guard++<4000) {
  const s=State.data;
  if(s.flags.arc1_complete) break;
  if(s.combat){autopilotCombat();continue;}
  if(s._pendingInteraction){const it=s._pendingInteraction;const b=sandbox.INTERACTIONS.build(it,s);let i=b.choices.findIndex(c=>!c.cond||c.cond(s));if(i<0)i=b.choices.length-1;Engine.chooseInteraction(i);continue;}
  if(Engine._pendingFortune){const f=Engine._pendingFortune;let i=f.choices.findIndex(c=>!c.cond||c.cond(s));if(i<0)i=0;Engine.chooseFortune(i);continue;}
  if(!s.pendingEvent){const nx=STORY[s.storyStage];if(nx&&(!nx.cond||nx.cond(s))&&nx.where&&nx.where!==s.location){Engine.travelTo(nx.where);continue;}}
  if(s.pendingEvent){const st=STORY.find(x=>x.id===s.pendingEvent);if(!stagesSeen.includes(st.id)){stagesSeen.push(st.id);}
    if(st.id==="showdown"||st.id==="jinguang_fight"){if(State.count("duyao_cao")<3){s.location="houshan";Engine.gather();if(s.combat)autopilotCombat();continue;}Engine.chooseStory(st,0);if(s.combat)autopilotCombat();continue;}
    Engine.chooseStory(st,0);continue;}
  // 自由行动决策
  if(s.spirit<State.realm().spMax*0.5){Engine.rest(true);Engine.checkStory();actions++;continue;}
  const bt=Engine.canBreakthrough();
  if(bt.ok&&s.cultivation>=State.realm().culMax*0.95){if(s.spirit<State.realm().spMax*0.8){Engine.rest(true);actions++;continue;}if(s.demon>30){Engine.rest(true);actions++;continue;}Engine.attemptBreakthrough();if(s.combat)autopilotCombat();actions++;continue;}
  if(s.bottle.unlocked){const empty=s.bottle.plots.findIndex(p=>!p.crop);const ripe=s.bottle.plots.findIndex(p=>p.crop&&p.growth>=100);
    if(ripe>=0){Engine.harvestCrop(ripe);continue;}if(empty>=0&&State.count("lingcao")>=1){Engine.plantCrop(empty,"lingcao");continue;}
    const grow=s.bottle.plots.some(p=>p.crop&&p.growth<100);if(grow){Engine.tendBottle();actions++;continue;}
    if(State.count("lingyao_dan")>=1){Engine.useItem("lingyao_dan");continue;}}
  // 真实玩家：用"闭关至圆满"一键，而非逐月点击
  if(guard%5===0){Engine.adventure();if(s.combat)autopilotCombat();}
  else{const realm=State.realm();const per=Math.max(1,Math.round((14+Math.floor(s.sense*0.4))*State.root().cul*(0.6+s.mood/s.moodMax*0.6)*(1-s.demon/200)));const need=Math.max(1,Math.ceil((realm.culMax-s.cultivation)/per));Engine.doCultivate(Math.min(need,36));}
  actions++;
  Engine.checkStory();
}
const s=State.data;
console.log("=== 七玄门篇 体验审计 ===");
console.log("通关:", !!s.flags.arc1_complete, " 步数:", guard, " 行动数:", actions);
console.log("游戏内耗时:", (State.absMonth()-startAbs), "个月 ≈", ((State.absMonth()-startAbs)/12).toFixed(1), "年");
console.log("结束年龄:", Math.floor(s.age), "岁  寿元:", s.lifespan);
console.log("最终境界:", State.realm().name, " 心魔:", s.demon, " 心境:", s.mood);
console.log("经历主线阶段数:", stagesSeen.length, "->", stagesSeen.join(" / "));
console.log("风云录事件数:", (s.worldNews||[]).length, " 已识NPC:", (s.metNpcs||[]).length);
