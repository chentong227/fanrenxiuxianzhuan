/* ============================================================
 * art.js — 配图层：固定图（仓库 assets/）+ 实时生成图（缓存 localStorage）
 *
 * 设计：
 *  - 第一章核心人物/场景已生成存进仓库 assets/<id>.png（一劳永逸，玩家无需联网）。
 *  - 新人物/新场景：若配置了「生图密钥」(key2)，首次出现时异步生成一次，
 *    存进 localStorage（dataURL）永久缓存，绝不重复生成；未配密钥则回退 emoji/占位。
 *  - 生图用独立密钥与模型（与活世界文字层分开计费），密钥只存本机。
 *
 * 红线同 llm.js：图只是"皮"，不改任何数值/主线/因果。失败静默回退。
 * ============================================================ */
(function (root) {

  const LS_KEY = "frxxz_art_cache_v1";
  const LS_CFG = "frxxz_art_cfg_v1";

  // 仓库内已固定生成的图（id → assets 文件名）。这些直接走本地路径。
  const FIXED = {
    hanli: 1, modafu: 1, lifeiyu: 1, zhangtie: 1,   // 人物
    yaolu: 1, houshan: 1, town: 1, wuting: 1,        // 场景
  };

  const Art = {
    DEFAULT_MODEL: "google/gemini-2.5-flash-image",
    ENDPOINT: "https://openrouter.ai/api/v1/chat/completions",
    _cache: null,
    _cfg: null,
    _inflight: {},   // 防止同一 id 并发重复生成
    _listeners: [],

    // —— 配置（生图密钥/模型，独立于文字层）——
    _loadCfg() {
      if (this._cfg) return this._cfg;
      try {
        const raw = (typeof localStorage !== "undefined") ? localStorage.getItem(LS_CFG) : null;
        this._cfg = raw ? JSON.parse(raw) : { key: "", model: this.DEFAULT_MODEL, on: false };
      } catch (e) { this._cfg = { key: "", model: this.DEFAULT_MODEL, on: false }; }
      if (!this._cfg.model) this._cfg.model = this.DEFAULT_MODEL;
      return this._cfg;
    },
    configure({ key, model, on }) {
      const c = this._loadCfg();
      if (key != null) c.key = key.trim();
      if (model != null) c.model = model.trim() || this.DEFAULT_MODEL;
      if (on != null) c.on = !!on;
      try { localStorage.setItem(LS_CFG, JSON.stringify(c)); } catch (e) {}
    },
    config() { return Object.assign({}, this._loadCfg()); },
    genEnabled() { const c = this._loadCfg(); return !!(c.on && c.key); },

    // —— 运行时缓存（dataURL）——
    // —— 运行时缓存（dataURL）——
    // 图片体积大，放 IndexedDB（配额数百 MB），绝不与 localStorage 的存档/密钥抢空间。
    // url() 需同步可用，故启动时把 IDB 内容载入内存 _cache；写入时内存+IDB 双写。
    _db: null,
    _ready: false,
    initCache() {
      if (this._cache) { this._loadFromIDB(); return; }
      this._cache = {};
      // 迁移：把旧的 localStorage 图缓存搬进内存并清掉（释放 localStorage）
      try {
        const raw = (typeof localStorage !== "undefined") ? localStorage.getItem(LS_KEY) : null;
        if (raw) { Object.assign(this._cache, JSON.parse(raw)); localStorage.removeItem(LS_KEY); }
      } catch (e) {}
      this._loadFromIDB();
    },
    _openDB() {
      return new Promise((resolve, reject) => {
        if (this._db) return resolve(this._db);
        if (typeof indexedDB === "undefined") return reject(new Error("no idb"));
        const req = indexedDB.open("frxxz_art", 1);
        req.onupgradeneeded = () => { req.result.createObjectStore("img"); };
        req.onsuccess = () => { this._db = req.result; resolve(this._db); };
        req.onerror = () => reject(req.error);
      });
    },
    _loadFromIDB() {
      this._openDB().then(db => {
        const tx = db.transaction("img", "readonly").objectStore("img");
        const keysReq = tx.getAllKeys(), valsReq = tx.getAll();
        let keys = null, vals = null;
        const done = () => {
          if (!keys || !vals) return;
          keys.forEach((k, i) => { if (!this._cache[k]) this._cache[k] = vals[i]; });
          // 把迁移进来的旧图回写 IDB（首次迁移）
          this._ready = true;
          this._emit(null);
        };
        keysReq.onsuccess = () => { keys = keysReq.result; done(); };
        valsReq.onsuccess = () => { vals = valsReq.result; done(); };
      }).catch(() => { this._ready = true; });
    },
    _putIDB(id, dataUrl) {
      this._openDB().then(db => {
        db.transaction("img", "readwrite").objectStore("img").put(dataUrl, id);
      }).catch(() => {});
    },
    _loadCache() { if (!this._cache) this.initCache(); return this._cache; },
    // 清空实时配图缓存
    clearCache() {
      this._cache = {};
      try { if (typeof localStorage !== "undefined") localStorage.removeItem(LS_KEY); } catch (e) {}
      this._openDB().then(db => db.transaction("img", "readwrite").objectStore("img").clear()).catch(() => {});
    },

    onUpdate(fn) { this._listeners.push(fn); },
    _emit(id) { this._listeners.forEach(fn => { try { fn(id); } catch (e) {} }); },

    // 仓库内已固定生成的图（id → assets 文件名）。这些直接走本地路径。
    // ASSET_VER：仓库图更新后 bump，强制浏览器重新拉取（避免旧缓存）。
    ASSET_VER: 2,
    url(id) {
      if (!id) return null;
      if (FIXED[id]) return "assets/" + id + ".png?v=" + this.ASSET_VER;
      const c = this._loadCache();
      return c[id] || null;
    },
    has(id) { return !!this.url(id); },

    // —— 确保有图：没有就（异步）生成一次，完成后回调 + 触发监听刷新 ——
    // spec: { kind:'portrait'|'scene', prompt:"画面内容" }
    ensure(id, spec) {
      if (this.url(id)) return;             // 已有（固定/缓存）
      if (!this.genEnabled() || !spec) return;
      if (this._inflight[id]) return;       // 正在生成
      this._inflight[id] = true;
      this._generate(spec).then(dataUrl => {
        delete this._inflight[id];
        if (dataUrl) {
          this._loadCache()[id] = dataUrl;
          this._putIDB(id, dataUrl);
          this._emit(id);
        }
      }).catch(() => { delete this._inflight[id]; });
    },

    STYLE: {
      portrait: "《凡人修仙传》动画剧版同款画风，3D渲染电影级质感，写实国风仙侠人物半身像，精细面部与发丝，柔和暖调布光，景深虚化背景，气质沉静克制，竖构图，单人，无文字无水印无logo",
      scene: "《凡人修仙传》动画剧版同款画风，3D渲染电影级场景，写实国风仙侠，光影氛围考究，意境悠远，横构图，无人物特写无文字无水印",
    },

    _generate(spec) {
      const c = this._loadCfg();
      if (!c.on || !c.key) return Promise.resolve(null);
      const style = this.STYLE[spec.kind] || this.STYLE.scene;
      const ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      const to = ctrl ? setTimeout(() => ctrl.abort(), 30000) : null;
      return fetch(this.ENDPOINT, {
        method: "POST",
        headers: { "Authorization": "Bearer " + c.key, "Content-Type": "application/json", "X-Title": "FanrenXiuxian" },
        body: JSON.stringify({
          model: c.model || this.DEFAULT_MODEL,
          modalities: ["image", "text"],
          messages: [{ role: "user", content: `${style}。画面内容：${spec.prompt}。` }],
        }),
        signal: ctrl ? ctrl.signal : undefined,
      }).then(r => r.json()).then(j => {
        if (to) clearTimeout(to);
        const m = j && j.choices && j.choices[0] && j.choices[0].message;
        const u = m && m.images && m.images[0] && m.images[0].image_url && m.images[0].image_url.url;
        return u || null;
      });
    },

    // —— 便捷：为 NPC / 地点构造生成描述并确保有图 ——
    ensureNpc(npc) {
      if (!npc) return;
      this.ensure(npc.id, { kind: "portrait", prompt: `${npc.role || "修士"}，${npc.bio || npc.name}` });
    },
    ensureLocation(loc) {
      if (!loc) return;
      this.ensure("loc_" + loc.id, { kind: "scene", prompt: `${loc.name}：${loc.desc || ""}` });
    },
    locUrl(loc) {
      if (!loc) return null;
      return this.url(loc.id) || this.url("loc_" + loc.id);
    },
  };

  root.Art = Art;
  if (typeof module !== "undefined" && module.exports) module.exports = Art;

})(typeof window !== "undefined" ? window : globalThis);
