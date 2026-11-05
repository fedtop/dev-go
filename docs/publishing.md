# 发布到 Chrome 应用商店

发版（`pnpm release` 升版本号、打 tag、推送）之后，由 GitHub Actions 的「Submit to Web Store」工作流（`.github/workflows/submit.yml`）构建并提交到 Chrome 应用商店。工作流需要仓库 Secret `SUBMIT_KEYS`。

## SUBMIT_KEYS 是什么

[PlasmoHQ/bpp](https://github.com/PlasmoHQ/bpp) 用的一段 JSON，内容是调用 Chrome Web Store API 所需的凭据。格式见 `submit-keys.example.json`：

| 字段                        | 含义                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `extId`                     | 商店里的扩展 ID，DevGo 是 `kcofdbjhicjdbmldlcffcijglkifnnjn` |
| `clientId` / `clientSecret` | Google Cloud 里创建的 OAuth 客户端                           |
| `refreshToken`              | 用上面的客户端授权一次得到的长期令牌                         |

它是 **GitHub 仓库的加密 Secret**，只在 Actions 运行时注入，不是项目里的 `.env`，也不会出现在代码或构建产物里。

## 一次性配置（约 10 分钟）

需要用拥有该扩展的 Google 账号操作。

1. 打开 [Google Cloud 凭据页](https://console.cloud.google.com/apis/credentials)，新建一个项目（名字随意，如 `chrome-webstore-upload`）。
2. [OAuth 同意屏幕](https://console.cloud.google.com/apis/credentials/consent)：用户类型选「外部」，只填应用名称和邮箱；测试用户里加上自己的邮箱。
3. 启用 [Chrome Web Store API](https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com)。
4. 回到凭据页：「创建凭据」→「OAuth 客户端 ID」→ 应用类型选「桌面应用」→ 创建，下载 JSON 存为 `key.json`。
5. 在 OAuth 同意屏幕点「发布应用」（不发布的话 refresh token 7 天后失效）。
6. 在 `key.json` 所在目录运行 `pnpm dlx gcp-refresh-token`，按浏览器提示授权，完成后 `key.json` 里会有 `clientId`、`clientSecret`、`refreshToken`。
7. 在项目根目录：

   ```bash
   cp submit-keys.example.json submit-keys.json   # submit-keys.json 已在 .gitignore 中
   # 把第 6 步得到的三个值填进 submit-keys.json
   pnpm secrets:submit                             # 写入仓库 Secret SUBMIT_KEYS（需要 gh 已登录且有仓库管理权限）
   rm submit-keys.json key.json                    # 设置完即可删除本地文件
   ```

## 每次提交

```bash
gh workflow run submit.yml --ref v<版本号>   # 或在 GitHub Actions 页面手动运行，选对应 tag
gh run watch                                 # 查看进度
```

工作流按所选 ref 执行 `pnpm zip`，把 `.output/dev-go-<版本号>-chrome.zip` 上传并提交审核。审核通过后自动上线。
