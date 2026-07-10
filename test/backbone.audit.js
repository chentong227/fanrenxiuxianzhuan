/* ============================================================
 * 主干无死链审计（星海盲区护栏）：node test/backbone.audit.js
 *
 * 立项：红尘劫死链事故（v290）——chooseStory 严格 storyStage+1，节点物理序与 cond 链
 *   不一致即卡死。journey.test 只覆盖到魔道第三幕；魔道第四幕(皇宫)→再别天南→初入星海
 *   →星海飞驰(含红尘劫) 是 E2E 盲区——红尘劫死链正是在这里漏网。
 *
 * 做什么：真引擎从【魔道第三幕已收口】态起跳（journey.test 的终点·已被证明可达），
 *   通用驱动这条"纯剧情选择+战斗"的尾段——选项选第一个可用项、战斗速胜（含 survive/波次）、
 *   时间锚(*_due)/rippleWindow 清零、节点 where 对位——直到 STORY 走完。
 *   任一节点"无 pending 无战斗且 storyStage 不前进"=死链嫌疑 → FAIL 报出卡点。
 *
 * 注：七玄门内修/黄枫谷血色禁地·炼丹·突破等"引擎动作驱动"段不在此（journey.test 已手驱覆盖，
 *   且非纯选择无法通用驱动）；本审计专守 journey.test 之后的星海盲区死链。
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
// 无头桩：引擎/战斗装配里直接用到的全局（浏览器中由 art.js/fx.js 提供；此处只需不抛错）
sandbox.Art = new Proxy({}, { get() { return () => false; } });   // Art.has()/cg()/hasBattler() → false
sandbox.Fx = new Proxy({}, { get() { return () => {}; } });
sandbox.Sfx = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/exploremap.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine, STORY } = sandbox;

let failures = 0;
const assert = (c, m) => { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } };

function winCombat() {
  const c = Engine._combat; if (!c) return;
  let g = 0;
  while (c.status === "ongoing" && g++ < 40) {
    (c.enemies || []).forEach(e => { e.hp = 0; });
    if (c._pendingEnemyWaves && c._pendingEnemyWaves.length) { c._maybeSpawnWave(); continue; }
    if (typeof c._checkEnd === "function") c._checkEnd();
    if (c.status !== "ongoing") break;
    if (typeof c.endRound === "function") c.endRound(); else break;   // survive：撑回合到胜
  }
  if (c.status === "ongoing") c.status = "win";
  if (typeof Engine._finishCombat === "function") Engine._finishCombat();
}

console.log("\n========== 主干无死链审计·星海盲区（魔道四幕→再别→初入星海→星海飞驰） ==========\n");

// 从【魔道第三幕收口】态起跳（= journey.test 终点）
State.create({ name: "韩立", rootId: "si_ling" });
const s = State.data;
s.activeChapter = "modao";
s.unlockedChapters = ["qixuan", "huangfeng", "modao"];
s.realmIndex = 12;             // 筑基初（魔道篇境界）
s.hp = s.hpMax = 200;
s.technique = "qingyuan_sword";
s.flags.modao_act3_done = true;
s.flags.modao_act4_due = 0;
s.flags.jingcheng_intel = 2;   // 情报拉满→刘靖示警 live 支线（皇宫决战刘靖在场）
// 尾段会用到的 requireItem / 关键物兜底（不验数值·只为不被选项不可用卡住）
["qingming_zhen", "jinguang_zhuan_charge", "jinguang_zhuan", "huixue_dan", "dingshen_fu",
 "tianlei_zhu", "xutian_tucan", "jinleizhu", "qingzhu_fengyun_jian", "boluo_zhu",
 "huangling_jia", "qingming_zhen", "butian_dan", "yanghun_mu"].forEach(it => { try { State.give(it, 2); } catch (e) {} });
s.storyStage = STORY.findIndex(n => n.id === "modao_e4_shenxun");
if (STORY[s.storyStage] && STORY[s.storyStage].where) s.location = STORY[s.storyStage].where;

const ms = { e4: false, xuwang: false, zaibie: false, starsea: false, xinghai: false, hongchenOpen: false, hongchenDone: false, lianjian: false, xutian: false, arc6: false, whfy: false, whfyA1: false };
let steps = 0, stuck = 0, deadlock = null, maxStage = 0;
const visited = new Set();

while (steps++ < 1500) {
  if (s.combat && Engine._combat) { winCombat(); stuck = 0; continue; }
  if (Engine._pendingFortune) { Engine.chooseFortune(0); stuck = 0; continue; }
  if (s.exmap) {   // 尾段一般无箱庭；若有，结束会话避免卡住
    try { Engine.exmapLeave && Engine.exmapLeave(); } catch (e) {}
    if (s.exmap) { s.exmap = null; }
    stuck = 0; continue;
  }
  if (s.pendingEvent) {
    visited.add(s.pendingEvent);
    const ch = s.activeChapter;
    if (ch === "modao") ms.e4 = true;
    if (ch === "zaibie") ms.zaibie = true;
    if (ch === "starsea") ms.starsea = true;
    if (ch === "xinghaifeichi") ms.xinghai = true;
    if (s.pendingEvent === "modao_e4_xuwang") ms.xuwang = true;
    if (s.pendingEvent === "xh_a3_hongchen_open") ms.hongchenOpen = true;
    if (s.pendingEvent === "xh_a3_lianjian") ms.lianjian = true;
    if (s.pendingEvent === "xh_a4_hanli") ms.xutian = true;
    const st = STORY.find(x => x.id === s.pendingEvent);
    if (!st) { deadlock = "pending 无对应节点: " + s.pendingEvent; break; }
    let ci = 0;
    const chs = typeof st.choices === "function" ? st.choices(s) : st.choices;
    if (Array.isArray(chs) && chs.length) { const ok = chs.findIndex(c => !c.requireItem || State.count(c.requireItem) > 0); ci = ok >= 0 ? ok : 0; }
    try { Engine.chooseStory(st, ci); } catch (e) { deadlock = `chooseStory(${st.id}) 抛错: ${e.message}`; break; }
    if (s.flags.xh_a3_hongchen_done) ms.hongchenDone = true;
    if (s.flags.arc6_complete) ms.arc6 = true;
    if (s.flags.whfy_open) ms.whfy = true;
    if (s.flags.whfy_a1_done) ms.whfyA1 = true;
    stuck = 0; continue;
  }
  // 无 pending 无战斗：清时间锚 + 对位地点 + 资粮兜底，推进主线
  Object.keys(s.flags || {}).forEach(k => { if (/_due$/.test(k) && typeof s.flags[k] === "number") s.flags[k] = 0; });
  if (s.rippleWindow) s.rippleWindow = null;
  const nx = STORY[s.storyStage];
  if (nx && nx.where && s.location !== nx.where) s.location = nx.where;
  s.cultivation = 9e8; if (s.spirit != null) s.spirit = 9e8; s.mood = s.moodMax || 100; s.demon = 0;
  if (s.hp <= 0) s.hp = s.hpMax;
  const before = s.storyStage;
  try { Engine.checkStory(); } catch (e) { deadlock = `checkStory@stage${s.storyStage}(${nx ? nx.id : "?"}) 抛错: ${e.message}`; break; }
  maxStage = Math.max(maxStage, s.storyStage);
  if (!s.pendingEvent && !s.combat && !s.journey && !Engine._pendingFortune && !s.exmap) {
    if (s.storyStage === before) {
      // 兜底①突破门槛：realmIndex<22 抬一级（金丹/结丹大成等渡劫动作门槛）
      if (s.realmIndex < 22) s.realmIndex++;
      // 兜底②时间门槛：部分节点 cond 需 absMonth 推移（如妙音门「2 月后」）——推月
      if (typeof Engine.passTime === "function") { try { Engine.passTime(1); } catch (e) {} }
      stuck++;
      if (s.storyStage >= STORY.length) break;   // 走完全部节点
      if (stuck > 16) {   // 给足升境(≤10级)+推月余量；仍不动=真死链
        const dn = STORY[s.storyStage];
        deadlock = dn ? `storyStage=${s.storyStage} 卡在「${dn.id}」——cond 不满足且 skipIf 不跳（死链嫌疑）` : `storyStage=${s.storyStage} 越界`;
        break;
      }
      continue;
    } else stuck = 0;
  } else stuck = 0;
}

console.log(`驱动 ${steps} 步，maxStage=${maxStage}/${STORY.length}，经过节点 ${visited.size} 个`);
console.log(`末态：chapter=${s.activeChapter} stage=${s.storyStage} pending=${s.pendingEvent || "(无)"}\n`);
assert(ms.e4, "魔道第四幕可达（皇宫决战段）");
assert(ms.xuwang, "胥王决战节点可达（modao_e4_xuwang）");
assert(ms.zaibie, "推进至再别天南篇");
assert(ms.starsea, "推进至初入星海篇");
assert(ms.xinghai, "推进至星海飞驰篇");
assert(ms.hongchenOpen, "红尘劫开场可达（xh_a3_hongchen_open）");
assert(ms.hongchenDone, "红尘劫渡过·情侣→小龙→老者→渡过全链贯通（死链回归守护）");
assert(ms.lianjian, "青竹蜂云剑炼成可达（xh_a3_lianjian）");
assert(ms.xutian, "虚天殿寒骊台可达（xh_a4_hanli）");
assert(ms.arc6, "星海飞驰章末·四大势力追杀·arc6 收口（xh_arc6_complete）");
assert(ms.whfy, "外海风云篇开篇可达（whfy_a1_open·孤崖蛰伏）");
assert(ms.whfyA1, "外海风云·幕一全链贯通（公孙杏→立威→拍卖会→whfy_a1_done）");
assert(!deadlock, deadlock ? ("发现卡点/死链：" + deadlock) : "魔道四幕→再别→初入星海→星海飞驰→外海风云幕一 主干无死链、无缺派发、无抛错");

console.log(`\n========== 星海盲区无死链审计：${failures === 0 ? "全部通过 \u2713" : failures + " 项失败 \u2717"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
