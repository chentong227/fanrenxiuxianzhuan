/* ============================================================
 * explore.js — 箱庭式网格探索（副本/秘境雏形）
 *
 * 设计目标（参考地下城堡2 + 凡人「虚天殿/坠魔谷」式副本）：
 *  - 可视化走格子：玩家在 W×H 网格上逐格移动，带战争迷雾与小地图。
 *  - 资源具象化：灵草/毒草/灵石/机缘箱以图标落在格子上，走到即可采集/开启。
 *  - 同伴随行：一同下副本的 NPC 也在图中移动、抢采资源；资源分配不均可能反目动手。
 *  - 时间流式：每走一步消耗光阴（探索结束统一结算到大世界月份）。
 *
 * 纯逻辑、无 DOM、可序列化（存档友好）、可无头测试。
 * 状态挂在 State.data.explore，渲染由 ui.js 负责，事件回调由 engine.js 提供。
 * ============================================================ */

(function (root) {

  // 地形：可通行/阻挡
  const TERRAIN = {
    floor: { name: "空地", blocked: false },
    grass: { name: "草丛", blocked: false },
    rock:  { name: "山岩", blocked: true },
    water: { name: "灵泉", blocked: true },
  };

  // 资源/内容定义：具象化图标 + 采集产出
  // kind: 'herb'|'duherb'|'ore'|'chest'|'beast'|'boss'|'secret'|'mystery'|'exit'|'entry'
  const CONTENT = {
    herb:   { icon: "🌿", name: "灵草", loot: { lingcao: [1, 3] }, steps: 1, value: 1 },
    duherb: { icon: "☠",  name: "毒草", loot: { duyao_cao: [1, 2] }, steps: 1, value: 1 },
    ore:    { icon: "💎", name: "灵石矿", loot: { lingshi: [1, 2] }, steps: 2, value: 3 },
    chest:  { icon: "🧰", name: "机缘箱", loot: { lingshi: [2, 4] }, steps: 2, value: 5, rich: true },
    beast:  { icon: "🐾", name: "凶兽", enemy: true, value: 4 },
    // 妖兽王：盘踞最深处的硬茬，打赢=本图最肥一笔（深入与否的核心抉择）
    boss:   { icon: "👹", name: "妖兽王", enemy: true, boss: true, value: 9, loot: { lingshi: [3, 5], lingcao: [2, 3] } },
    // 暗室：神识够强才能察觉的隐藏机缘（神识的探索用途）
    secret: { icon: "🚪", name: "隐秘暗室", loot: { lingshi: [2, 3], ningshen_dan: [1, 1] }, steps: 2, value: 7, rich: true },
    // 异状：踩上才知吉凶的小事件（探索的心跳）
    mystery:{ icon: "❓", name: "异状", value: 2 },
    exit:   { icon: "⮐",  name: "出口", value: 0 },
    entry:  { icon: "◈",  name: "入口", value: 0 },
  };

  function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

  const Explore = {
    TERRAIN, CONTENT,

    // —— 生成一处探索点 ——
    // cfg: { id,name,w,h, density:{herb,duherb,ore,chest,beast}, companions:[{id,name,greed,relation}], rng }
    generate(cfg, rng = Math.random) {
      const w = cfg.w || 9, h = cfg.h || 9;
      const cells = [];
      for (let i = 0; i < w * h; i++) {
        // 少量阻挡地形点缀（不挡死路：四周留通道）
        let terrain = "floor";
        const r = rng();
        if (r < 0.08) terrain = "rock";
        else if (r < 0.12) terrain = "water";
        else if (r < 0.4) terrain = "grass";
        cells.push({ terrain, content: null, loot: null, discovered: false, taken: false });
      }
      const idx = (x, y) => y * w + x;
      const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

      // 入口固定在底部中央，出口在顶部中央
      const entry = { x: Math.floor(w / 2), y: h - 1 };
      const exit = { x: Math.floor(w / 2), y: 0 };
      cells[idx(entry.x, entry.y)] = { terrain: "floor", content: "entry", discovered: true, taken: false };
      cells[idx(exit.x, exit.y)] = { terrain: "floor", content: "exit", discovered: false, taken: false };

      // 撒资源/凶兽：在非入口/出口、非阻挡格上按密度放置
      const free = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = cells[idx(x, y)];
        if (c.content) continue;
        if (TERRAIN[c.terrain].blocked) continue;
        if (x === entry.x && y === entry.y) continue;
        free.push({ x, y });
      }
      // 洗牌后按"距入口深度"分层（深度梯度：越深越富，去还是不去=核心抉择）
      for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
      const depth = (pt) => Math.abs(pt.x - entry.x) + Math.abs(pt.y - entry.y);
      const maxDepth = w + h - 2;
      const shallow = free.filter(pt => depth(pt) <= maxDepth * 0.45);
      const deep = free.filter(pt => depth(pt) > maxDepth * 0.45);
      const dens = cfg.density || { herb: 5, duherb: 3, ore: 3, chest: 2, beast: 4 };
      const fill = (cell, kind) => {
        cell.content = kind;
        const def = CONTENT[kind];
        if (def.loot) {
          cell.loot = {};
          Object.entries(def.loot).forEach(([item, [lo, hi]]) => { cell.loot[item] = randInt(rng, lo, hi); });
        }
        if (def.enemy) cell.enemy = cfg.beastEnemy || "wild_wolf";
      };
      const place = (kind, n, pool) => {
        for (let k = 0; k < n; k++) {
          const pt = pool.pop() || free.pop();
          if (!pt) return;
          fill(cells[idx(pt.x, pt.y)], kind);
        }
      };
      // 浅层：草药与零散凶兽（新手区）；深层：灵石/机缘箱/恶兽（富贵险中求）
      place("herb", dens.herb, shallow); place("duherb", dens.duherb, shallow);
      place("beast", Math.ceil(dens.beast / 2), shallow);
      place("ore", dens.ore, deep); place("chest", dens.chest, deep);
      place("beast", Math.floor(dens.beast / 2), deep);
      // 妖兽王：盘踞最深的一格（本图最大的肉，也最大的险）
      deep.sort((a, b) => depth(a) - depth(b));
      const bossPt = deep.pop();
      if (bossPt) { fill(cells[idx(bossPt.x, bossPt.y)], "boss"); cells[idx(bossPt.x, bossPt.y)].enemy = cfg.bossEnemy || "rogue_cultivator"; }
      // 隐秘暗室：藏在中深处，神识到了才会显形
      const secretPt = deep.length ? deep.splice(Math.floor(deep.length / 2), 1)[0] : shallow.pop();
      if (secretPt) { fill(cells[idx(secretPt.x, secretPt.y)], "secret"); cells[idx(secretPt.x, secretPt.y)].hidden = true; }
      // 异状格 ×2：踩上才知吉凶
      place("mystery", 2, deep.length >= 2 ? deep : shallow);

      // —— 节拍器（multiply-design 律三：无聊之前必有收获）——
      // 空域回填：任何 3×3 邻域不得全空——走三步必有一物（嗑瓜子的硬保障）
      for (let cy = 1; cy < h - 1; cy += 2) {
        for (let cx = 1; cx < w - 1; cx += 2) {
          let any = false;
          for (let dy = -1; dy <= 1 && !any; dy++) for (let dx = -1; dx <= 1 && !any; dx++) {
            const c = cells[idx(cx + dx, cy + dy)];
            if (c && (c.content || TERRAIN[c.terrain].blocked)) any = true;
          }
          if (!any) {
            const c = cells[idx(cx, cy)];
            fill(c, rng() < 0.6 ? "herb" : "mystery");
          }
        }
      }

      // 同伴落在入口附近
      const companions = (cfg.companions || []).map((cp, i) => ({
        id: cp.id, name: cp.name,
        x: clampNum(entry.x + (i % 2 ? 1 : -1), 0, w - 1),
        y: clampNum(entry.y - Math.floor(i / 2), 0, h - 1),
        greed: cp.greed != null ? cp.greed : 0.5,   // 贪婪度：越高越抢资源
        relation: cp.relation != null ? cp.relation : 0,
        gathered: 0, conflicted: false, alive: true,
      }));

      const state = {
        siteId: cfg.id, siteName: cfg.name || "秘境",
        w, h, cells,
        player: { x: entry.x, y: entry.y },
        entry, exit,
        companions,
        steps: 0, stepCost: cfg.stepCost || 0.34,   // 每步耗时（月），结算时取整
        bag: {},          // 本次探索已采集（结算时并入主背包）
        log: [],
        finished: false,
        sightRadius: cfg.sightRadius || 1,
        senseVal: cfg.senseVal || 5,   // 神识：决定能否察觉隐秘暗室
        // 远惦记（律三）：入图即可望见深处的兽踪——塞尔达"登高望见"的网格版
        farMark: bossPt ? { x: bossPt.x, y: bossPt.y } : null,
      };
      this._reveal(state, state.player.x, state.player.y);
      this._log(state, `你踏入「${state.siteName}」。脚下是一片未知之地，且行且探——深处愈险，亦愈富。`);
      if (state.farMark) this._log(state, "极深处隐有兽吼传来，地面微颤——这片地界的主人就盘踞在那里。");
      return state;
    },

    _log(state, msg) { state.log.push(msg); if (state.log.length > 40) state.log.shift(); },

    cellAt(state, x, y) {
      if (x < 0 || y < 0 || x >= state.w || y >= state.h) return null;
      return state.cells[y * state.w + x];
    },

    _reveal(state, cx, cy) {
      const r = state.sightRadius;
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          const c = this.cellAt(state, x, y);
          if (!c) continue;
          c.discovered = true;
          // 神识扫过：够强才能察觉隐秘暗室（神识的探索用途）
          if (c.hidden && c.content === "secret" && (state.senseVal || 0) >= 8) {
            c.hidden = false;
            this._log(state, "你的神识扫过一处异样——岩壁之后竟藏着一间暗室！");
          }
        }
      }
    },

    // 可否走入该格
    canMove(state, x, y) {
      const c = this.cellAt(state, x, y);
      if (!c) return false;
      if (TERRAIN[c.terrain].blocked) return false;
      return true;
    },

    // 玩家移动一格（dir: 'up'|'down'|'left'|'right'）。返回事件结果。
    // hooks: { onBeast(cell), onCollect(loot), onConflict(companion) } 由 engine 注入
    move(state, dir, rng = Math.random, hooks = {}) {
      if (state.finished) return { ok: false, reason: "探索已结束" };
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      if (!d) return { ok: false, reason: "方向无效" };
      const nx = state.player.x + d[0], ny = state.player.y + d[1];
      if (!this.canMove(state, nx, ny)) return { ok: false, reason: "此路不通" };

      state.player.x = nx; state.player.y = ny;
      state.steps++;
      this._reveal(state, nx, ny);

      const cell = this.cellAt(state, nx, ny);
      const result = { ok: true, events: [] };

      // 踩到内容
      if (cell.content && !cell.taken) {
        const def = CONTENT[cell.content];
        if (cell.content === "exit") {
          result.events.push({ type: "exit" });
        } else if (cell.content === "mystery") {
          cell.taken = true; cell.content = null;
          result.events.push({ type: "mystery" });   // 吉凶由 engine 抽事件裁定
        } else if (cell.content === "secret" && cell.hidden) {
          // 神识不足者一脚踏空——暗室就在身边却浑然不觉（什么都不发生）
        } else if (def.enemy) {
          result.events.push({ type: "beast", cell, enemy: cell.enemy, boss: !!def.boss, bossLoot: def.boss ? def.loot : null });
        } else if (def.loot && cell.loot) {
          // 采集
          this._collectCell(state, cell);
          result.events.push({ type: "collect", loot: cell.loot, name: def.name, rich: !!def.rich });
        }
      }

      // 同伴行动（玩家每动一步，世界随之流动）
      const compEvents = this._companionsAct(state, rng);
      result.events.push(...compEvents);

      return result;
    },

    _collectCell(state, cell) {
      const loot = cell.loot || {};
      Object.entries(loot).forEach(([item, n]) => { state.bag[item] = (state.bag[item] || 0) + n; });
      const def = CONTENT[cell.content];
      cell.taken = true;
      cell.content = null; cell.loot = null;
      const itemName = (id) => (typeof DATA !== "undefined" && DATA.items && DATA.items[id]) ? DATA.items[id].name : id;
      this._log(state, `你采得「${def.name}」：` + Object.entries(loot).map(([k, n]) => `${itemName(k)}×${n}`).join("、"));
    },

    // 同伴 AI：朝最近的未采资源移动；落到资源格则抢先采走（玩家失之交臂）
    _companionsAct(state, rng) {
      const events = [];
      for (const cp of state.companions) {
        if (!cp.alive || cp.conflicted) continue;
        const target = this._nearestResource(state, cp.x, cp.y);
        if (target) {
          // 朝目标走一格（曼哈顿贪心）
          const dx = Math.sign(target.x - cp.x), dy = Math.sign(target.y - cp.y);
          let moved = false;
          if (dx !== 0 && this.canMove(state, cp.x + dx, cp.y)) { cp.x += dx; moved = true; }
          else if (dy !== 0 && this.canMove(state, cp.x, cp.y + dy)) { cp.y += dy; moved = true; }
          if (moved) {
            const cell = this.cellAt(state, cp.x, cp.y);
            if (cell && cell.content && !cell.taken && CONTENT[cell.content].loot) {
              // 同伴贪婪度决定是否抢采
              if (rng() < cp.greed) {
                const def = CONTENT[cell.content];
                const rich = def.rich;
                cell.taken = true; cell.content = null; cell.loot = null;
                cp.gathered += def.value;
                this._log(state, `${cp.name} 抢先一步，采走了一处「${def.name}」。`);
                events.push({ type: "rival_take", companion: cp, name: def.name, rich });
                // 抢走贵重机缘 + 交情浅 → 可能反目
                if (rich && cp.relation < 8 && rng() < 0.5) {
                  cp.conflicted = true;
                  this._log(state, `${cp.name} 独吞了机缘，对你的眼神也变了——气氛骤然紧张！`);
                  events.push({ type: "conflict", companion: cp });
                }
              }
            }
          }
        }
      }
      return events;
    },

    _nearestResource(state, x, y) {
      let best = null, bd = 1e9;
      for (let yy = 0; yy < state.h; yy++) for (let xx = 0; xx < state.w; xx++) {
        const c = this.cellAt(state, xx, yy);
        if (!c || !c.content || c.taken) continue;
        if (!CONTENT[c.content].loot) continue;   // 只盯可采资源
        const d = Math.abs(xx - x) + Math.abs(yy - y);
        if (d < bd) { bd = d; best = { x: xx, y: yy }; }
      }
      return best;
    },

    // 剩余可采资源数（用于"是否值得继续探"提示）
    remainingResources(state) {
      let n = 0;
      for (const c of state.cells) if (c.content && !c.taken && CONTENT[c.content] && CONTENT[c.content].loot) n++;
      return n;
    },

    // 探索耗时（月）：步数 × 单步耗时，向上取整，至少 1
    timeCostMonths(state) {
      return Math.max(1, Math.round(state.steps * state.stepCost));
    },
  };

  root.Explore = Explore;
  if (typeof module !== "undefined" && module.exports) module.exports = Explore;

})(typeof window !== "undefined" ? window : globalThis);
