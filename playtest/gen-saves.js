/* ============================================================
 * playtest/gen-saves.js — 各篇章边界存档生成
 * 复用 journey.test.js 引擎驱动，在每个篇章收口处 dump 存档。
 * 用法：node playtest/gen-saves.js
 *   输出：playtest/save-<chapter>.json（可直接 localStorage.setItem 载入）
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const OUT = __dirname;

const store = {};
const sandbox = {
  console, Math, Date, window: {},
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  setTimeout: () => 0, clearTimeout: () => {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.UI = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);

for (const f of [
  "js/data.js", "js/state.js", "js/chapters.js", "js/balance.js",
  "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js",
  "js/explore.js", "js/exploremap.js", "js/loadout.js", "js/dialogue.js",
  "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"
]) {
  const code = fs.readFileSync(path.join(ROOT, f), "utf8");
  vm.runInContext(code, ctx, { filename: f });
}

const { State, Engine, STORY, WORLD, Loadout, ExploreMap: EM, Chapters } = sandbox;

function save(tag) {
  const s = JSON.parse(JSON.stringify(State.data));
  const file = path.join(OUT, `save-${tag}.json`);
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
  console.log(`  ✓ ${file} (storyStage=${s.storyStage}, loc=${s.location}, flags=${Object.keys(s.flags).filter(k=>s.flags[k]).length})`);
}

function speedCombat() {
  if (!State.data.combat || !Engine._combat) return;
  Engine._combat.enemies.forEach(e => { e.hp = 0; });
  Engine._combat._checkEnd();
  if (Engine._combat.status !== "ongoing") Engine._finishCombat();
}

function travelTo(dest) {
  Engine.startJourney(dest);
  let g = 0;
  const s = State.data;
  while ((s.journey || Engine._pendingFortune) && g++ < 40) {
    if (Engine._pendingFortune) { Engine.chooseFortune(0); continue; }
    if (s.combat && Engine._combat) { speedCombat(); continue; }
    break;
  }
}

function playStage(id, choice) {
  const stage = STORY.find(x => x.id === id);
  if (!stage) { console.log(`  ✗ stage not found: ${id}`); return; }
  Engine.chooseStory(stage, choice || 0);
  if (State.data.combat && Engine._combat) speedCombat();
}

// ========== 七玄门篇 (已有 save-qixuan.json) ==========
console.log("\n--- 七玄门篇 起点 ---");
State.create({ name: "韩立", rootId: "si_ling" });
// save-qixuan.json 已存在，跳过（直接用已有的）

// ========== 离门远行篇 ==========
console.log("\n--- 离门远行篇 ---");
State.create({ name: "韩立", rootId: "si_ling" });
const s = State.data;
s.location = "yaolu"; s.pendingEvent = null;
s.storyStage = STORY.findIndex(st => st.id === "mo_arrive");
s.flags.arc1_complete = true; s.flags.han_du = true;
State.give("shengxian_ling", 1);
s.realmIndex = 5; s.hp = 120; s.hpMax = 120; s.silver = 40;
s.sideUnit = { id: "zhangtie_corpse", name: "铁奴·张铁", hp: 70, hpMax: 70, atk: 12,
               atkName: "尸傀挥击", nature: "corpse", guard: 0.3, status: "ok", carry: true };
// 嘉元城
travelTo("jiayuan");
Engine.checkStory(); playStage("mo_arrive");
Engine.passTime(1); Engine.checkStory(); playStage("mo_crisis");
Engine.checkStory(); playStage("mo_resolve");
// 太南小会
State.give("lingshi", 12); s.journey = null;
travelTo("tainangu");
Engine.checkStory(); playStage("wan_meet");
Engine.fairBuy("changchun_houpian");
Engine.checkStory(); playStage("qingwen_plot");
s.activeChapter = "huangfeng"; s.unlockedChapters = ["qixuan", "huangfeng"];
s.realmIndex = 6; s.cultivation = 999999;
Loadout.learnTechnique(s, "changchun_full");
s.activeChapter = "qixuan";
// 升仙大会
while (sandbox.State.absMonth() < (s.flags.xianhui_due || 0) - 1) Engine.passTime(1);
Engine.checkStory(); playStage("wan_hunt");
while (sandbox.State.absMonth() < s.flags.xianhui_due) Engine.passTime(1);
Engine.checkStory(); playStage("xianhui_open");
Engine.checkStory(); playStage("wan_death");
Engine.checkStory(); playStage("xianhui_end");

save("departure");

// ========== 黄枫谷篇 ==========
console.log("\n--- 黄枫谷篇 ---");
travelTo("huangfeng");
Engine.checkStory(); playStage("hf_arrive");
Engine.checkStory(); playStage("hf_duodan");
Engine.checkStory(); playStage("hf_zhangmen");
Engine.checkStory(); playStage("hf_yaoyuan");
Engine.yaoyuanWork(); Engine.chooseFortune(0);
// 坊市归途
s.realmIndex = 10; State.give("lingshi", 5); Engine.wanbaoBuy("huixue_dan");
Engine.checkStory(); playStage("chen_rescue");
playStage("chen_after", 1); // 不喂忘尘丹
s.pendingEvent = null;
// 法器
State.give("qiannian_lingcao", 2);
Engine.wanbaoSell("qiannian_lingcao"); Engine.wanbaoSell("qiannian_lingcao");
Engine.wanbaoBuy("jinfuzi_ren"); Engine.equipGear("jinfuzi_ren");
State.give("xuantie_dun", 1); Engine.equipGear("xuantie_dun");
// 血色禁地
Engine.chooseStory(STORY.find(x => x.id === "jindi_meeting"), 0);
Engine.exmapTravel("waipu_d"); Engine.exmapGather();
Engine.exmapTravel("zhongtan");
speedCombat();
Engine.exmapGather();
Engine.exmapTravel("guzhen"); Engine.exmapReadLore();
s.realmIndex = 12;
Engine.equipGear("tayun_xue");
Engine.exmapTravel("shentan"); Engine.exmapEnterSub(); Engine.chooseFortune(0);
Engine.exmapCaveMove(7); Engine.exmapCaveTake("zhuyao1");
Engine.exmapCaveMove(17);
State.give("zhenqi_kunzu", 1); State.give("huoshe_fu", 2);
Engine.exmapCavePlace("kunzu", 16);
Engine.exmapCaveMove(19);
Engine.exmapCavePlace("anfu", 21);
Engine.exmapCaveMove(21);
Engine.exmapCaveStrike("huoshe_fu");
Engine.combatTake("laozh");
Engine._combat.enemies.forEach(e => { e.hp = 0; });
Engine._combat._checkEnd(); Engine._finishCombat();
if (!s.pendingEvent) Engine.checkStory();
playStage("mojiao_after");
// 筑基
s.location = "huangfeng_gate"; State.give("lingcao", 6); Engine.lianZhujiDan();
s.pendingEvent = null; s.realmIndex = 12;
s.cultivation = State.realm().culMax; s.spirit = State.realm().spMax;
s.mood = s.moodMax; s.demon = 0;
let tries = 0;
while (State.realm().tier !== "foundation" && tries++ < 30) {
  Engine.attemptBreakthrough();
  if (s.combat && Engine._combat) speedCombat();
  s.cultivation = State.realm().culMax; s.spirit = State.realm().spMax;
  s.mood = s.moodMax; s.demon = 0;
  if (!State.count("zhuji_dan")) State.give("zhuji_dan", 1);
}
if (s.pendingEvent === "qingyuan_gift") playStage("qingyuan_gift");
if (!s.pendingEvent) Engine.checkStory();
playStage("dongfu_pick");
// 元武国代工
if (State.count("mojiao_pi") < 1) State.give("mojiao_pi", 1);
if (State.count("mojiao_jiao") < 1) State.give("mojiao_jiao", 1);
State.give("qiannian_lingcao", 1);
s.location = "yuanwu"; Engine.checkStory();
playStage("qiyunxiao_daigong");
// 叶师叔收口
s.location = "huangfeng_gate";
if (!s.pendingEvent) Engine.checkStory();
playStage("ye_finale");

save("huangfeng");

// ========== 燕家堡之战 ==========
console.log("\n--- 燕家堡之战 ---");
if (!s.pendingEvent) Engine.checkStory();
playStage("yanjia_summon");
playStage("yanjia_reunion");
playStage("yanjia_boss");
if (!s.pendingEvent) Engine.checkStory();
playStage("yanjia_escape");

save("yanjiabao");

// ========== 魔道争锋·第一幕 ==========
console.log("\n--- 魔道争锋·第一幕 ---");
s.flags.modao_call_due = 0;
Engine.checkStory(); playStage("modao_e1_conscript");
playStage("modao_e1_betray");
playStage("modao_e1_spider");
s.ledger.chen_wangchen = "（测试·喂过忘尘丹·她已不识）";
playStage("modao_e1_fortune");
playStage("modao_e1_chen_forgot");

save("modao-e1");

// ========== 魔道争锋·第二幕 ==========
console.log("\n--- 魔道争锋·第二幕 ---");
s.flags.modao_act2_due = 0;
Engine.checkStory(); playStage("modao_e2_muster");
playStage("modao_e2_patrol");
playStage("modao_e2_dongxuaner");
playStage("modao_e2_nangongwan");
playStage("modao_e2_jingcheng");

save("modao-e2");

// ========== 魔道争锋·第三幕 ==========
console.log("\n--- 魔道争锋·第三幕 ---");
s.flags.modao_act3_due = 0;
Engine.checkStory(); playStage("modao_e3_rujing");
playStage("modao_e3_shizong");
playStage("modao_e3_yanhui");
playStage("modao_e3_tieluo");
playStage("modao_e3_tieluo2");
playStage("modao_e3_wuse");
playStage("modao_e3_farewell");

save("modao-e3");

console.log("\n========== 存档生成完成 ==========");
console.log("文件列表：");
const files = fs.readdirSync(OUT).filter(f => f.startsWith("save-") && f.endsWith(".json"));
files.forEach(f => console.log(`  playtest/${f}`));
