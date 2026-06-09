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

    // —— 舆图折叠开关 ——
    const mapToggle = UI.el("btn-toggle-map");
    if (mapToggle) mapToggle.addEventListener("click", () => UI.toggleMap());

    // 点击遮罩空白关闭弹窗（奇遇/剧情等必须选择的弹窗除外）
    UI.el("modal-overlay").addEventListener("click", (e) => {
      if (e.target.id === "modal-overlay" && !Engine._pendingFortune) UI.closeModal();
    });

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
