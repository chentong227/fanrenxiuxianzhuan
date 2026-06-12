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
            Fx._budget = 4000;   // 验收台放开预算
            const ids = ["qingyuan_jianmang", "huoshe_fu", "hanbing_fu", "jinguang_zhuan", "dingshen_fu", "feizhen", "zhayan_lian", "tuna", "LIGHTNING"];
            ids.forEach((id, i) => {
              const cx = (i % 3) * 0.33, cy = Math.floor(i / 3) * 0.3;
              const from = { x: r.width * (cx + 0.04), y: r.height * (cy + 0.24) };
              const to = { x: r.width * (cx + 0.27), y: r.height * (cy + 0.22) };
              if (id === "LIGHTNING") Fx.lightning(to.x, to.y, { life: 2000 });
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
        s.spells = ["tuna", "huti", "ningshen", "zhayan", "zhayan_lian", "weidu", "feizhen", "huodan", "zimu_ren"];   // 子母双刃=法宝区（战斗重心展示）
        State.give("lingshi", 20);
        State.give("duyao_cao", 3); State.give("anqi", 3);
        State.give("huoshe_fu", 2); State.give("hanbing_fu", 2);
        State.give("jinguang_zhuan", 1); State.give("jinguang_zhuan_charge", 2);
        State.give("huixue_dan", 2); State.give("huiyuan_dan", 2); State.give("dingshen_fu", 2);
        State.give("zhenqi_kunzu", 2); State.give("zhenqi_juling", 1);
        State.setFlag("fly_unlocked");   // 演武解锁腾空（正式内容随御器/风雷翅开放）
        s.storyStage = STORY.length;     // 演武场不跑剧情（免得开场卡压在战后）
        this.enterGame();
        setTimeout(() => {
          // 客随统帅：南宫婉前辈压阵（mastery 2——她点将，你接应）
          Engine._sideOverride = Object.assign(Engine._nangongwanAlly(), { mastery: 2, hp: 120, hpMax: 120 });
          // 战场：旷野长轴 + 路边灵物（战中可采——贪与稳）
          Engine._caveFightCfg = {
            W: 15, lanes: 3, playerPos: 3, sidePos: 4, enemyPos: 12,   // 旷野=3 排（排数与格数同源）
            hotspots: [
              { id: "d_herb", pos: 2, name: "血色主药", loot: { xueshi_zhuyao: 1 } },   // 在身后：回采=放风筝走位的奖励
              { id: "d_stone", pos: 9, name: "岩缝灵石", loot: { lingshi: 3 } },
            ],
          };
          Engine.startEncounterFight("beast_chimu");
          if (Engine._combat && Engine._combat.enemies[0]) {
            Engine._combat.enemies[0].mastery = 1;   // 狼王=兽王老练档
            // 编队展示（2.5 排制）：头狼压战位、灵狼游走僚位策应——杀穿前排，后排才被逼上来
            const packWolf = new CombatAPI.Fighter(Object.assign({}, WORLD.enemies.wild_wolf, { team: "enemy", lane: 1, pos: 10 }));
            Engine._combat.enemies.push(packWolf);
            Engine._combat._rollOneIntent(packWolf);
          }
          Engine._combat._log("【演武】南宫婉负手而立：『赤目狼王凶性十足，正好——你我搭把手，叫你见识见识何为配合。』");
        }, 300);
      }
    } catch (e) { console.error("demo 失败", e); }

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
