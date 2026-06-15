/* ============================================================
 * main.js — 启动、界面切换、事件绑定
 * ============================================================ */

const Main = {
  testedRoot: null,

  init() {
    // —— 一次性清理：旧版把实时配图(base64)塞进 localStorage，约 5MB 占满配额，
    //    导致密钥/存档存不进去。现已改为预生成固定图，这里把遗留的图缓存彻底清掉。——
    try {
      localStorage.removeItem("frxxz_art_cache_v1");
      localStorage.removeItem("frxxz_art_cfg_v1");
    } catch (e) {}

    // —— 角色创建：测灵根 ——
    UI.el("btn-test-root").addEventListener("click", () => this.testRoot());
    UI.el("btn-start").addEventListener("click", () => this.startGame());
    UI.el("btn-load").addEventListener("click", () => this.loadGame());

    // —— 顶栏 ——
    UI.el("btn-save").addEventListener("click", () => {
      State.save() ? UI.toast("已存档") : UI.toast("存档失败", true);
    });
    UI.el("btn-menu").addEventListener("click", () => this.toCreate());
    UI.el("btn-techniques").addEventListener("click", () => UI.openTechniques());
    const btnLlm = UI.el("btn-llm");
    if (btnLlm) btnLlm.addEventListener("click", () => UI.openLLMSettings());
    UI.el("btn-chronicle").addEventListener("click", () => UI.openChronicle());
    UI.el("btn-codex").addEventListener("click", () => UI.openCodex());
    const btnAtlas = UI.el("btn-atlas");
    if (btnAtlas) btnAtlas.addEventListener("click", () => UI.openAtlas());

    // —— 系统菜单（手机端 ☰）——
    const btnMore = UI.el("btn-more");
    if (btnMore) btnMore.addEventListener("click", () => UI.openSystemMenu());

    // —— 音效开关 ——
    const btnSound = UI.el("btn-sound");
    if (btnSound && typeof Sfx !== "undefined") {
      const paint = () => {
        const on = Sfx.enabled();
        btnSound.textContent = on ? "音" : "静";
        btnSound.style.opacity = on ? "" : ".55";
        btnSound.title = on ? "音效已开（点击关闭）" : "音效已关（点击开启）";
      };
      paint();
      btnSound.addEventListener("click", () => { Sfx.toggle(); paint(); UI.toast(Sfx.enabled() ? "音效已开" : "音效已关"); });
    }

    // —— 行动按钮：由 UI.renderActions 动态生成并绑定 ——
    // 大地图已内嵌在「所在」面板（renderLocMap），点图标即前往，无需独立云游按钮
    const travelBtn = document.querySelector('[data-action="travel"]');
    if (travelBtn) travelBtn.addEventListener("click", () => Engine.doAction("travel"));

    // —— 手机底部分页：切换中间/左/右面板（窄屏）——
    document.querySelectorAll(".mtab").forEach(tab => {
      tab.addEventListener("click", () => UI.switchMobileTab(tab.dataset.tab));
    });

    // 点击遮罩空白关闭弹窗（奇遇/剧情等必须选择的弹窗除外）
    UI.el("modal-overlay").addEventListener("click", (e) => {
      if (e.target.id === "modal-overlay" && !Engine._pendingFortune) UI.closeModal();
    });

    // 键盘推进剧情（桌面：空格/回车 = 轻触继续）
    document.addEventListener("keydown", (e) => {
      if (e.key !== " " && e.key !== "Enter") return;
      const ov = UI.el("story-overlay");
      if (ov && !ov.hidden) { e.preventDefault(); UI.storyAdvance(); }
    });

    // 根治移动端双击/捏合缩放锁死 UI（iOS 不尊重 user-scalable=no，须 JS 拦截）
    document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
    let _lastTouch = 0;
    document.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - _lastTouch < 320 && e.cancelable) {
        e.preventDefault();                      // 拦下系统双击缩放
        if (e.target && e.target.click) e.target.click();   // 手动补发点击，快速连点不丢拍
      }
      _lastTouch = now;
    }, { passive: false });

    // —— 一键导入密钥（免输入）——
    // 形如 #k=<活世界key>&i=<生图key>（也兼容旧的 llmkey=/imgkey=）。
    // hash 只存在于浏览器地址，不会发往服务器、不入仓库，安全。导入后即写本机并清掉URL。
    try {
      const h = decodeURIComponent(location.hash || "");
      const pick = (re) => { const m = h.match(re); return m ? m[1].trim() : null; };
      const lk = pick(/[#&](?:k|llmkey)=([^&]+)/);
      const lm = pick(/[#&]m=([^&]+)/);
      let imported = false;
      if (lk && typeof LLM !== "undefined") { LLM.configure({ key: lk, model: lm || undefined, on: true }); imported = true; }
      else if (lm && typeof LLM !== "undefined") { LLM.configure({ model: lm }); }
      if (lk || lm) history.replaceState(null, "", location.pathname + location.search);
      if (imported) setTimeout(() => UI.toast("已导入密钥：活世界已开启"), 600);
    } catch (e) {}

    // 有存档则提示
    if (!State.hasSave()) UI.el("btn-load").style.display = "none";

    // —— 分享链接带活世界 key：?llmkey=sk-...&llmmodel=...（发给朋友即开即玩）——
    //    落地即存（localStorage）+ 地址栏即抹（replaceState 防 key 留在历史/再次分享泄漏）
    try {
      const q0 = new URLSearchParams(location.search);
      const lk = q0.get("llmkey");
      if (lk && typeof LLM !== "undefined" && LLM.configure) {
        LLM.configure({ key: lk, model: q0.get("llmmodel") || undefined, on: true });
        q0.delete("llmkey"); q0.delete("llmmodel");
        const qs = q0.toString();
        history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
        console.log("[LLM] 活世界已由分享链接唤醒");
      }
    } catch (e) { console.error("llm 链接导入失败", e); }

    // —— 开发调试入口：?debugfight=敌id[&layer=N][&side=1] 直接开打（战斗 UI 调试免跑剧情）——
    try {
      const q = new URLSearchParams(location.search);
      const foe = q.get("debugfight");
      if (foe) {
        State.create("韩立", DATA.fixedRootId);
        const s = State.data;
        const layer = parseInt(q.get("layer") || "11", 10);
        s.realmIndex = Math.max(0, Math.min(DATA.realms.length - 1, layer - 1));
        s.hpMax = 100 + (layer - 1) * 15; s.hp = s.hpMax;
        s.spirit = (DATA.realms[s.realmIndex] || {}).spMax || 999;   // 满灵力开战（满水位法力池）
        s.spells = ["tuna", "huti", "ningshen", "zhayan", "zhayan_lian", "weidu", "feizhen", "huodan"];
        State.give("duyao_cao", 3); State.give("anqi", 3);
        State.give("huoshe_fu", 2); State.give("hanbing_fu", 1);
        State.give("jinguang_zhuan", 1); State.give("jinguang_zhuan_charge", 3);
        State.give("huixue_dan", 2); State.give("huiyuan_dan", 2); State.give("dingshen_fu", 2);
        State.give("zhenqi_kunzu", 2); State.give("zhenqi_juling", 1);
        if (q.get("side")) s.sideUnit = { id: "zhangtie_corpse", name: "铁奴·张铁", kind: "corpse", hp: 70, hpMax: 70, atk: 12, atkName: "尸傀挥击", nature: "corpse", guard: 0.3, status: "ok", carry: true };
        if (q.get("fly")) State.setFlag("fly_unlocked");   // 空层调试：?fly=1 解锁腾空
        this.enterGame();
        setTimeout(() => Engine.startEncounterFight(foe), 300);
        // 特效校验台：?fxdemo=配方名 | all（轮播） | plate（九宫同放+定帧镜像，截图验收用）
        // （嵌入式截图管线不合成 GPU canvas 层；真机/正常浏览器无此问题，镜像仅调试用）
        const fxq = q.get("fxdemo");
        if (fxq) setTimeout(() => {
          const field = UI.el("axis-field");
          if (!field || typeof Fx === "undefined" || !Fx.ensure(field)) return;
          const mirror = document.createElement("img");
          mirror.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:27;pointer-events:none;";
          field.appendChild(mirror);
          const r = field.getBoundingClientRect();
          if (fxq === "plate") {
            // 九宫定帧大合影：同刻齐放，340ms 处冻结主循环（canvas 不再清屏），镜像一次
            // fxset=jinlei → 辟邪神雷专台（金雷三连+金天雷，验收"最好看的金色雷"）
            Fx._budget = 4000;   // 验收台放开预算
            const ids = (q.get("fxset") === "jinlei")
              ? ["shenlei_pi", "shenlei_fujian", "leidun", "leidun_out", "GOLDLIGHTNING", "GOLDLIGHTNING"]
              : ["qingyuan_jianmang", "huoshe_fu", "hanbing_fu", "jinguang_zhuan", "dingshen_fu", "feizhen", "zhayan_lian", "tuna", "LIGHTNING"];
            ids.forEach((id, i) => {
              const cx = (i % 3) * 0.33, cy = Math.floor(i / 3) * 0.3;
              const from = { x: r.width * (cx + 0.04), y: r.height * (cy + 0.24) };
              const to = { x: r.width * (cx + 0.27), y: r.height * (cy + 0.22) };
              if (id === "LIGHTNING") Fx.lightning(to.x, to.y, { life: 2000 });
              else if (id === "GOLDLIGHTNING") Fx.lightning(to.x, to.y, { gold: true, life: 2000 });
              else Fx.RECIPES[id](Fx, from, to);
            });
            setTimeout(() => {
              cancelAnimationFrame(Fx._raf);
              Fx._raf = -1; Fx._run = function () {};   // 冻结：保留最后一帧
              try { mirror.src = Fx._cv.toDataURL(); console.log("[fxdemo] plate frozen+mirrored"); } catch (e) { console.log("[fxdemo] mirror fail", e); }
            }, parseInt(q.get("fxat") || "340", 10));
          } else {
            setInterval(() => { try { mirror.src = Fx._cv.toDataURL(); } catch (e) {} }, 380);
            const from = { x: r.width * 0.22, y: r.height * 0.62 };
            const to = { x: r.width * 0.74, y: r.height * 0.6 };
            const seq = fxq === "all"
              ? ["qingyuan_jianmang", "huoshe_fu", "hanbing_fu", "jinguang_zhuan", "dingshen_fu", "feizhen", "zhayan_lian", "tuna", "LIGHTNING"]
              : [fxq];
            seq.forEach((id, i) => setTimeout(() => {
              if (id === "LIGHTNING") Fx.lightning(to.x, to.y, { life: 900 });
              else if (Fx.RECIPES[id]) Fx.RECIPES[id](Fx, from, to);
              console.log("[fxdemo] cast", id);
            }, 900 + i * 1400));
          }
        }, 1000);
      }
    } catch (e) { console.error("debugfight 失败", e); }

    // —— 完整对局演武场：?demo=1 ——
    //    一局打满全部系统：南宫婉客随统帅（点将/接应）+ 赤目狼王（老练 AI·火系：寒冰符
    //    克制教学+材质反应）+ 战中采集热点 + 空层（升空/俯击/击落）+ 全套底牌 + 分功法特效
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("demo")) {
        State.create("韩立", DATA.fixedRootId);
        const s = State.data;
        s.realmIndex = 10;   // 练气十一层
        s.hpMax = 250; s.hp = 250;
        s.spirit = (DATA.realms[10] || {}).spMax || 200;
        s.technique = "changchun"; s.name = "韩立";
        // 出战法术恒 6（v96）+法宝三位制演示：青竹蜂云剑=本命主攻（持续剑阵+神雷附剑）、
        // 如意花篮=悬浮（祭出位）。zimu_ren 留作次级法宝
        s.spells = ["tuna", "huti", "ningshen", "zhayan", "weidu", "huodan", "qingzhu_jian", "zimu_ren", "ruyi_hualan"];
        State.give("lingshi", 20);
        State.give("duyao_cao", 3); State.give("anqi", 3);
        State.give("huoshe_fu", 2); State.give("hanbing_fu", 2);
        State.give("jinguang_zhuan", 1); State.give("jinguang_zhuan_charge", 2);
        State.give("huixue_dan", 2); State.give("huiyuan_dan", 2); State.give("dingshen_fu", 2);
        State.give("zhenqi_kunzu", 2); State.give("zhenqi_juling", 1);
        // 伴身法宝演武（v96 三类法宝制：被动面板件——蕴灵珠回灵+3/护根甲血+20甲+1；
        // dayan flag=伴身槽+1 的演示（练气1槽+大衍诀1=2 槽全用上)
        State.give("yunling_zhu", 1); State.give("hugen_jia", 1);
        s.sideTreasures = ["yunling_zhu", "hugen_jia"];
        State.setFlag("dayan_learned");
        State.setFlag("fly_unlocked");   // 演武解锁腾空（正式内容随御器/风雷翅开放）
        s.storyStage = STORY.length;     // 演武场不跑剧情（免得开场卡压在战后）
        this.enterGame();
        setTimeout(() => {
          // 客随统帅+低阶同道双轨（T4 多侧位演武）：南宫婉（mastery 2=她指挥你）
          // + 万小山（mastery 0=你下简令）——一场看全"统帅/简令"两种指挥关系
          Engine._sideOverride = [
            Object.assign(Engine._nangongwanAlly(), { mastery: 2, hp: 120, hpMax: 120 }),
            { id: "wanxiaoshan", name: "万小山", kind: "ally", art: "wanxiaoshan", mastery: 0,
              hp: 60, hpMax: 60, guard: 0.15, elem: "huo", mp: 26, mpMax: 30,
              persona: { aggr: 4, prot: 1, kite: 4 },
              moves: [
                { name: "火球术", dmg: 11, weight: 12, elem: "huo", range: [1, 3], mp: 4, line: "搓出一颗火球砸去" },
                { name: "符纸·小火蛇", dmg: 15, weight: 5, elem: "huo", range: [1, 3], mp: 6, line: "肉痛地拍出一张符纸——「这张可值钱了！」" },
              ] },
          ];
          // 战场：旷野长轴 + 路边灵物（战中可采——贪与稳）
          // sceneBg=舞台盒森林单图（v90 对照实验：两翼收口构图 vs 三层合成，验"浮在图上"的根因）
          Engine._caveFightCfg = {
            W: 15, lanes: 3, playerPos: 3, sidesPos: [4, 2], enemyPos: 12,   // 旷野=3 排（排数与格数同源）
            sceneBg: "bt_forest",
            hotspots: [
              { id: "d_herb", pos: 2, name: "血色主药", loot: { xueshi_zhuyao: 1 } },   // 在身后：回采=放风筝走位的奖励
              { id: "d_stone", pos: 9, name: "岩缝灵石", loot: { lingshi: 3 } },
            ],
          };
          Engine.startEncounterFight("beast_chimu");
          // 神雷三用途演武（v96：正典=结丹后青竹蜂云剑——演武先行验证"取舍/耗尽"编排）
          if (Engine._combat) {
            const hp0 = Engine._combat.player;
            hp0.charges = { shenlei: { name: "辟邪神雷", cur: 9, max: 9 } };
            hp0.blink = true;   // 演武场解锁雷遁穿空（正典随风雷翅开放）——便于验收遁的瞬移特效
            ["shenlei_pi", "shenlei_fujian", "leidun"].forEach(id => {
              if (!hp0.spells.includes(id)) hp0.spells.push(id);
            });
          }
          if (Engine._combat && Engine._combat.enemies[0]) {
            const king = Engine._combat.enemies[0];
            king.mastery = 1;   // 狼王=兽王老练档
            // 阵型展示（T3 pack）：狼王=领队、灵狼=从者守队形带——杀王则群溃（士气崩）
            king.formation = "pack"; king.leader = true;
            const packWolf = new CombatAPI.Fighter(Object.assign({}, WORLD.enemies.wild_wolf,
              { team: "enemy", lane: 1, pos: 10, formation: "pack" }));
            Engine._combat.enemies.push(packWolf);
            Engine._combat._rollOneIntent(packWolf);
            UI.renderCombat(Engine._combat, Engine._combatMeta);   // 神雷章/编队即时上屏
          }
          Engine._combat._log("【演武】南宫婉负手而立：『赤目狼王凶性十足，正好——你我搭把手，叫你见识见识何为配合。』");
        }, 300);
      }
    } catch (e) { console.error("demo 失败", e); }

    // —— 据点可操作 demo：?citydemo=1 直接进嘉元城节点图（仿演武场，免跑剧情）——
    //    一键进城自由逛 + 底部切换条在三段剧情态间来回切，亲手看复访变迁。
    //    [&stage=warn|cured] 可直链定态；不带则从「初见·门庭冷落」起。
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("citydemo")) {
        State.create("韩立", DATA.fixedRootId);
        const s = State.data;
        s.realmIndex = 10; s.hpMax = 250; s.hp = 250;
        s.spirit = (DATA.realms[10] || {}).spMax || 200;
        s.technique = "changchun"; s.name = "韩立";
        State.give("lingshi", 20);
        s.storyStage = STORY.length;        // demo 不跑剧情
        s.location = "jiayuan_city";
        s.flags.arc1_complete = true; s.flags.mo_met = true;   // 抵城前置（直入据点）
        const stage = q.get("stage");
        if (stage === "warn") s.flags.mo_warned = true;
        else if (stage === "cured") { s.flags.mo_warned = true; s.flags.han_du_cured = true; }
        this.enterGame();
        setTimeout(() => { Engine.enterStronghold("jiayuan_city_l1"); this._cityDemoBar(stage); }, 300);
      }
    } catch (e) { console.error("citydemo 失败", e); }

    // —— 调试入口：?debugmap=1 直接进血色禁地舆图（探索 v3 调试免跑剧情）——
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("debugmap")) {
        State.create("韩立", DATA.fixedRootId);
        const s = State.data;
        s.realmIndex = 10;   // 练气十一层（禁地准入）
        s.hpMax = 250; s.hp = 250;
        s.spirit = (DATA.realms[10] || {}).spMax || 200;
        s.spells = ["tuna", "huti", "ningshen", "zhayan", "zhayan_lian", "weidu", "feizhen", "huodan", "yufeng"];
        s.technique = "changchun"; s.layer = 11;
        State.give("lingshi", 30); State.give("huixue_dan", 3); State.give("huiyuan_dan", 2);
        State.give("dingshen_fu", 1); State.give("huoshe_fu", 2);
        State.setFlag("xueshi_opened");
        s.location = "huangfeng_gate";
        // 剧情推到禁地段（出图后潭边戏可正常触发，开场剧情不再弹出）
        const jd = STORY.findIndex(st => st.id === "jindi_days");
        if (jd > 0) s.storyStage = jd;
        this.enterGame();
        setTimeout(() => Engine.enterJindiMap(), 300);
      }
    } catch (e) { console.error("debugmap 失败", e); }
  },

  /* -------- 测灵根（按权重随机，命定四灵根）-------- */
  testRoot() {
    // 动画忠实：韩立命定四灵根。给一次"占卜"动画感，但结果固定。
    const rolls = 8;
    let i = 0;
    const resultEl = UI.el("sr-result");
    const descEl = UI.el("sr-desc");
    UI.el("btn-test-root").disabled = true;
    resultEl.classList.add("rolling");
    resultEl.classList.remove("untested");
    descEl.textContent = "灵光流转，正在测算资质……";

    const timer = setInterval(() => {
      const r = DATA.spiritRoots[Math.floor(Math.random() * DATA.spiritRoots.length)];
      resultEl.textContent = r.name;
      resultEl.className = "sr-result";
      resultEl.style.color = r.color;
      i++;
      if (i >= rolls) {
        clearInterval(timer);
        const fixed = DATA.spiritRoots.find(r => r.id === DATA.fixedRootId);
        this.testedRoot = fixed.id;
        resultEl.classList.remove("rolling");
        resultEl.textContent = fixed.name;
        resultEl.style.color = fixed.color;
        descEl.textContent = fixed.desc;
        UI.el("btn-start").disabled = false;
        UI.el("btn-test-root").disabled = false;
        UI.el("btn-test-root").textContent = "命定如此（四灵根）";
      }
    }, 110);
  },

  startGame() {
    if (!this.testedRoot) { UI.toast("请先测灵根", true); return; }
    const name = (UI.el("input-name").value || "韩立").trim();
    State.create(name, this.testedRoot);
    this.enterGame();
    // 开场剧情
    Engine.checkStory();
  },

  loadGame() {
    if (State.load()) {
      this.enterGame();
      // 若存档停在某个待处理剧情，重新渲染该剧情卡
      const s = State.data;
      if (s.pendingEvent) {
        const stage = STORY.find(st => st.id === s.pendingEvent);
        if (stage) UI.renderStory(stage);
      }
      // 存档停在血色禁地（v3 舆图）：重开舆图
      if (s.exmap && UI.openExmap) setTimeout(() => UI.openExmap(), 300);
      UI.toast("读取存档成功");
    } else {
      UI.toast("没有可用的存档", true);
    }
  },

  enterGame() {
    UI.el("screen-create").classList.remove("active");
    UI.el("screen-game").classList.add("active");
    const layout = document.querySelector(".layout");
    if (layout && !layout.getAttribute("data-mtab")) layout.setAttribute("data-mtab", "stage");
    UI.renderNarrative();
    UI.renderAll();
    if (State.data.bottle.unlocked) UI.showBottleButton();
    // 中途存档退出的大陆旅途：自动续走
    if (Engine.resumeJourney) setTimeout(() => Engine.resumeJourney(), 400);
    // 入世即起乐（按所在地点选轨）
    if (typeof Sfx !== "undefined" && Sfx.bgm) Sfx.bgm(UI._bgmForLocation(State.location()));
  },

  /* -------- 嘉元城 demo 切换条（仅 ?citydemo 注入；不入正式流程）--------
   * 三段剧情态来回切——每切一次重入城，落脚字幕＋告示/风声随 flag 改写。 */
  _cityDemoBar(initStage) {
    if (document.getElementById("citydemo-bar")) return;
    const stages = [
      { key: "init", name: "① 初见 · 门庭冷落", flags: {} },
      { key: "warn", name: "② 夜变退敌 · 豺狗缩爪", flags: { mo_warned: true } },
      { key: "cured", name: "③ 寒毒解 · 太南榜文", flags: { mo_warned: true, han_du_cured: true } },
    ];
    const bar = document.createElement("div");
    bar.id = "citydemo-bar";
    bar.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:9999;background:rgba(20,16,12,.94);border:1px solid #b9975b;border-radius:10px;padding:8px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:94vw;box-shadow:0 6px 22px rgba(0,0,0,.55);font-family:inherit";
    const label = document.createElement("span");
    label.textContent = "嘉元城 Demo · 复访变迁：";
    label.style.cssText = "color:#b9975b;font-weight:600;font-size:13px";
    bar.appendChild(label);
    const btns = [];
    const setActive = (b) => btns.forEach(x => { x.style.borderColor = x === b ? "#e6c478" : "#6b5836"; x.style.color = x === b ? "#fff4d6" : "#e8dcc0"; });
    stages.forEach(st => {
      const b = document.createElement("button");
      b.textContent = st.name;
      b.style.cssText = "cursor:pointer;background:#2a221a;color:#e8dcc0;border:1px solid #6b5836;border-radius:6px;padding:5px 10px;font-size:12px;white-space:nowrap";
      b.addEventListener("click", () => {
        const s = State.data;
        delete s.flags.mo_warned; delete s.flags.han_du_cured;   // 先清空再设，保证可来回切
        Object.assign(s.flags, st.flags);
        setActive(b);
        Engine.enterStronghold("jiayuan_city_l1");   // 重入城＝按新 flag 重渲染＋落脚字幕
      });
      btns.push(b); bar.appendChild(b);
    });
    const tip = document.createElement("span");
    tip.textContent = "切换后点地标走动，再看「细读告示 / 探听风声」随剧情态改写";
    tip.style.cssText = "color:#9a8c70;font-size:11px;flex-basis:100%;text-align:center;margin-top:2px";
    bar.appendChild(tip);
    document.body.appendChild(bar);
    const idx = initStage === "warn" ? 1 : initStage === "cured" ? 2 : 0;
    setActive(btns[idx]);
  },

  toCreate() {
    UI.closeModal();
    UI.el("screen-game").classList.remove("active");
    UI.el("screen-create").classList.add("active");
    // 重置创建界面
    this.testedRoot = null;
    UI.el("sr-result").textContent = "未测";
    UI.el("sr-result").className = "sr-result untested";
    UI.el("sr-result").style.color = "";
    UI.el("sr-desc").textContent = "凡人之躯，尚不知有无仙缘。点击下方测试灵根。";
    UI.el("btn-test-root").textContent = "测 灵 根";
    UI.el("btn-test-root").disabled = false;
    UI.el("btn-start").disabled = true;
    if (State.hasSave()) UI.el("btn-load").style.display = "";
  },
};

document.addEventListener("DOMContentLoaded", () => Main.init());
window.Main = Main;
