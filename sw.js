/* 凡人修仙传 Service Worker —— 离线可玩 + 可装主屏（v105 起）
 *
 * 缓存策略严格遵守 ?v= 版本号，绝不跨版本发旧缓存：
 *  - 缓存名内嵌注册时的 ?v=（来自 index.html 的 sw.js?v=<ver>），
 *    每次发版注册 URL 变 → 新 SW 安装 → activate 时清掉其它版本的缓存。
 *  - 导航(HTML) 与 ver.txt：网络优先（保住「检测到新版自动跳转」逻辑 + 永远拿最新页面），
 *    离线时回退到缓存。
 *  - 其它同源 GET（带 ?v= 的 css/js 及 assets，按版本不可变）：缓存优先，
 *    未命中再走网络并写入缓存。版本一升，URL 即变，自然取到新文件。
 *  - 第三方请求（如活世界 LLM API）一律放行，不拦不缓存。
 */
var VER = new URL(self.location.href).searchParams.get("v") || "0";
var CACHE = "frxxz-v" + VER;
/* 资产持久仓（v321·治「每次发版 500MB 图缓存全清」）：assets/ 的 URL 自带 ?v=ASSET_VER
 * （art.js 管理·图真变了才 bump），版本隔离已由 URL 承担——缓存仓不必随代码版本陪葬。
 * 自此发版只重拉几 MB 代码，图全命中本地缓存。 */
var ASSET_CACHE = "frxxz-assets";
var APP_SHELL = [
  ".",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(APP_SHELL.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        // 资产持久仓跨版本保留（URL 带 ?v=ASSET_VER 自隔离）；只清旧代码缓存
        if (k !== CACHE && k !== ASSET_CACHE && k.indexOf("frxxz-") === 0) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 第三方放行

  var isNav = req.mode === "navigate" || req.destination === "document";
  var isVer = url.pathname.endsWith("ver.txt");

  if (isNav || isVer) {
    // 网络优先：保最新 HTML / 版本号；离线回退缓存
    e.respondWith(
      fetch(req).then(function (fresh) {
        if (fresh && fresh.ok) {
          caches.open(CACHE).then(function (c) { c.put(req, fresh.clone()); }).catch(function () {});
        }
        return fresh;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          if (isNav) {
            return caches.match("index.html").then(function (h) {
              return h || caches.match(".");
            });
          }
          return Response.error();
        });
      })
    );
    return;
  }

  // 其它同源 GET：缓存优先（带 ?v= 版本不可变），缺则网络并写缓存。
  // assets/ 走持久仓（跨版本不清·URL ?v=ASSET_VER 自隔离）；代码走版本仓。
  var isAsset = url.pathname.indexOf("/assets/") >= 0;
  var bucket = isAsset ? ASSET_CACHE : CACHE;
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (fresh) {
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          caches.open(bucket).then(function (c) { c.put(req, fresh.clone()); }).catch(function () {});
        }
        return fresh;
      }).catch(function () {
        return Response.error();
      });
    })
  );
});
