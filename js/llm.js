/* ============================================================
 * llm.js — 叙述层（可选）：让世界"活"起来的 LLM 接入
 *
 * 设计红线（务必遵守）：
 *  - LLM 只负责「怎么说」，永远不决定「发生了什么」。数值/判定/因果全归引擎。
 *  - 主线剧情对白(story.js)由手写脚本掌控，LLM 绝不改写主线。
 *  - 异步润色：引擎先用模板文字即时显示；LLM 回来后替换该条日志。失败/超时保留模板，玩家无感。
 *  - 可优雅降级：未配 key 时整套不工作，游戏照常玩；无头测试不依赖网络。
 *  - key 不入代码仓库：仅存浏览器 localStorage（公开仓库不能硬编码 key）。
 *
 * 人设连贯 & 记忆：
 *  - 固定 system prompt 设定世界观与叙述口吻（冷静、克制、真实修仙、大道无情）。
 *  - 维护一段「近期记忆」（最近若干条要事/对话摘要），随每次请求带上，保证不割裂、不失忆。
 * ============================================================ */

(function (root) {

  const LS_KEY = "frxxz_llm_cfg_v1";

  const LLM = {
    _cfg: null,        // { key, model, on }
    _queue: [],        // 待处理的润色任务（限流）
    _busy: false,
    _lastCall: 0,
    _minGap: 1200,     // 两次调用最小间隔(ms)，省钱省延迟
    _memory: [],       // 近期记忆（摘要条目，最多 N 条）
    _memMax: 12,

    DEFAULT_MODEL: "deepseek/deepseek-v4-flash",
    ENDPOINT: "https://openrouter.ai/api/v1/chat/completions",

    // —— 配置 ——
    _load() {
      if (this._cfg) return this._cfg;
      try {
        const raw = (typeof localStorage !== "undefined") ? localStorage.getItem(LS_KEY) : null;
        this._cfg = raw ? JSON.parse(raw) : { key: "", model: this.DEFAULT_MODEL, on: false };
      } catch (e) { this._cfg = { key: "", model: this.DEFAULT_MODEL, on: false }; }
      if (!this._cfg.model) this._cfg.model = this.DEFAULT_MODEL;
      return this._cfg;
    },
    _save() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this._cfg)); } catch (e) {}
    },
    configure({ key, model, on }) {
      const c = this._load();
      if (key != null) c.key = key.trim();
      if (model != null) c.model = model.trim() || this.DEFAULT_MODEL;
      if (on != null) c.on = !!on;
      this._save();
    },
    enabled() { const c = this._load(); return !!(c.on && c.key); },
    config() { return Object.assign({}, this._load()); },

    // —— 记忆 ——
    remember(text) {
      if (!text) return;
      this._memory.push(text);
      if (this._memory.length > this._memMax) this._memory.shift();
    },
    _memoryBlock() {
      if (!this._memory.length) return "（暂无近期要事）";
      return this._memory.slice(-this._memMax).map((m, i) => `- ${m}`).join("\n");
    },

    // —— 玩家状态摘要（给模型当上下文，保证贴合处境）——
    _playerContext() {
      if (typeof State === "undefined" || !State.data) return "";
      const s = State.data;
      const realm = (typeof State.realm === "function") ? State.realm().name : "";
      const loc = (typeof State.location === "function" && State.location()) ? State.location().name : "";
      const moodTxt = s.mood < s.moodMax * 0.35 ? "心境不宁" : s.mood > s.moodMax * 0.8 ? "心境平和" : "心境尚可";
      const demonTxt = s.demon > 60 ? "心魔深重" : s.demon > 30 ? "心魔渐生" : "心魔可控";
      return `主角韩立：${realm}，${moodTxt}，${demonTxt}，年${s.age}寿元${s.lifespan}，身处「${loc}」。`;
    },

    _systemPrompt() {
      return [
        "你是《凡人修仙传》同人修仙模拟游戏的叙述者。文风：冷静、克制、古意，符合真实修仙世界——",
        "大道无情、凡人渺小、机缘与凶险并存。不卖弄、不浮夸、不现代化。",
        "严格规则：",
        "1) 你只润色/生成「氛围与叙述文字」，绝不杜撰具体数值、奖励、战斗结果或主线剧情走向。",
        "2) 不引入七玄门篇之外的人物/功法/地名（如青元剑诀、大衍诀、黄枫谷等本篇不得出现）。",
        "3) 保持与「近期要事」「主角状态」一致，不要前后割裂、不要忘记上下文。",
        "4) 默认输出一句到两句中文，简洁有韵味，不加引号、不加解释、不要列点。",
      ].join("\n");
    },

    // —— 核心请求（异步、带超时、失败静默）——
    _chat(messages, { maxTokens = 220, temperature = 0.9, timeout = 12000 } = {}) {
      const c = this._load();
      if (!c.on || !c.key) return Promise.reject(new Error("LLM 未启用"));
      const ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      const to = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
      return fetch(this.ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + c.key,
          "Content-Type": "application/json",
          "X-Title": "FanrenXiuxian",
        },
        body: JSON.stringify({ model: c.model || this.DEFAULT_MODEL, messages, max_tokens: maxTokens, temperature }),
        signal: ctrl ? ctrl.signal : undefined,
      }).then(r => r.json()).then(j => {
        if (to) clearTimeout(to);
        const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!txt) throw new Error("空回复");
        return String(txt).trim().replace(/^["「『]|["」』]$/g, "");
      });
    },

    // —— 润色一条日志（异步替换其 body）——
    // meta: { kind:'rumor'|'worldnews'|'interaction'|'seclusion'|'encounter'|..., prompt:"要点", remember?:bool }
    embellish(entry, meta, onDone) {
      if (!this.enabled() || !entry || !meta) return;
      this._enqueue(() => {
        const messages = [
          { role: "system", content: this._systemPrompt() },
          { role: "user", content:
            `【近期要事】\n${this._memoryBlock()}\n\n【主角状态】${this._playerContext()}\n\n` +
            `【请把下面这条"${meta.label || "事件"}"润色成更有代入感的一两句叙述，保持事实不变】\n${meta.prompt || entry.body}` },
        ];
        return this._chat(messages, { maxTokens: meta.maxTokens || 220, temperature: meta.temp || 0.9 })
          .then(txt => {
            if (txt && txt.length <= 160) {
              entry.body = txt;
              if (meta.remember) this.remember(txt);
              if (onDone) onDone();
            }
          }).catch(() => { /* 静默：保留模板文字 */ });
      });
    },

    // —— 自由生成一段叙述（供 NPC 即兴对话等；返回 Promise<string|null>）——
    generate(promptText, opts = {}) {
      if (!this.enabled()) return Promise.resolve(null);
      const messages = [
        { role: "system", content: this._systemPrompt() },
        { role: "user", content:
          `【近期要事】\n${this._memoryBlock()}\n\n【主角状态】${this._playerContext()}\n\n${promptText}` },
      ];
      return this._chat(messages, opts).catch(() => null);
    },

    // —— 限流队列 ——
    _enqueue(taskFn) {
      this._queue.push(taskFn);
      this._pump();
    },
    _pump() {
      if (this._busy || !this._queue.length) return;
      const now = Date.now();
      const wait = Math.max(0, this._minGap - (now - this._lastCall));
      this._busy = true;
      setTimeout(() => {
        const task = this._queue.shift();
        this._lastCall = Date.now();
        Promise.resolve(task ? task() : null).finally(() => {
          this._busy = false;
          this._pump();
        });
      }, wait);
    },
  };

  root.LLM = LLM;
  if (typeof module !== "undefined" && module.exports) module.exports = LLM;

})(typeof window !== "undefined" ? window : globalThis);
