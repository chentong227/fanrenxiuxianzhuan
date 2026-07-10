/* ============================================================
 * 尾段战斗体验普查：node test/combat-sweep.bal.js
 *
 * "往深了"——真引擎从魔道四幕驱动到星海飞驰章末，每遇战斗 autoResolve 真打、多轮取样，
 *   测每场胜率/平均末血/平均回合，对照一致感公理标异常：
 *     · 真死局：胜率 0% 且 非 survive/非阵法/非 fail-forward——唯一判 FAIL 项（玩家会卡死）。
 *     · 高难·fail-forward：胜率 0% 但败有所得可满血重试+累加伤害——非死局（真人靠集火/底牌取胜）。
 *     · 偏险：胜率<35%（autoResolve 贪婪铺伤·不集火·不省底牌＝悲观地板·真人更高，留意）。
 *     · 太易：胜率 100% 且 末血>92% 且 回合≤3（无双·没张力——多为 intro/trash/阵法）。
 *   ⚠ 两条关键校准（否则全是假象）：
 *     ① 篇章境界：realmTier 读 activeChapter 非 realmIndex——按战斗归属篇章切 activeChapter
 *        （xh_*=星海飞驰结丹 tier2/realmBand5.5；ss_*=初入星海；余=魔道筑基），并满血满灵上场。
 *     ② fail-forward：解析 engine.finishCombat 各分支，败设 _retryAfterLoss 者＝非死局。
 *   口径同 climax.bal：autoResolve 对"集火/特攻/底牌"型战斗是悲观地板（贪婪 AI 不会省底牌、不会集火），
 *   故 0% 未必死局。本脚本是体验报告兼死局门禁（仅"真死局"判 FAIL，其余打印观察）。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = {};
const sandbox = { console, Math, Date, window: {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  setTimeout: () => 0, clearTimeout: () => {} };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.UI = new Proxy({}, { get() { return () => {}; } });
sandbox.Art = new Proxy({}, { get() { return () => false; } });
sandbox.Fx = new Proxy({}, { get() { return () => {}; } });
sandbox.Sfx = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/exploremap.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine, STORY } = sandbox;

// 失败有所得（fail-forward）侦测：解析 engine.js finishCombat 各 meta.type 分支，
//   凡败后设 _retryAfterLoss（满血再战+累加伤害加成）者＝非死局——autoResolve 单冷开口径
//   打不过≠玩家卡死（真人靠集火/底牌+重试累积加成必通）。据此把"高难 fail-forward"与"真死局"分开。
const _failForward = (() => {
  const src = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");
  const set = new Set();
  const parts = src.split(/meta\.type === "/);
  for (let i = 1; i < parts.length; i++) {
    const t = parts[i].slice(0, parts[i].indexOf('"'));
    const seg = parts[i].slice(0, 1800);
    // 两类"败有所得"：①_retryAfterLoss（满血重试+累加伤害）②双向推进（胜负皆 storyStage++·如
    //   whfy_wentianren 六魔战——正典鬼雾打断、败也照样进剧情=永不卡死）
    if (/_retryAfterLoss/.test(seg) || /双向推进/.test(seg)) set.add(t);
  }
  return set;
})();

const samples = {};   // key=战斗标识 -> {name, n, wins, hpSum, roundSum, enemies, boss, survive, field}
function rec(key, meta) {
  if (!samples[key]) samples[key] = { name: key, n: 0, wins: 0, hpSum: 0, roundSum: 0, enemies: meta.enemies, boss: meta.boss, survive: meta.survive, field: meta.field, ecount: meta.ecount };
  return samples[key];
}

function runOnce() {
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.activeChapter = "modao"; s.unlockedChapters = ["qixuan", "huangfeng", "modao"];
  s.realmIndex = 12; s.hp = s.hpMax = 200; s.technique = "qingyuan_sword";
  s.flags.modao_act3_done = true; s.flags.modao_act4_due = 0; s.flags.jingcheng_intel = 2;
  // 星海飞驰篇真实玩家口径：到此处应已持青竹蜂云剑（→飞剑+辟邪神雷）、噬金虫（→四用法·破甲群杀）、皇鳞甲（保命）。
  //   这些是 §尾段战斗（铁火蚁/海王兽）显式围绕的结丹兵器谱——缺则 autoResolve 假象性 0%，非真死局。
  ["qingming_zhen", "jinguang_zhuan_charge", "jinguang_zhuan", "huixue_dan", "dingshen_fu", "huoshe_fu",
   "tianlei_zhu", "xutian_tucan", "jinleizhu", "qingzhu_fengyun_jian", "shijinchong", "boluo_zhu",
   "huanglin_jia", "butian_dan", "yanghun_mu"].forEach(it => { try { State.give(it, 3); } catch (e) {} });
  s.storyStage = STORY.findIndex(n => n.id === "modao_e4_shenxun");
  if (STORY[s.storyStage] && STORY[s.storyStage].where) s.location = STORY[s.storyStage].where;

  let steps = 0, stuck = 0;
  while (steps++ < 1500) {
    if (s.combat && Engine._combat) {
      const c = Engine._combat;
      const meta = Engine._combatMeta || {};
      const key = meta.type || Engine._nextFightType || ("combat@" + s.storyStage);
      const objSurvive = !!(c.objective && /survive|hold|拖/.test(JSON.stringify(c.objective).slice(0, 80)));
      const r = rec(key, { enemies: (c.enemies || []).map(e => e.name).join("/"), boss: (c.enemies || []).some(e => e.boss), survive: objSurvive, field: !!c.fieldCycle, ecount: (c.enemies || []).length });
      // ⚠ 篇章境界校准（关键·防 harness 假象）：realmTier 读 activeChapter，而非 realmIndex。
      //   驱动器只 pump realmIndex 不切 activeChapter → 星海飞驰(结丹·tier2·realmBand5.5)的 boss
      //   会被当筑基(tier1·realmBand2.4·mpPool~140)的韩立打 = 大幅低估战力的假性偏险/死局。
      //   按战斗归属篇章重建玩家战力档：xh_*=星海飞驰(结丹中期)，ss_*=初入星海(结丹初期)，余=魔道(筑基)。
      // v315：补 whfy=外海风云（结丹大圆满 realmIndex 20）——v311 整章落地后 sweep 漏校准，
      //   曾把结丹大圆满内容按魔道筑基档打=假性 0%（温天仁战被误报死局）
      const chapMap = { xh: ["xinghaifeichi", 20], ss: ["starsea", 16], whfy: ["waihaifengyun", 20] };
      const cm = chapMap[key.split("_")[0]];
      if (cm && s.activeChapter !== cm[0]) {
        s.activeChapter = cm[0];
        if (!s.unlockedChapters.includes(cm[0])) s.unlockedChapters.push(cm[0]);
        if (s.realmIndex < cm[1]) s.realmIndex = cm[1];
        // 重建 player fighter 使新境界档生效（manaPool/realmBand 按结丹重算）
        try { const np = Engine.playerFighter(); Object.assign(c.player, { hpMax: np.hpMax, mpMax: np.mpMax, gongli: np.gongli, realmTier: np.realmTier, realmLayer: np.realmLayer }); } catch (e) {}
      }
      // 备战态校准：满血满灵上场（代表"调息后再战"的真实玩家口径，排除 harness MP 饥饿假象）
      if (c.player) { c.player.hp = c.player.hpMax; c.player.mp = c.player.mpMax || c.player.mp; }
      (c.sides || (c.side ? [c.side] : [])).forEach(u => { if (u) { u.hp = u.hpMax; if (u.mpMax) u.mp = u.mpMax; } });
      // 真打
      let st = "lose";
      try { st = c.autoResolve(40); } catch (e) { st = "err"; }
      r.n++;
      if (st === "win") { r.wins++; r.hpSum += Math.max(0, c.player.hp / c.player.hpMax); }
      r.roundSum += c.round || 0;
      // 强制推进（不论胜负，走完全程取下一场样本）
      if (c.status !== "win") c.status = "win";
      try { Engine._finishCombat(); } catch (e) {}
      stuck = 0; continue;
    }
    if (Engine._pendingFortune) { Engine.chooseFortune(0); stuck = 0; continue; }
    if (s.exmap) { s.exmap = null; stuck = 0; continue; }
    if (s.pendingEvent) {
      const st = STORY.find(x => x.id === s.pendingEvent); if (!st) break;
      let ci = 0; const chs = typeof st.choices === "function" ? st.choices(s) : st.choices;
      if (Array.isArray(chs) && chs.length) { const ok = chs.findIndex(c => !c.requireItem || State.count(c.requireItem) > 0); ci = ok >= 0 ? ok : 0; }
      try { Engine.chooseStory(st, ci); } catch (e) { break; }
      stuck = 0; continue;
    }
    Object.keys(s.flags || {}).forEach(k => { if (/_due$/.test(k) && typeof s.flags[k] === "number") s.flags[k] = 0; });
    if (s.rippleWindow) s.rippleWindow = null;
    const nx = STORY[s.storyStage];
    if (nx && nx.where && s.location !== nx.where) s.location = nx.where;
    s.cultivation = 9e8; if (s.spirit != null) s.spirit = 9e8; s.mood = s.moodMax || 100; s.demon = 0; if (s.hp <= 0) s.hp = s.hpMax;
    const before = s.storyStage;
    try { Engine.checkStory(); } catch (e) { break; }
    if (!s.pendingEvent && !s.combat && !s.journey && !Engine._pendingFortune && !s.exmap) {
      if (s.storyStage === before) { if (s.realmIndex < 22) s.realmIndex++; if (Engine.passTime) { try { Engine.passTime(1); } catch (e) {} } stuck++; if (s.storyStage >= STORY.length || stuck > 16) break; continue; }
    }
  }
}

const ROUNDS = 10;
console.log(`\n========== 尾段战斗体验普查（魔道四幕→星海飞驰·真引擎 autoResolve ×${ROUNDS} 轮） ==========\n`);
for (let i = 0; i < ROUNDS; i++) runOnce();

const pct = x => (x * 100).toFixed(0) + "%";
const keys = Object.keys(samples);
console.log(`共采集 ${keys.length} 场战斗，每场 ~${ROUNDS} 样本\n`);
console.log("场次".padEnd(22) + " 胜率   末血   回合  敌数 类型");
const warns = [];
let deadlocks = 0;
for (const k of keys) {
  const r = samples[k];
  const win = r.wins / r.n, endHp = r.wins ? r.hpSum / r.wins : 0, rounds = r.roundSum / r.n;
  const tag = [r.boss ? "BOSS" : "", r.survive ? "survive" : "", r.field ? "阵法" : ""].filter(Boolean).join("·") || "常规";
  console.log(k.padEnd(22) + ` ${pct(win).padStart(4)}  ${pct(endHp).padStart(4)}  ${rounds.toFixed(1).padStart(4)}  ${String(r.ecount).padStart(2)}  ${tag}  [${r.enemies}]`);
  if (win === 0 && !r.survive && !r.field) {
    if (_failForward.has(k)) warns.push(`· 高难·fail-forward：${k}（autoResolve冷开0%·但败有所得可满血重试+累加伤害·非死局·真人靠集火/底牌取胜）`);
    else { warns.push(`✗ 死局疑似：${k}（胜率0%·非survive非阵法·无fail-forward）`); deadlocks++; }
  }
  else if (win < 0.35 && !r.survive && !r.field) warns.push(`· 偏险：${k}（胜率${pct(win)}·autoResolve地板·真人更高·留意`);
  else if (win === 1 && endHp > 0.92 && rounds <= 3) warns.push(`· 太易：${k}（100%/末血${pct(endHp)}/${rounds.toFixed(1)}回合·无双没张力）`);
}
console.log("\n—— 观察 ——");
if (warns.length) warns.forEach(w => console.log("  " + w)); else console.log("  无异常（胜率带/末血/回合均在合理区）");

console.log(`\n========== 普查结论：${deadlocks === 0 ? "无 survive/fail-forward 外死局 ✓" : deadlocks + " 处真死局 ✗"} ==========\n`);
process.exit(deadlocks === 0 ? 0 : 1);
