/* Build 路线平衡校验（build-balance-design.md §4.3 落地·真实存档三档版 · polish-huangfeng D5）。
 *
 * ⚠ 三路**刻意不对称**（drift-audit #2·2026-06-30 用户拍板「非对称三路」）：剑道=直接战力乘区(layerMul/
 *   剑势)、丹道=底牌制造路(丹药/秘仪余丹)、阵法=控场路(符箓/阵旗/里程碑)。故不设"胜率差≤10%"的对称断言。
 *
 * ── Part A：剑道 layerMul 战力线不变量（铁律4 标度尺·历史断言原样保留）──
 *
 * ── Part B：真实存档三档对比（polish-huangfeng D5·GPT P1-7）──
 *   等效时间律：三档各投入 30 月（月数必须相同），产物按引擎真实费率折算后«装配»进
 *   save-huangfeng-jindi.json（练气十一层·血色禁地口径），真引擎跑三场高潮战蒙特卡洛：
 *     剑道 30 月＝坊市切磋/实战磨剑（剑意+3/月×27）+悟剑闭关 3 月 → 眨眼剑法大成（连环眨眼/剑势×2/上限7）
 *     丹道 30 月＝药园+地火炼药（药理+2/月→+60）→ 里程碑全开+战内丹药底牌+凝神丹压魔+秘仪余丹 3 颗（B1②）
 *     阵法 30 月＝制符台（制符+2/月→+60·产约一符/月）→ 里程碑+定身/火蛇/寒冰符+困足/聚灵阵旗满袋
 *   三场：封岳（狙杀者·阵法擅场——定身/困足拆「贯心刺」）/ 墨蛟（boss 消耗战·剑道擅场——剑势零耗灵）
 *        / 筑基心魔劫（丹道擅场——余丹薄瓶颈+凝神丹厚道心）。
 *   auto 策略对三档一视同仁（贪婪 AI + 同一套底牌手操：嗑药/回元/定身拆蓄势/聚灵续航/剑势倾泻）。
 *   断言原则＝各档在擅长场景不输人、没有一档全场垫底（按 2026-07-12 实测分布定标·带 8pt 采样容差）。
 *
 * 用法：node test/build.bal.js（exit 0=全过）。改 balance.js layerMul / 三路战力线 / 高潮战数值必跑。
 */
const fs = require("fs");
const path = require("path");
const G = require("./_loadgame.js");
const { State, Engine, DATA, Balance } = G;

const fails = [];
function assert(cond, msg) { if (cond) console.log("  \u2713 " + msg); else { console.log("  \u2717 \u5931\u8d25: " + msg); fails.push(msg); } }
const pct = x => (x * 100).toFixed(0) + "%";

/* ================= Part A：剑道 layerMul 不变量 ================= */
console.log("\n=== Part A · 剑道 layerMul 战力线不变量 ===\n");
{
  const MAX = 9;
  let prev = -1, mono = true;
  for (let L = 1; L <= MAX; L++) {
    const m = Balance.layerMul(L, MAX);
    if (m < prev) mono = false;
    prev = m;
  }
  assert(mono, "单调性：层数越高 layerMul 不降（同门功法逐层精进）");
  const peak = Balance.layerMul(MAX, MAX);
  assert(peak <= 1.35 + 1e-9 && peak > 1.0, `峰值受控：满层乘子 ${peak.toFixed(3)} ∈ (1, 1.35]（不喧宾夺主盖过大境界跨度）`);
  assert(Math.abs(Balance.layerMul(1, MAX) - 1) < 1e-9, "起点归一：入门层乘子=1（A2 练气期零扰动）");
  assert(Balance.layerMul(1, 1) === 1 && Balance.layerMul(5, 0) === 1, "单层/缺 maxLayers 不放大");
}

/* ================= Part B：真实存档三档对比 ================= */
function loadSave(file) {
  const raw = fs.readFileSync(path.join(__dirname, "..", "playtest", file), "utf8");
  global.localStorage.setItem("frxxz_save_v1", raw);
  if (!State.load()) throw new Error("存档读取失败: " + file);
}

const MONTHS = 30;   // 等效时间律：三档投入月数必须相同
const BUILDS = {
  base: {
    label: "基线（无投入）", months: MONTHS, extraDan: 1,
    apply() {},   // 参照系：同一存档、零 build 投入——"投入在擅长场景必须有回报"的锚
  },
  sword: {
    label: "剑道", months: MONTHS, extraDan: 1,
    // 30月＝切磋/实战磨剑意（+3/月×27≈100）+悟剑闭关 3 月 → 大成（引擎费率：spar 剑意+3、doWujian 3月）
    apply(s) {
      s.swordIntent = 100; s.swordMastery = true;
      if (!s.knownSkills.includes("lianhuan")) s.knownSkills.push("lianhuan");
      if (!s.spells.includes("lianhuan")) s.spells.push("lianhuan");
    },
  },
  dan: {
    label: "丹道", months: MONTHS, extraDan: 3,   // 药理高→地火一炉高产（B1②：秘仪余丹上限 3）
    apply(s) {
      s.skills.alchemy = (s.skills.alchemy || 0) + MONTHS * 2;   // 药园/炼药 +2/月
      ["dan_ms_jinchuang", "dan_ms_bianyao", "dan_ms_anshen", "dan_ms_chunqing"].forEach(f => { s.flags[f] = true; });
      const inv = s.inventory;
      inv.huixue_dan = (inv.huixue_dan || 0) + 8;
      inv.huiyuan_dan = (inv.huiyuan_dan || 0) + 6;
      inv.ningshen_dan = (inv.ningshen_dan || 0) + 4;
      // 自炼凝神丹（dan_ms_anshen）长期压魔：入劫心境更稳——丹道进秘仪的独有底气
      s.demon = Math.max(0, (s.demon || 0) - 20);
      s.mood = s.moodMax;
    },
  },
  zhen: {
    label: "阵法", months: MONTHS, extraDan: 1,
    apply(s) {
      s.skills.fulu = (s.skills.fulu || 0) + MONTHS * 2;   // makeFulu +2/月（B② 后每符耗 1 月）
      ["zhen_ms_wengu", "zhen_ms_juling"].forEach(f => { s.flags[f] = true; });
      const inv = s.inventory;   // 产约一符/月（成功率 0.6→0.97 + 双张概率）
      inv.dingshen_fu = (inv.dingshen_fu || 0) + 6;
      inv.huoshe_fu = (inv.huoshe_fu || 0) + 7;
      inv.hanbing_fu = (inv.hanbing_fu || 0) + 7;
      inv.zhenqi_kunzu = (inv.zhenqi_kunzu || 0) + 4;
      inv.zhenqi_juling = (inv.zhenqi_juling || 0) + 4;
    },
  },
};

/* 底牌手操（三档同一策略——AI 贪婪地板之上"会用底牌"，否则丹/阵的产物在 auto 下哑火） */
function smartTurn(c) {
  const p = c.player;
  const ti = c._firstAliveEnemy();
  if (ti < 0) return;
  if (p.hp < p.hpMax * 0.5 && c.canAfford("jinchuang_yao")) c.cast("jinchuang_yao");
  if (c.status !== "ongoing") return;
  if (p.mp < p.mpMax * 0.3 && c.canAfford("huiyuan_dan")) c.cast("huiyuan_dan");
  if (c.status !== "ongoing") return;
  const ci = c.enemies.findIndex(e => e.alive && e._charging);
  if (ci >= 0 && c.canAfford("dingshen_fu") && c.castableAt("dingshen_fu", ci)) c.cast("dingshen_fu", ci);
  if (c.status !== "ongoing") return;
  if (p.mp < p.mpMax * 0.5 && c.canAfford("zhenqi_juling")
    && !c.zones.some(z => z.type === "juling" && z.team === "player")) c.cast("zhenqi_juling");
  if (c.status !== "ongoing") return;
  if (p.spells.includes("lianhuan") && (p.momentum || 0) >= 4 && c.castableAt("lianhuan", ti)) c.cast("lianhuan", ti);
}
function autoPlay(c, maxR) {
  const cap = maxR || c.maxRounds;
  let guard = 0;
  while (c.status === "ongoing" && guard++ < cap * 4) {
    smartTurn(c);
    if (c.status !== "ongoing") break;
    c._autoPlayerTurn();
    if (c.status !== "ongoing") break;
    c.endRound();
    if (c.status !== "ongoing") break;
    c.startRound();
  }
  if (c.status === "ongoing") c.status = "lose";
  return c.status;
}

function montecarlo(build, setup, N) {
  N = N || 150;
  loadSave("save-huangfeng-jindi.json");
  const base = {
    flags: JSON.stringify(State.data.flags),
    inv: JSON.stringify(State.data.inventory || {}),
    spells: JSON.stringify(State.data.spells || []),
    known: JSON.stringify(State.data.knownSkills || []),
    skills: JSON.stringify(State.data.skills || {}),
    demon: State.data.demon, mood: State.data.mood,
    swordIntent: State.data.swordIntent, swordMastery: State.data.swordMastery,
  };
  let wins = 0, hpSum = 0, rounds = 0;
  for (let i = 0; i < N; i++) {
    const s = State.data;
    s.flags = JSON.parse(base.flags);
    s.inventory = JSON.parse(base.inv);
    s.spells = JSON.parse(base.spells);
    s.knownSkills = JSON.parse(base.known);
    s.skills = JSON.parse(base.skills);
    s.demon = base.demon; s.mood = base.mood;
    s.swordIntent = base.swordIntent; s.swordMastery = base.swordMastery;
    s.pendingEvent = null; s.combat = false; s.exmap = null;
    s.hp = s.hpMax;
    build.apply(s);
    setup(build);
    const c = Engine._combat;
    if (!c) throw new Error("战斗未装配");
    const st = autoPlay(c, 40);
    if (st === "win") { wins++; hpSum += Math.max(0, c.player.hp / c.player.hpMax); }
    rounds += c.round;
  }
  return { win: wins / N, endHp: wins ? hpSum / wins : 0, rounds: rounds / N };
}

const SCENARIOS = {
  fengyue: b => { Engine._nextFightType = "fengyue"; Engine.startEncounterFight("fengyue"); },
  mojiao: b => {
    Engine._nextFightType = "mojiao";
    Engine._sideOverride = Engine._nangongwanAlly();
    Engine.startEncounterFight("mojiao");
  },
  zhuji: b => {
    // 冲关口径：修为满盈（canBreakthrough 门槛 60% 之上的自然冲关点）——三档一律同口径
    State.data.cultivation = State.realm().culMax;
    Engine.startBreakthroughFight({ big: true, rite: DATA.bigRealmRites.foundation, extra: b.extraDan });
  },
};

console.log("\n=== Part B · 真实存档三档对比（等效 " + MONTHS + " 月投入 · 封岳/墨蛟/筑基劫） ===\n");
assert(Object.values(BUILDS).every(b => b.months === MONTHS), `等效时间律：三档投入月数相同（各 ${MONTHS} 月）`);

const R = {};   // R[build][scenario] = {win,...}
for (const [bid, b] of Object.entries(BUILDS)) {
  R[bid] = {};
  for (const [sid, setup] of Object.entries(SCENARIOS)) {
    R[bid][sid] = montecarlo(b, setup);
  }
  const r = R[bid];
  console.log(`  · ${b.label}：封岳 ${pct(r.fengyue.win)} ｜ 墨蛟 ${pct(r.mojiao.win)} ｜ 筑基劫 ${pct(r.zhuji.win)}`);
}

/* 断言（任务定标：三档在各自擅长场景胜率 ≥基线【=同存档零投入】·原则=没有一档全场垫底）：
 *   ① 剑道→墨蛟、丹道→筑基劫、阵法→封岳：投入 30 月后擅长场景胜率 ≥ 零投入基线（3pt 采样容差）；
 *   ② 三档之间没有一档在全部三场都垫底（8pt 容差·N=150）。 */
const TOL = 0.08;
const SPECIAL = { sword: "mojiao", dan: "zhuji", zhen: "fengyue" };
const SCN_NAME = { fengyue: "封岳", mojiao: "墨蛟", zhuji: "筑基劫" };
const REAL = ["sword", "dan", "zhen"];
for (const [bid, scn] of Object.entries(SPECIAL)) {
  const mine = R[bid][scn].win, base = R.base[scn].win;
  assert(mine >= base - 0.03,
    `${BUILDS[bid].label}·擅长场景${SCN_NAME[scn]}投入有回报：${pct(mine)} ≥ 零投入基线 ${pct(base)}`);
}
for (const bid of REAL) {
  // "垫底"=该场景三档严格最低（容差外）；断言=至少一个场景不是最低
  const notLastSomewhere = Object.keys(SCENARIOS).some(scn => {
    const mine = R[bid][scn].win;
    return REAL.some(k => k !== bid && R[k][scn].win <= mine + TOL);
  });
  assert(notLastSomewhere, `${BUILDS[bid].label}·不全场垫底（至少一场不是三档最低）`);
}

if (fails.length) {
  console.log(`\nBuild 平衡门禁 FAIL（${fails.length} 项）`);
  process.exit(1);
} else {
  console.log("\nBuild 平衡门禁 PASS：layerMul 不变量 + 三档真实存档各擅其场、无全场垫底。");
  process.exit(0);
}
