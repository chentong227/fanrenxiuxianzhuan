/* ============================================================
 * 箱庭探索无头测试：node test/explore.test.js
 * 走格子 / 资源采集 / 战争迷雾 / 同伴抢资源与反目 / 时间结算
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sandbox = { console, Math, Date, window: {} };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of ["js/data.js", "js/explore.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { Explore, DATA } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }
function seqRng(seq) { let i = 0; return () => seq[(i++) % seq.length]; }

console.log("\n=== 1. 生成网格：尺寸/入口出口/资源投放 ===");
{
  const st = Explore.generate(DATA.exploreSites.houshan_explore, seqRng([0.5, 0.2, 0.9, 0.35, 0.7, 0.1]));
  assert(st.cells.length === st.w * st.h, `网格尺寸正确（${st.w}×${st.h}）`);
  const hasEntry = st.cells.some(c => c.content === "entry");
  const hasExit = st.cells.some(c => c.content === "exit");
  assert(hasEntry && hasExit, "入口与出口都已布置");
  const resCount = st.cells.filter(c => c.content && Explore.CONTENT[c.content] && Explore.CONTENT[c.content].loot).length;
  assert(resCount > 0, `资源已具象化到格子上（共 ${resCount} 处）`);
  assert(st.player.x === st.entry.x && st.player.y === st.entry.y, "玩家从入口起步");
}

console.log("\n=== 2. 战争迷雾：起步只照亮周围，移动逐步揭开 ===");
{
  const st = Explore.generate({ id: "t", name: "测试", w: 7, h: 7, density: { herb: 3, duherb: 0, ore: 0, chest: 0, beast: 0 } }, seqRng([0.5]));
  const seen0 = st.cells.filter(c => c.discovered).length;
  Explore.move(st, "up", seqRng([0.5]));
  const seen1 = st.cells.filter(c => c.discovered).length;
  assert(seen1 >= seen0, `移动后揭开更多区域（${seen0} → ${seen1}）`);
  assert(seen1 < st.w * st.h, "并非全图可见（仍有迷雾）");
}

console.log("\n=== 3. 阻挡地形不可通行 ===");
{
  const st = Explore.generate({ id: "t", name: "测试", w: 5, h: 5, density: { herb: 0, duherb: 0, ore: 0, chest: 0, beast: 0 } }, seqRng([0.5]));
  // 人为在玩家上方放一块岩石
  const px = st.player.x, py = st.player.y;
  const up = Explore.cellAt(st, px, py - 1);
  up.terrain = "rock";
  const r = Explore.move(st, "up", seqRng([0.5]));
  assert(!r.ok, "山岩阻挡，无法走入");
}

console.log("\n=== 4. 走到资源格即采集，并计入本次背包 ===");
{
  const st = Explore.generate({ id: "t", name: "测试", w: 5, h: 5, density: { herb: 0, duherb: 0, ore: 0, chest: 0, beast: 0 } }, seqRng([0.5]));
  const px = st.player.x, py = st.player.y;
  const target = Explore.cellAt(st, px, py - 1);
  target.terrain = "floor"; target.content = "herb"; target.loot = { lingcao: 2 }; target.taken = false;
  const r = Explore.move(st, "up", seqRng([0.5]));
  assert(r.ok && r.events.some(e => e.type === "collect"), "走到灵草格触发采集");
  assert(st.bag.lingcao === 2, `采集计入本次背包（灵草×${st.bag.lingcao}）`);
  assert(target.taken === true, "该格资源已被取走（不可重复采）");
}

console.log("\n=== 5. 凶兽格触发战斗事件 ===");
{
  const st = Explore.generate({ id: "t", name: "测试", w: 5, h: 5, density: { herb: 0, duherb: 0, ore: 0, chest: 0, beast: 0 } }, seqRng([0.5]));
  const px = st.player.x, py = st.player.y;
  const target = Explore.cellAt(st, px, py - 1);
  target.terrain = "floor"; target.content = "beast"; target.enemy = "wild_wolf"; target.taken = false;
  const r = Explore.move(st, "up", seqRng([0.5]));
  assert(r.events.some(e => e.type === "beast" && e.enemy === "wild_wolf"), "踩到凶兽格触发战斗");
}

console.log("\n=== 6. 同伴随行：会移动并抢采资源；独吞机缘可能反目 ===");
{
  // 高贪婪同伴，紧邻一处机缘箱
  const st = Explore.generate({ id: "t", name: "测试", w: 7, h: 7,
    density: { herb: 0, duherb: 0, ore: 0, chest: 0, beast: 0 },
    companions: [{ id: "greed", name: "贪婪散修", greed: 1, relation: 0 }] }, seqRng([0.5]));
  const cp = st.companions[0];
  // 在同伴正上方放机缘箱（同伴在底行，下方越界），确保一步可达并抢采
  const box = Explore.cellAt(st, cp.x, cp.y - 1);
  if (box && !box.content) { box.terrain = "floor"; box.content = "chest"; box.loot = { lingshi: 3 }; box.taken = false; }
  // rng 恒小 → 必抢 + 必反目
  const r = Explore.move(st, st.player.y > 0 ? "up" : "down", seqRng([0.01]));
  const tookOrConflict = r.events.some(e => e.type === "rival_take" || e.type === "conflict");
  assert(tookOrConflict, "同伴会抢先采走资源（资源竞争）");
}

console.log("\n=== 7. 时间结算：步数 × 单步耗时，向上取整 ===");
{
  const st = Explore.generate({ id: "t", name: "测试", w: 9, h: 9, stepCost: 0.34, density: { herb: 0, duherb: 0, ore: 0, chest: 0, beast: 0 } }, seqRng([0.5]));
  // 强行走若干步（避开阻挡）
  let moves = 0;
  for (let i = 0; i < 6; i++) { const dir = i % 2 ? "left" : "right"; if (Explore.move(st, dir, seqRng([0.5])).ok) moves++; }
  const months = Explore.timeCostMonths(st);
  assert(months >= 1, `探索耗时至少 1 月（实际 ${months} 月 / ${st.steps} 步）`);
  assert(months === Math.max(1, Math.round(st.steps * st.stepCost)), "耗时=步数×单步耗时(取整)");
}

console.log(`\n========== 箱庭探索：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
