---
inclusion: always
---

# Git / 网络代理（务必遵守）

本机直连 github.com 的 443 端口经常不通（push/pull 会卡 ~21s 后报
`Failed to connect to github.com port 443`）。**所有 git 远程操作必须走本地代理 7890。**

## 已做的持久化配置
仓库 `.git/config` 已写入：
```
[http]
    proxy = http://127.0.0.1:7890
[https]
    proxy = http://127.0.0.1:7890
```
所以**正常 `git push` / `git pull` 即会自动走代理，无需额外参数**。

## 如果某次仍然连不上
- 临时单次走代理：`git -c http.proxy=http://127.0.0.1:7890 push`
- 校验已生效：`git config --get http.proxy`（应输出 `http://127.0.0.1:7890`）
- 抓网页/接口核对剧情等，用：`curl.exe -s -x http://127.0.0.1:7890 -A "Mozilla/5.0" "<url>"`
  （PowerShell 里要用 `curl.exe`，`curl` 是 Invoke-WebRequest 的别名）

## 规则
- 不要再尝试无代理直连，直接走 7890。
- 遇到 push 报 443 连接失败，先确认代理配置仍在，再重试；不要误判为代码问题。
