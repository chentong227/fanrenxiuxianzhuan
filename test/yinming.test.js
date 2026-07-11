/* ============================================================
 * 阴冥·暴风山道走格图 E2E（v316）：node test/yinming.test.js
 *
 * 守什么：外海风云幕四的阴冥独立走格图（yinming_l1·返修池点名项）——
 *  ① 剧情入口（whfy_a4_shanlu → resolve yinming_map）开图不抛错
 *  ② fog 走格：村口→荒原→哨塔（登塔 reveals 三点）→ 母巢猎杀（绝灵凡人战力
 *     _mortalFighter：无法术法宝、气力小池）→ 胜=hunted+账本清结
 *  ③ 绝灵规则：走格/驻守不回灵（jueling）
 *  ④ 风口栈道出图 → whfy_yinming_done → 主线接 whfy_a4_baofeng（温天仁狭路）
 * ============================================================ */
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
sandbox.Art = new Proxy({}, { get() { return () => false; } });
sandbox.Fx = new Proxy({}, { get() { return () => {}; } });
sandbox.Sfx = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/exploremap.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine, ExploreMap, STORY } = sandbox;

let failures = 0;
const assert = (c, m) => { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } };

console.log("\n========== 阴冥·暴风山道走格图 E2E ==========\n");

// —— 起手态：直接站在 whfy_a4_shanlu 节点前（幕四·梅凝已结识）——
State.create({ name: "韩立", rootId: "si_ling" });
const s = State.data;
s.activeChapter = "waihaifengyun";
s.realmIndex = 20; s.hp = s.hpMax = 400;
s.flags.whfy_meining_done = true;
["duyao_cao", "anqi", "huixue_dan"].forEach(it => State.give(it, 5));
s.storyStage = STORY.findIndex(n => n.id === "whfy_a4_shanlu");
assert(s.storyStage >= 0, "whfy_a4_shanlu 节点存在于主线序");

// ① 剧情入口开图
Engine.checkStory();
assert(s.pendingEvent === "whfy_a4_shanlu", "上山之路节点派发（pendingEvent）");
const stage = STORY.find(n => n.id === "whfy_a4_shanlu");
Engine.chooseStory(stage, 0);   // resolve: yinming_map
assert(!!s.exmap, "选「踏上灰白荒原」→ 阴冥走格图开启（s.exmap）");
assert(s.exmap.stack[0].mapId === "yinming_l1", "开的是 yinming_l1");
assert(s.flags.whfy_shanlu_done, "节点 flag 已立（skipIf 可越过·防死链）");

// ② fog 走格 + 登塔揭雾
const f0 = ExploreMap.cur(s.exmap);
assert(f0.node === "cun", "入口=阴冥村");
const spiritBefore = s.spirit;
Engine.exmapTravel("huiyuan");
assert(ExploreMap.cur(s.exmap).node === "huiyuan", "走到灰白荒原");
// ③ 绝灵：走格不回灵
assert(s.spirit === spiritBefore, "绝灵规则：走格不回灵（jueling）");
Engine.exmapGather();
assert((s.exmap.bag.anqi || 0) >= 3, "荒原采集：暗器入袋");
Engine.exmapTravel("shaota");
const fS = ExploreMap.cur(s.exmap);
assert(["visited", "glimpsed", "rumored"].includes(ExploreMap.fogState(s.exmap, "zhandao")), "登戍风哨塔：风口栈道已揭出雾");
assert(ExploreMap.fogState(s.exmap, "chao") !== "unknown", "登塔后阴兽母巢可见");

// ④ 母巢猎杀（绝灵凡人战力）
Engine.exmapTravel("chao");
Engine.exmapHunt();
assert(!!Engine._combat, "母巢猎杀开战");
const p = Engine._combat.player;
assert(p.mpMax <= 40, "凡人战力：气力小池（_mortalFighter）");
assert((p.spells || []).includes("zhayan") && !(p.spells || []).includes("qingyuan_jianmang"), "凡人战力：武学在手、法术剥离");
assert(Engine._combat.enemies.some(e => /老兽/.test(e.name)), "母巢之主（带甲老兽）在场");
// 速胜
const c = Engine._combat;
let g = 0;
while (c.status === "ongoing" && g++ < 30) {
  c.enemies.forEach(e => { e.hp = 0; });
  if (typeof c._checkEnd === "function") c._checkEnd();
  if (c.status === "ongoing" && typeof c.endRound === "function") c.endRound();
}
if (c.status === "ongoing") c.status = "win";
Engine._finishCombat();
assert(s.flags.whfy_chao_hunted, "母巢伏诛 flag");
assert(!!s.exmap, "战后回图（exmapFightReturn）");
assert(ExploreMap.cur(s.exmap).hunted.chao, "巢穴 hunted 入账（可搜刮）");
assert((s.milestones || []).some(m => /阴兽母巢/.test(m.title || "")), "长老之托清结（母巢里程碑入账）");
Engine.exmapGather();
assert((s.exmap.bag.lingshi || 0) >= 4, "母巢搜刮：坠雾者遗物入袋");

// ⑤ 风口栈道出图 → 接主线温天仁狭路
Engine.exmapTravel("yanwo");
Engine.exmapTravel("zhandao");
Engine.finishExmap("leave");
assert(!s.exmap, "出图（风口栈道）");
assert(s.flags.whfy_yinming_done, "阴冥走格段完成 flag");
assert(State.count("anqi") >= 8, "行囊结算：采得的暗器已入库");
assert(s.pendingEvent === "whfy_a4_baofeng", "出图即接主线：温天仁狭路（whfy_a4_baofeng）");

console.log(`\n========== 阴冥走格图 E2E：${failures === 0 ? "全部通过 \u2713" : failures + " 项失败 \u2717"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
