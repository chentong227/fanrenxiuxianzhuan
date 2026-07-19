/* 随机行动模糊测试（bug 打磨轮·v338）：无头驱动真实引擎，多种子长局随机游玩——
 * 随机行动/随机剧情抉择/随机奇遇选项/随机战斗出牌/随机旅行，专抓运行时异常与死局。
 * node test/fuzz.audit.js [种子数] [每局最大步数]  —— 任一异常即退出码 1。 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SEEDS = +(process.argv[2] || 8);
const MAX_STEPS = +(process.argv[3] || 3000);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSandbox() {
  const store = {};
  const sandbox = {
    console, Math, Date, JSON, window: {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  // UI 垫片：终局结算等把状态清理放在 UI 回调里（showCombatOutro(c,meta,cb)），
  // 无头下必须同步代跑回调，否则战斗永不落账（fled/lose 却 combat=true 的假卡死）
  sandbox.UI = new Proxy({}, {
    get(t, k) {
      if (k === "showCombatOutro") return (c, meta, cb) => { if (typeof cb === "function") cb(); };
      return () => {};
    },
  });
  const ctx = vm.createContext(sandbox);
  for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/exploremap.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
  }
  return sandbox;
}

const failures = [];

function runSeed(seed, seedFixture, maxSteps) {
  maxSteps = maxSteps || MAX_STEPS;
  const rnd = mulberry32(seed);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const sb = buildSandbox();
  const { State, Engine, STORY, WORLD, DATA, INTERACTIONS, CombatAPI } = sb;
  const roots = Object.keys(DATA.roots || { si: 1 });
  let step = 0, lastCtx = "create";
  const trace = [];
  const say = (c) => { lastCtx = c; trace.push(c); if (trace.length > 14) trace.shift(); };
  const guardCall = (label, fn) => {
    say(label);
    try { fn(); return true; }
    catch (e) {
      failures.push({ seed, fixture: seedFixture || "-", step, label, err: e.message, stack: (e.stack || "").split("\n").slice(0, 5).join(" | "), trace: trace.join(" > ") });
      return false;
    }
  };

  if (seedFixture) {
    // 从章节夹具起局：覆盖黄枫谷/魔道/星海等后期内容
    if (!guardCall(`load:${seedFixture}`, () => {
      const raw = fs.readFileSync(path.join(__dirname, "..", "playtest", seedFixture), "utf8");
      sb.localStorage.setItem("frxxz_save_v1", raw);
      if (!State.load()) throw new Error("State.load() 返回 false");
      Engine.checkStory();
    })) return;
  } else if (!guardCall("create", () => { State.create("韩立", pick(roots)); Engine.checkStory(); })) return;

  while (step++ < maxSteps) {
    const s = State.data;
    if (s.hp <= 0 && !s.combat) break;                       // 身死局终
    if (s.flags && s.flags.arc_all_complete) break;

    // —— 战斗：随机出牌/移动，每回合最多 3 手后强制结束回合；后期越拖越偏攻击 ——
    if (s.combat) {
      let rounds = 0, ok = true;
      while (State.data.combat && rounds++ < 150 && ok) {
        const cc = Engine._combat;
        if (!cc) break;
        let hands = 0;
        while (State.data.combat && Engine._combat === cc && hands++ < 3 && ok) {
          const r = rnd();
          if (r < 0.04 && rounds > 2 && rounds < 40) { ok = guardCall("combatFlee", () => Engine.combatFlee()); break; }
          const aff = (() => { try { return cc.affordableSpells(); } catch (e) { return []; } })();
          const SP = CombatAPI.SPELLS;
          // 拖得越久越倾向纯攻击（40 回合后基本必攻）——保证战斗能推进而非永久互奶
          const atk = aff.filter(id => SP[id] && (SP[id].type === "atk" || SP[id].type === "soul"));
          const atkBias = rounds > 40 ? 0.98 : 0.75;
          if (aff.length && (r < 0.85 || rounds > 40)) {
            const sp = (atk.length && rnd() < atkBias) ? pick(atk) : pick(aff);
            const alive = cc.enemies.map((e, i) => e.alive ? i : -1).filter(i => i >= 0);
            const tgt = alive.length ? pick(alive) : 0;
            ok = guardCall(`cast:${sp}`, () => Engine.combatCast(sp, tgt));
          } else if (cc.player && typeof cc.player.pos === "number" && r < 0.93) {
            const to = Math.max(0, Math.min(7, cc.player.pos + (rnd() < 0.5 ? -1 : 1)));
            ok = guardCall("combatMove", () => Engine.combatMove(to));
          } else break;
        }
        if (State.data.combat && ok) ok = guardCall("combatEndRound", () => Engine.combatEndRound());
      }
      if (State.data.combat) {                                // 打不完=战斗死循环，记为失败
        const cc = Engine._combat;
        const diag = cc ? `status:${cc.status} 敌:${cc.enemies.map(e => `${e.name}${e.alive ? "" : "†"}hp${e.hp}`).join(",")} 我:hp${cc.player.hp}/sp${State.data.spirit} sdCombatFlag:${!!State.data.combat} same:${Engine._combat === cc} log末3:${(cc.log || []).slice(-3).join("；")}` : "cc=null";
        failures.push({ seed, step, label: "combat-stuck", err: `战斗 150 回合未终局｜${diag}`, trace: trace.join(" > ") });
        return;
      }
      continue;
    }

    // —— NPC 主动交互 ——
    if (s._pendingInteraction) {
      const it = s._pendingInteraction;
      let idx = 0;
      try {
        const b = INTERACTIONS.build(it, s);
        const valid = b.choices.map((c, i) => (!c.cond || c.cond(s)) ? i : -1).filter(i => i >= 0);
        idx = valid.length ? pick(valid) : 0;
      } catch (e) { failures.push({ seed, step, label: "interaction-build", err: e.message, trace: trace.join(" > ") }); return; }
      if (!guardCall(`interact:${it.id || "?"}:${idx}`, () => Engine.chooseInteraction(idx))) return;
      continue;
    }

    // —— 奇遇 ——
    if (Engine._pendingFortune) {
      const f = Engine._pendingFortune;
      const valid = f.choices.map((c, i) => (!c.cond || c.cond(s)) ? i : -1).filter(i => i >= 0);
      const idx = valid.length ? pick(valid) : 0;
      if (!guardCall(`fortune:${f.id || f.title}:${idx}`, () => Engine.chooseFortune(idx))) return;
      continue;
    }

    // —— 主线剧情 ——
    if (s.pendingEvent) {
      const st = STORY.find(x => x.id === s.pendingEvent);
      if (!st) { failures.push({ seed, step, label: "pending-missing", err: `pendingEvent=${s.pendingEvent} 不在 STORY`, trace: trace.join(" > ") }); return; }
      const chs = typeof st.choices === "function" ? st.choices(s) : st.choices;
      if (!chs || !chs.length) { failures.push({ seed, step, label: "story-no-choice", err: `${st.id} 无可选项`, trace: trace.join(" > ") }); return; }
      const valid = chs.map((c, i) => (!c.cond || c.cond(s)) ? i : -1).filter(i => i >= 0);
      const idx = valid.length ? pick(valid) : 0;
      if (!guardCall(`story:${st.id}:${idx}`, () => Engine.chooseStory(st, idx))) return;
      continue;
    }

    // —— 旅途中：随机月度行动 ——
    if (s.journey) {
      const acts = ["_journeyActionTravel", "_journeyActionScout", "_journeyActionGather", "_journeyActionRumor"];
      const a = pick(acts);
      if (!guardCall(`journey:${a}`, () => { const j = s.journey; Engine[a](s, j); })) return;
      continue;
    }

    // —— 秘境走格中：随机移动/离开 ——
    if (s.exmap) {
      if (rnd() < 0.12) { if (!guardCall("exmapLeave", () => Engine.exmapLeave && Engine.exmapLeave())) return; continue; }
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const d = pick(dirs);
      if (!guardCall("exmapMove", () => Engine.exmapMove && Engine.exmapMove(d[0], d[1]))) return;
      continue;
    }

    // —— 自由行动：主线牵引（60%）或随机行动 ——
    const nx = STORY[s.storyStage];
    if (nx && (!nx.cond || nx.cond(s)) && nx.where && nx.where !== s.location && rnd() < 0.6) {
      if (!guardCall(`travel-story:${nx.where}`, () => Engine.travelTo(nx.where))) return;
      Engine.checkStory();
      continue;
    }

    const loc = WORLD.locations.find(l => l.id === s.location);
    const acts = (loc && loc.actions || []).slice();
    const r = rnd();
    if (r < 0.06 && acts.includes("breakthrough")) {
      if (!guardCall("breakthrough", () => Engine.attemptBreakthrough())) return;
    } else if (r < 0.12) {
      // 随机旅行（同大区随机地点）
      const others = WORLD.locations.filter(l => l.id !== s.location && !l.gated);
      if (others.length) { if (!guardCall("travel-rand", () => Engine.travelTo(pick(others).id))) return; }
    } else if (r < 0.18 && Object.keys(s.inventory || {}).length) {
      const id = pick(Object.keys(s.inventory));
      if (!guardCall(`useItem:${id}`, () => Engine.useItem(id))) return;
    } else {
      const doers = {
        cultivate: () => Engine.doCultivate(1 + Math.floor(rnd() * 12)),
        rest: () => Engine.rest(),
        gather: () => Engine.gather(),
        spar: () => Engine.spar(),
        alchemy: () => Engine.alchemy(),
        investigate: () => Engine.investigate(),
        adventure: () => Engine.adventure(),
        explore: () => Engine.doAction("explore"),
        xiuzhen: () => Engine.repairZhenwen(),
        yaoyuan: () => Engine.yaoyuanWork(),
        xingyi: () => Engine.practiceMedicine(),
        wujian: () => Engine.doWujian(),
        liandan: () => Engine.lianZhujiDan(),
        hunt: () => Engine.startWaihaiHunt(),
        xunluo: () => Engine.startXunluoPatrol(),
        board: () => Engine.cityRead("board"),
        rumor: () => Engine.cityRead("rumor"),
        daigong: () => Engine.daigongRevisit(),
      };
      const avail = acts.filter(a => doers[a]);
      const a = avail.length ? pick(avail) : "cultivate";
      if (!guardCall(`act:${a}`, () => doers[a] ? doers[a]() : Engine.doCultivate(1))) return;
    }
    if (!guardCall("checkStory", () => Engine.checkStory())) return;
    if (!guardCall("saveload", () => { State.save(); })) return;
  }

  // 每局末尾：一次读档回环（存档可回读=不出死档）
  guardCall("reload", () => { const ok = State.load(); if (!ok) throw new Error("State.load() 返回 false"); });
  const s = State.data;
  return { stage: s.storyStage, chapter: s.activeChapter || "-", months: State.absMonth(), dead: s.hp <= 0, realm: (State.realm() || {}).name };
}

console.log(`fuzz：${SEEDS} 种子 × 最多 ${MAX_STEPS} 步（新档局）`);
for (let i = 1; i <= SEEDS; i++) {
  const t0 = Date.now();
  const cov = runSeed(1000 + i * 7919);
  const covStr = cov ? `章:${cov.chapter} 段:${cov.stage} ${cov.realm || ""} ${Math.round(cov.months / 12)}年${cov.dead ? " 身死" : ""}` : "中断";
  console.log(`  种子 ${i}/${SEEDS}（${Date.now() - t0}ms）${covStr}${failures.length ? ` 累计异常 ${failures.length}` : ""}`);
}

// 章节夹具局：每个 playtest 存档 × 若干种子，把后期章节也磨一遍
const fixtures = fs.readdirSync(path.join(__dirname, "..", "playtest")).filter(f => f.endsWith(".json"));
const FIX_SEEDS = Math.max(2, Math.floor(SEEDS / 8));
console.log(`\nfuzz：${fixtures.length} 个章节夹具 × ${FIX_SEEDS} 种子 × 最多 ${Math.floor(MAX_STEPS / 2)} 步`);
for (const fx of fixtures) {
  for (let i = 1; i <= FIX_SEEDS; i++) {
    const t0 = Date.now();
    const before = failures.length;
    const cov = runSeed(3000 + i * 104729, fx, Math.floor(MAX_STEPS / 2));
    const covStr = cov ? `章:${cov.chapter} 段:${cov.stage} ${cov.realm || ""}${cov.dead ? " 身死" : ""}` : "中断";
    console.log(`  ${fx} #${i}（${Date.now() - t0}ms）${covStr}${failures.length > before ? ` ←新异常 ${failures.length - before}` : ""}`);
  }
}

if (failures.length) {
  console.log(`\n=== 异常 ${failures.length} 条 ===`);
  for (const f of failures.slice(0, 30)) {
    console.log(`[seed ${f.seed} step ${f.step}] ${f.label}: ${f.err}\n  轨迹: ${f.trace}\n  ${f.stack || ""}`);
  }
  process.exit(1);
} else {
  console.log("全绿：未发现运行时异常/战斗死循环/存档回读失败");
}
