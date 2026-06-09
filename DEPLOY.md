# 部署指南 · 让手机随时打开

游戏是纯静态网页（零后端，存档存在浏览器本地），最适合用 **GitHub Pages** 免费永久托管。
托管后会得到一个固定网址，手机在任何网络下都能打开，电脑无需开机。

## 方案 A：GitHub Pages（推荐，永久免费）

### 一次性准备
1. 注册 GitHub 账号（github.com）。
2. 新建一个仓库（Repository），例如名为 `fanren`，设为 Public。

### 推送代码（在项目目录执行）
```
git remote add origin https://github.com/你的用户名/fanren.git
git branch -M main
git push -u origin main
```
> 已经帮你做好了 `git init` 和首次提交，直接执行上面三行即可。

### 开启 Pages
1. 打开仓库页面 → Settings → Pages
2. Source 选 `Deploy from a branch`
3. Branch 选 `main`，目录选 `/ (root)`，Save
4. 等 1~2 分钟，页面顶部会出现网址：
   `https://你的用户名.github.io/fanren/`
5. 手机浏览器打开这个网址，加书签即可随时玩。

之后每次更新，只需：
```
git add -A && git commit -m "更新" && git push
```
Pages 会自动重新发布。

## 方案 B：Vercel / Netlify（拖拽即部署）
- 注册 vercel.com 或 netlify.com
- 把整个项目文件夹拖进去，或连接 GitHub 仓库
- 自动得到一个 https 网址，同样永久可用

## 方案 C：临时内网穿透（仅当下试玩，不持久）
需要电脑保持开机：
```
python -m http.server 8080
```
另开一个窗口做穿透（任选其一）：
- `npx localtunnel --port 8080`（需 npm）
- Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:8080`

会给出一个临时公网网址，关机或重启后失效，网址也会变。
**长期使用请选方案 A 或 B。**

## 注意
- 存档在「手机浏览器的 localStorage」里，换浏览器/清缓存会丢档。
- 同一网址在电脑和手机上是各自独立的存档（不互通）。
