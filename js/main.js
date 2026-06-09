/* ============================================================
 * main.js — 启动、界面切换、事件绑定
 * ============================================================ */

const Main = {
  testedRoot: null,

  init() {
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

    // —— 一键导入密钥（免输入）——
    // 形如 #k=<活世界key>&i=<生图key>（也兼容旧的 llmkey=/imgkey=）。
    // hash 只存在于浏览器地址，不会发往服务器、不入仓库，安全。导入后即写本机并清掉URL。
    try {
      const h = decodeURIComponent(location.hash || "");
      const pick = (re) => { const m = h.match(re); return m ? m[1].trim() : null; };
      const lk = pick(/[#&](?:k|llmkey)=([^&]+)/);
      const ik = pick(/[#&](?:i|imgkey)=([^&]+)/);
      const lm = pick(/[#&]m=([^&]+)/);
      const im = pick(/[#&]im=([^&]+)/);
      let imported = false;
      if (lk && typeof LLM !== "undefined") { LLM.configure({ key: lk, model: lm || undefined, on: true }); imported = true; }
      else if (lm && typeof LLM !== "undefined") { LLM.configure({ model: lm }); }
      if (ik && typeof Art !== "undefined") { Art.configure({ key: ik, model: im || undefined, on: true }); imported = true; }
      else if (im && typeof Art !== "undefined") { Art.configure({ model: im }); }
      if (lk || ik || lm || im) history.replaceState(null, "", location.pathname + location.search);
      if (imported) setTimeout(() => UI.toast("已导入密钥：活世界" + (ik ? " + 实时配图" : "") + " 已开启"), 600);
    } catch (e) {}

    // 生成的图回来后，刷新界面让立绘/场景即时显现
    if (typeof Art !== "undefined" && Art.onUpdate) {
      Art.onUpdate(() => { try { UI.renderAll(); } catch (e) {} });
    }

    // 有存档则提示
    if (!State.hasSave()) UI.el("btn-load").style.display = "none";
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
