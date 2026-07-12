/* ============================================================
 * 再别天南六战门禁：node test/zaibie.bal.js
 * polish-zaibie A4（GPT P1-8）——本站问题全在工具盲区（sweep 永走 easy 线），此门禁守四条：
 *   a) 夺舍战双线带：正典留府线（quhun_stay_jiayuan·前两战无曲魂）冷开 25~70%，
 *      带走线 ≤90%——改前断崖 1.5% vs 100%（98.5pt·全作之最），改后双线都在"恶战带"。
 *   b) 金鼓原/护山/矿洞玩家伤害占比 ≥30%（改前 17%/24%/26%=曲魂+同袍代打·玩家近乎观战）。
 *   c) 护山保护目标真实：李化元 hp≤0 → 立即判负（改前 hook 对他死亡直接 return=假保护）；
 *      且胜局里他真的会被打（末血非 99% 站桩）。
 *   d) 六战全部 fail-forward（败设 _retryAfterLoss=满血重试+累加伤害·非死局）。
 * ★ 方法（同 climax.bal·零纸面副本）：test/_loadgame.js 加载真实引擎 + playtest/save-modao-e3.json
 *   真实存档（筑基初期 ri13·真 loadout），Engine.startXxxFight 真实装配，autoResolve 蒙特卡洛。
 * ⚠ 口径：autoResolve=贪婪地板（不省底牌/不集火），真人手操更高；胜率含曲魂/同袍佐助。
 * ⚠ QUHUN 定义须与 js/story.js zaibie_a1_after 的 sideUnit 兑现值同步（改 story 侧记得改这里）。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const G = require("./_loadgame.js");
const { State, Engine } = G;

let failures = 0;
function assert(c, m) { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } }
const pct = (x) => (x * 100).toFixed(1) + "%";

function loadSave(file) {
  const raw = fs.readFileSync(path.join(__dirname, "..", "playtest", file), "utf8");
  global.localStorage.setItem("frxxz_save_v1", raw);
  if (!State.load()) throw new Error("存档读取失败: " + file);
}

// 曲魂·血刃附傀（强催档）——与 story.js zaibie_a1_after / zaibie_quhun_refine 兑现值一致
function quhunUnit() {
  return {
    id: "quhun_xieren", name: "曲魂", kind: "corpse",
    hp: 200, hpMax: 200, mp: 60, mpMax: 60,
    atk: 30, atkName: "血刃斩",
    elem: "huo", nature: "corpse", guard: 0.32, move: 1, mastery: 1,
    persona: { aggr: 8, prot: 5, kite: 2 }, status: "ok", carry: true,
    moves: [
      { name: "血刃斩", dmg: 30, weight: 12, elem: "huo", range: [1, 2], line: "曲魂血刃一闪，赤煞裂空斩向" },
      { name: "血煞噬魂", dmg: 24, weight: 7, elem: "huo", range: [1, 3], line: "曲魂吐出一道血煞，缠噬而上" },
      { name: "血遁突袭", dmg: 40, weight: 5, elem: "huo", range: [1, 4], line: "曲魂化作一道血虹，贯阵突袭" },
    ],
  };
}

/* 跑一场真实战斗 N 次。prep(s) 负责摆 flags/sideUnit，setup() 负责装配战斗。
 * 统计：胜率/胜局末血/回合/玩家伤害占比/保护目标胜局末血（watchSideId）。 */
function montecarlo(prep, setup, N, watchSideId) {
  N = N || 200;
  loadSave("save-modao-e3.json");
  const s = State.data;
  s.activeChapter = "zaibie";
  if (!s.unlockedChapters.includes("zaibie")) s.unlockedChapters.push("zaibie");
  s.location = "jiayuan_city";
  const baseFlags = JSON.stringify(s.flags);
  const baseInv = JSON.stringify(s.inventory || {});
  const baseSpells = JSON.stringify(s.spells || []);
  let wins = 0, hpSum = 0, rounds = 0, shareSum = 0, shareN = 0, wsHpSum = 0, wsN = 0;
  for (let i = 0; i < N; i++) {
    s.flags = JSON.parse(baseFlags);
    s.inventory = JSON.parse(baseInv);
    s.spells = JSON.parse(baseSpells);
    s.sideUnit = null;
    s.pendingEvent = null; s.combat = false; s.exmap = null;
    s.hp = s.hpMax;
    if (prep) prep(s);
    setup();
    const c = Engine._combat;
    if (!c) throw new Error("战斗未装配");
    const st = c.autoResolve(40);
    if (st === "win") {
      wins++; hpSum += Math.max(0, c.player.hp / c.player.hpMax);
      if (watchSideId) {
        const w = (c.sides || []).find(sd => sd.id === watchSideId);
        if (w) { wsHpSum += Math.max(0, w.hp / w.hpMax); wsN++; }
      }
    }
    rounds += c.round;
    const db = c.dealtBy || { player: 0, side: 0 };
    if (db.player + db.side > 0) { shareSum += db.player / (db.player + db.side); shareN++; }
  }
  return { win: wins / N, endHp: wins ? hpSum / wins : 0, rounds: rounds / N,
           playerShare: shareN ? shareSum / shareN : 1,
           watchHp: wsN ? wsHpSum / wsN : null };
}

console.log("\n=== 再别天南六战门禁（真引擎·save-modao-e3·autoResolve N=200 贪婪地板） ===\n");

/* —— ① 金背妖螂（入场战·留府线独力/带走线曲魂并肩——留府偏软可接受·观察行）—— */
const jbStay = montecarlo(s => { s.flags.quhun_stay_jiayuan = true; s.flags.zaibie_quhun_pending = true; },
  () => Engine.startJinbeiFight(), 120);
const jbTake = montecarlo(s => { delete s.flags.quhun_stay_jiayuan; s.sideUnit = quhunUnit(); },
  () => Engine.startJinbeiFight(), 120);
console.log(`  · 金背妖螂 留府线（独力）：胜率 ${pct(jbStay.win)} / 末血 ${pct(jbStay.endHp)} / ${jbStay.rounds.toFixed(1)}回合`);
console.log(`  · 金背妖螂 带走线（曲魂并肩）：胜率 ${pct(jbTake.win)} / 末血 ${pct(jbTake.endHp)} / 占比 ${pct(jbTake.playerShare)}（入场战偏软可接受·观察行）`);
assert(jbStay.win >= 0.5, `金背·留府线独力非死局（≥50%·${pct(jbStay.win)}）——入场战不设断崖`);

/* —— ② 夺舍战双线带（A1 主门禁·改前断崖 1.5% vs 100%）—— */
const dsStay = montecarlo(s => { s.flags.quhun_stay_jiayuan = true; s.flags.zaibie_quhun_pending = true; },
  () => Engine.startDuosheFight(), 200);
console.log(`  · 夺舍战 留府线（碎茧认主回身）：胜率 ${pct(dsStay.win)} / 末血 ${pct(dsStay.endHp)} / ${dsStay.rounds.toFixed(1)}回合`);
assert(dsStay.win >= 0.25 && dsStay.win <= 0.70,
  `夺舍战·留府线冷开落恶战带 25~70%（${pct(dsStay.win)}）——正典线不再是 1.5% 近死局（fail-forward 另有连败补偿）`);
const dsTake = montecarlo(s => { delete s.flags.quhun_stay_jiayuan; s.sideUnit = quhunUnit(); },
  () => Engine.startDuosheFight(), 200);
console.log(`  · 夺舍战 带走线（曲魂全程并肩）：胜率 ${pct(dsTake.win)} / 末血 ${pct(dsTake.endHp)} / 占比 ${pct(dsTake.playerShare)}`);
// 带沿 90→92：N=200 均值 ≈87% 但采样标准差 ≈2.4pt——90 的带沿约 20% 假红（v320 收口实测 4/20），
// 92 仍守住"不白给"（改前是 100%），统计学上安全
assert(dsTake.win <= 0.92, `夺舍战·带走线不再白给（≤92%·${pct(dsTake.win)}）——双线断崖收敛`);
assert(dsTake.win >= dsStay.win, `夺舍战·带走线仍优于留府线（${pct(dsTake.win)} ≥ ${pct(dsStay.win)}）——早年选择保有分量`);

/* —— ③ 金鼓原群战（A3：玩家占比 ≥30%·改前 17%=宋蒙钟卫娘曲魂代打）—— */
const jg = montecarlo(s => { s.sideUnit = quhunUnit(); }, () => Engine.startJinguFight(), 150);
console.log(`  · 金鼓原群战：胜率 ${pct(jg.win)} / 末血 ${pct(jg.endHp)} / 占比 ${pct(jg.playerShare)}`);
assert(jg.playerShare >= 0.30, `金鼓原·玩家伤害占比 ≥30%（${pct(jg.playerShare)}）——同袍佐阵、仗得自己打（改前 17%）`);
assert(jg.win >= 0.70, `金鼓原·群战非泥潭（≥70%·${pct(jg.win)}）——正道败局里玩家小队要赢自己那一仗`);

/* —— ④ 护山守阵（A2：保护目标真实 + A3 占比）—— */
const hs = montecarlo(s => { s.sideUnit = quhunUnit(); }, () => Engine.startHushanFight(), 150, "lihuayuan");
console.log(`  · 护山守阵：胜率 ${pct(hs.win)} / 末血 ${pct(hs.endHp)} / 占比 ${pct(hs.playerShare)} / 李化元末血 ${hs.watchHp != null ? pct(hs.watchHp) : "?"}`);
assert(hs.win >= 0.70, `护山·守住结丹长老不该经常失败（≥70%·${pct(hs.win)}）`);
assert(hs.playerShare >= 0.30, `护山·玩家伤害占比 ≥30%（${pct(hs.playerShare)}）——改前 24% 观战`);
assert(hs.watchHp != null && hs.watchHp <= 0.92 && hs.watchHp >= 0.35,
  `护山·李化元真的会被打：胜局末血 35~92%（${hs.watchHp != null ? pct(hs.watchHp) : "?"}）——改前 99.6% 站桩=假保护`);

/* —— ④b 护山保护判定：李化元被打死 → 立即判负（A2 核心断言·确定性）—— */
{
  loadSave("save-modao-e3.json");
  const s = State.data;
  s.activeChapter = "zaibie";
  if (!s.unlockedChapters.includes("zaibie")) s.unlockedChapters.push("zaibie");
  s.pendingEvent = null; s.combat = false; s.hp = s.hpMax;
  s.sideUnit = quhunUnit();
  Engine.startHushanFight();
  const c = Engine._combat;
  const li = c.sides.find(sd => sd.id === "lihuayuan");
  assert(li && li.move === 0, `护山·李化元钉桩阵眼（move=0·${li ? li.move : "?"}）——保护对象不乱跑`);
  assert(typeof c._enemyTargetBias === "function" && !!c._enemyTargetBias(c.enemies[0]) === (c.dist(c.enemies[0], li) <= 4),
    `护山·敌带毁阵偏置（_enemyTargetBias 指向李化元）——追兵是冲阵眼来的`);
  li.hp = 0;
  c._afterEnemyTick();
  assert(c.status === "lose", `护山·李化元 hp≤0 → 立即判负（status=${c.status}）——保护目标名副其实（改前 return 假保护）`);
  assert(c.deathCause && /李化元|阵眼/.test(JSON.stringify(c.deathCause)), `护山·败因点名（deathCause 落账）`);
}

/* —— ⑤ 蒙面护道（本章唯一原本成立的保护战·守住别改崩）—— */
const hd = montecarlo(s => { s.sideUnit = quhunUnit(); }, () => Engine.startHudaoFight(), 150, "nangongwan");
console.log(`  · 蒙面护道：胜率 ${pct(hd.win)} / 末血 ${pct(hd.endHp)} / 占比 ${pct(hd.playerShare)} / 南宫婉末血 ${hd.watchHp != null ? pct(hd.watchHp) : "?"}`);
assert(hd.win >= 0.55 && hd.win <= 0.97, `护道·保护张力仍在 55~97%（${pct(hd.win)}）——回归护栏`);

/* —— ⑥ 矿洞启阵（A3：占比 + 阵枢承压；换皮鬼灵门）—— */
const kd = montecarlo(s => { s.sideUnit = quhunUnit(); }, () => Engine.startKuangdongFight(), 150, "zhenshu");
console.log(`  · 矿洞启阵：胜率 ${pct(kd.win)} / 末血 ${pct(kd.endHp)} / 占比 ${pct(kd.playerShare)} / 阵枢末血 ${kd.watchHp != null ? pct(kd.watchHp) : "?"}`);
assert(kd.win >= 0.70, `矿洞·章末战非泥潭（≥70%·${pct(kd.win)}）`);
assert(kd.playerShare >= 0.30, `矿洞·玩家伤害占比 ≥30%（${pct(kd.playerShare)}）——改前 26%`);
assert(kd.watchHp != null && kd.watchHp <= 0.92, `矿洞·阵枢真承压：胜局末血 ≤92%（${kd.watchHp != null ? pct(kd.watchHp) : "?"}）——改前 77% 守住即可，别退回 99% 安全屋`);
{
  // 换皮断言（A3·黑煞教已覆灭）：追兵=鬼灵门（王蝉的人），不再是"魔修小队头目/血侍"旧皮
  loadSave("save-modao-e3.json");
  const s = State.data;
  s.activeChapter = "zaibie";
  s.pendingEvent = null; s.combat = false; s.hp = s.hpMax;
  s.sideUnit = quhunUnit();
  s.flags.zaibie_greedy = true;   // 贪婪追兵 +1 也要同步换皮
  Engine.startKuangdongFight();
  const names = Engine._combat.enemies.map(e => e.name);
  assert(names.every(n => /鬼灵门/.test(n)), `矿洞·追兵已换皮鬼灵门（${names.join("/")}）——黑煞教覆灭后账目自洽（含贪婪 extraChaser）`);
}

/* —— ⑦ fail-forward 六战全查（d 断言：败设 _retryAfterLoss=非死局）—— */
{
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  ["zb_jinbei", "zb_duoshe", "zb_jingu", "zb_hushan", "zb_hudao", "zb_kuangdong"].forEach(t => {
    const i = src.indexOf(`meta.type === "${t}"`);
    const seg = i >= 0 ? src.slice(i, i + 2600) : "";
    assert(/_retryAfterLoss/.test(seg), `${t}·fail-forward 在（败后 _retryAfterLoss 满血重试+累加伤害·非死局）`);
  });
}

console.log(`\n========== 再别天南六战门禁：${failures === 0 ? "全部通过 \u2713" : failures + " 项失败 \u2717"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
