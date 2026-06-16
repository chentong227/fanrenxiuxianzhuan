/* ============================================================
 * 异闻录图鉴 无头测试：node test/yiwen.test.js
 *  (1) WORLD.yiwen 结构守恒：id 唯一 / type 合法 / guide 非空 / effects ⊆ 七效菜单
 *  (2) 链 id 指向真实既有 id（守恒）：beastRumor→beastRumors+enemies｜ripple→_RIPPLES｜item→DATA.items｜story→非空串
 *  (3) exploreSites.beastPool 每个 id 都是真实异闻妖王（区域守恒）；houshan 池 ⊆ 全异闻池
 *  (4) Engine._yiwenState 对三种卡态（未闻/风声在耳/已了）派生正确且不抛
 *  (5) yiwenSeen 旧档兜底：_migrate 后必为数组
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
const ctx = vm.createContext(sandbox);
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine, WORLD, DATA } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }

const Y = WORLD.yiwen || [];
const FX_MENU = new Set(["指路", "识弱", "召援", "悬赏", "备战", "避坑", "借物"]);
const TYPES = new Set(["beast", "material", "intel"]);
const beastIds = new Set(WORLD.beastRumors.map(r => r.id));
const rippleIds = new Set(Engine._RIPPLES.map(r => r.id));

console.log("\n=== 1. WORLD.yiwen 结构守恒 ===");
{
  assert(Y.length > 0, "WORLD.yiwen 非空（共 " + Y.length + " 条）");
  const ids = Y.map(e => e.id);
  assert(new Set(ids).size === ids.length, "id 唯一（无重复）");
  const badType = Y.filter(e => !TYPES.has(e.type)).map(e => e.id);
  assert(badType.length === 0, "type 合法 beast|material|intel（异：" + (badType.join("、") || "无") + "）");
  const emptyGuide = Y.filter(e => !e.guide || !String(e.guide).trim()).map(e => e.id);
  assert(emptyGuide.length === 0, "每条 guide 非空（空：" + (emptyGuide.join("、") || "无") + "）");
  const emptyExist = Y.filter(e => !e.exist || !String(e.exist).trim()).map(e => e.id);
  assert(emptyExist.length === 0, "每条 exist（客观入口）非空（空：" + (emptyExist.join("、") || "无") + "）");
  const badFx = Y.filter(e => (e.effects || []).some(x => !FX_MENU.has(x))).map(e => e.id);
  assert(badFx.length === 0, "effects 全部 ⊆ 七效菜单（越界：" + (badFx.join("、") || "无") + "）");
}

console.log("\n=== 2. 链 id 守恒（指向真实既有 id）===");
{
  const broken = [];
  for (const e of Y) {
    const lk = e.link || {};
    let ok = false;
    if (lk.kind === "beastRumor") ok = beastIds.has(lk.id) && !!WORLD.enemies[lk.id];
    else if (lk.kind === "ripple") ok = rippleIds.has(lk.id);
    else if (lk.kind === "item") ok = !!DATA.items[lk.id];
    else if (lk.kind === "story") ok = typeof lk.id === "string" && lk.id.length > 0;
    if (!ok) broken.push(e.id + "→" + lk.kind + ":" + lk.id);
  }
  assert(broken.length === 0, "每条 link 指向真实既有 id（断链：" + (broken.join("、") || "无") + "）");
  // 妖王类必为异闻妖王或剧情大妖（story）
  const badBeast = Y.filter(e => e.type === "beast" && !(e.link.kind === "beastRumor" || e.link.kind === "story")).map(e => e.id);
  assert(badBeast.length === 0, "妖王条目 link.kind ∈ {beastRumor,story}（异：" + (badBeast.join("、") || "无") + "）");
}

console.log("\n=== 3. exploreSites.beastPool 区域守恒 ===");
{
  const bad = [];
  for (const [sid, cfg] of Object.entries(DATA.exploreSites)) {
    for (const bid of (cfg.beastPool || [])) {
      if (!beastIds.has(bid) || !WORLD.enemies[bid]) bad.push(sid + ":" + bid);
    }
  }
  assert(bad.length === 0, "每个 beastPool id 都是真实异闻妖王（异：" + (bad.join("、") || "无") + "）");
  const hou = DATA.exploreSites.houshan_explore.beastPool || [];
  assert(hou.length > 0 && hou.every(id => beastIds.has(id)), "houshan_explore.beastPool ⊆ 全异闻池（彩霞山一带不串场）");
  // 黄枫谷新妖王不在彩霞山池里（区域不串）
  assert(!hou.includes("yinjia_jiaomang") && !hou.includes("guwai_yaowang"), "黄枫谷妖王不混入彩霞山后山池");
}

console.log("\n=== 4. Engine._yiwenState 三卡态派生（不抛 + 正确）===");
{
  // 全新存档：除被 create 自然触发者外，应多为 unseen，且任意一条不抛
  State.create("韩立", "si");
  let noThrow = true, statesValid = true;
  for (const e of Y) {
    let st;
    try { st = Engine._yiwenState(e, State.data); } catch (err) { noThrow = false; st = null; }
    if (!["done", "active", "unseen"].includes(st)) statesValid = false;
  }
  assert(noThrow, "全新存档：每条 _yiwenState 不抛异常");
  assert(statesValid, "返回值恒 ∈ {done,active,unseen}");

  // 风声在耳：listen 到 beast_chimu → active
  State.create("韩立", "si");
  State.data.beastRumor = "beast_chimu";
  Engine._seeYiwen("beast_chimu");
  const chimu = Y.find(e => e.id === "beast_chimu");
  assert(Engine._yiwenState(chimu, State.data) === "active", "听闻异闻 → 风声在耳(active)");

  // 已了：beast_chimu 伏诛 → done
  State.create("韩立", "si");
  State.data.slainBeasts = ["beast_chimu"];
  assert(Engine._yiwenState(chimu, State.data) === "done", "妖王伏诛 → 已了(done)");

  // 已了：ripple 完成 → done
  State.create("韩立", "si");
  State.data.doneRipples = ["hunter_lost"];
  const hl = Y.find(e => e.id === "hunter_lost");
  assert(Engine._yiwenState(hl, State.data) === "done", "涟漪了结 → 已了(done)");

  // 风声在耳：ripple 进行中 → active
  State.create("韩立", "si");
  State.data.ripple = { id: "pill_theft", stage: 0, nextAbs: 99 };
  Engine._seeYiwen("pill_theft");
  const pt = Y.find(e => e.id === "pill_theft");
  assert(Engine._yiwenState(pt, State.data) === "active", "涟漪起链 → 风声在耳(active)");

  // 已了：item 在袋 → done（hanyancao）
  State.create("韩立", "si");
  State.give("hanyancao", 1);
  const han = Y.find(e => e.id === "hanyancao");
  assert(Engine._yiwenState(han, State.data) === "done", "材料入袋 → 已了(done)");

  // 已了：doneFlag 兜底（材料已消耗但 flag 为真）——血色主药 doneFlag=mojiao_slain
  State.create("韩立", "si");
  State.data.flags.mojiao_slain = true;
  const xz = Y.find(e => e.id === "xueshi_zhuyao");
  assert(Engine._yiwenState(xz, State.data) === "done", "doneFlag 兜底：消耗后凭 flag 记已了");

  // 前路剪影：oyft（flag 永不置）→ 恒 unseen（引导剪影）
  State.create("韩立", "si");
  const oyft = Y.find(e => e.id === "oyft");
  assert(Engine._yiwenState(oyft, State.data) === "unseen", "欧阳飞天前路剪影 → 恒未闻(给引导)");

  // _seeYiwen 幂等去重
  State.create("韩立", "si");
  Engine._seeYiwen("beast_chimu"); Engine._seeYiwen("beast_chimu");
  assert(State.data.yiwenSeen.filter(x => x === "beast_chimu").length === 1, "_seeYiwen 幂等去重");
}

console.log("\n=== 5. yiwenSeen 旧档兜底 ===");
{
  State.create("韩立", "si");
  delete State.data.yiwenSeen;          // 模拟旧档无此字段
  State._migrate();
  assert(Array.isArray(State.data.yiwenSeen), "_migrate 后 yiwenSeen 必为数组");
}

console.log(`\n========== 异闻录图鉴：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
