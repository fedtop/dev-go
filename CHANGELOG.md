# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.1.0](https://github.com/fedtop/dev-go/compare/v0.0.9...v0.1.0) (2026-11-04)

### Features

- **assistant:** 侧边栏改为通用网页助手 ([fdffc7f](https://github.com/fedtop/dev-go/commit/fdffc7ff77e7ecfce275d481f7abcb5674b974d6))
- **assistant:** 新增 WebMCP 侧边栏助手 ([e23f228](https://github.com/fedtop/dev-go/commit/e23f2282dd5f89f746bbe2ce399d745c488ef043))
- **llm:** 新增各家 Coding Plan 与 MiniMax 预设 ([a76e2cc](https://github.com/fedtop/dev-go/commit/a76e2cc5912dc49a1a536fb0e8515c90e761f37e))
- **network:** 代理配置保存栏吸底，有未保存修改时高亮提示并在离开前确认 ([fdc03dd](https://github.com/fedtop/dev-go/commit/fdc03ddcd275c6e7f3997d1104be0e251e5e0a7b))
- **options:** 设置页改为独立标签页，弹窗只保留高频操作 ([ae38241](https://github.com/fedtop/dev-go/commit/ae38241349440103ad58f29bbedc3770909197bb))
- **popup:** 整页翻译按钮显示已绑定的快捷键 ([bf6fc74](https://github.com/fedtop/dev-go/commit/bf6fc7459c33a9b4a95430478a71844594ad394d))
- **popup:** 查词支持 AI 引擎 ([d35d1d1](https://github.com/fedtop/dev-go/commit/d35d1d100a0dc215be5c4b9fa75260f5d26a2543))
- **privacy:** 新增 WebRTC IP 防泄露 ([856095c](https://github.com/fedtop/dev-go/commit/856095cd897297929efacffd37f587451b693af8))
- **proxy:** 自动模式支持自定义代理域名与未命中默认去向，修复规则匹配 ([5dd3701](https://github.com/fedtop/dev-go/commit/5dd3701dfd2da6d3889cf3e3f8674a9518d71af4))
- **selection:** 划词工具条新增 AI 动作，翻译与对话模型分开配置 ([70e75ff](https://github.com/fedtop/dev-go/commit/70e75ffaf850350783aa016f7bdead5f8d18e957))
- **shortcut:** 统一读取命令快捷键并在回到页面时刷新，未绑定时提供设置入口 ([d6e7e63](https://github.com/fedtop/dev-go/commit/d6e7e63c0451bd9ade7d044d1149602b9db54080))
- **translate:** 整页翻译支持 Shadow DOM / Web Components 页面 ([2f4eeac](https://github.com/fedtop/dev-go/commit/2f4eeac8f0b8396bbd6e70062fadfcdd775930f5))
- **ui:** 弹窗、设置页与侧边栏支持暗色主题（与 ai-hive 深色配色一致），设置页「通用」新增外观切换 ([6eb16f6](https://github.com/fedtop/dev-go/commit/6eb16f6bd9e71a33516ad6591b20a40d8ebb4ec2))

### Bug Fixes

- **assistant:** 打开 AI 助手快捷键改为切换，再按一次关闭侧边栏 ([3c7085c](https://github.com/fedtop/dev-go/commit/3c7085c983bb195287448533f2c72366d5ae5363))
- **proxy:** PAC 脚本转义非 ASCII 字符，中文域名规则转 Punycode ([bb3ab75](https://github.com/fedtop/dev-go/commit/bb3ab75a5c492686f7b89e33adb301b10d37fe15))
- **proxy:** 自动模式无任何分流依据时全部直连 ([a221882](https://github.com/fedtop/dev-go/commit/a2218827c7ea9d40bf140b8376ecb4579c6668f6))

### 0.0.5 (2022-12-04)

### Features

- 添加行内和段落对比翻译 ([689c702](https://github.com/wangrongding/super-extensions/commit/689c7024adc8165422cf061896dd4d59653ad05b))
- 添加一些新的功能 ([63adb8a](https://github.com/wangrongding/super-extensions/commit/63adb8ab31b0897332553ffecc56d291de4d8e6b))
- 添加优化翻译和 github 在线编辑功能 ([3d17e53](https://github.com/wangrongding/super-extensions/commit/3d17e5371b5c40081739bba3a6ce6037229eb96c))
- 添加右键菜单和快捷键 ([aee3403](https://github.com/wangrongding/super-extensions/commit/aee3403b9f20f50b5a6b396891c307368990bfc4))
- 完成基本功能 ([10950cb](https://github.com/wangrongding/super-extensions/commit/10950cbead22766130c548e792bd61b354b66754))
- 完善 github 在线编辑功能 ([222cc60](https://github.com/wangrongding/super-extensions/commit/222cc60819229d6a17c294cd80206d86d29ec275))
- 完善 pupup 页面 ([fc099f0](https://github.com/wangrongding/super-extensions/commit/fc099f03124430228dd452f4c6ed6fa2d2cd5584))
- 优化 popup 弹窗样式 ([ff9faf9](https://github.com/wangrongding/super-extensions/commit/ff9faf95b6ef39eb613314b6c3220e08009d2110))
- 优化翻译逻辑,添加新页面 ([bf6db32](https://github.com/wangrongding/super-extensions/commit/bf6db32054eab0f10d955c0fa9e293ca9b770665))
- 优化了页面,添加了一些新的翻译功能 ([3fa3b26](https://github.com/wangrongding/super-extensions/commit/3fa3b26b3c6c627cdc6dcae79a50d240e8eff870))

### Bug Fixes

- 调整空字符的翻译 ([2f6294c](https://github.com/wangrongding/super-extensions/commit/2f6294cb3de553ae38a644484d8349b58c88401b))
- 取消一些事件的覆盖 ([6b699d9](https://github.com/wangrongding/super-extensions/commit/6b699d954d071dc7506250346aeaa2a61a830e04))
- 添加翻译服务连接失败的页面反馈 ([59cfc3f](https://github.com/wangrongding/super-extensions/commit/59cfc3f8913f42a808b88370ecc45a81880acb1a))
- 修复 github 模块中的功能 ([23e33d2](https://github.com/wangrongding/super-extensions/commit/23e33d2b39dc2f79c05ee6369884ebe74eb2a16c))
- 修复『解除用户拷贝的事件限制』的功能导致部分网页白屏的情况 ([655dba3](https://github.com/wangrongding/super-extensions/commit/655dba3da0108820596454ad3cc3d0270d146e6a))
- 修复对段落标签解析方式，针对内联元素翻译解析合并到父级 ([4200d11](https://github.com/wangrongding/super-extensions/commit/4200d11ffa540e1dc8f5f62a527691e890e34bf5))
- 修复样式问题 ([093eb09](https://github.com/wangrongding/super-extensions/commit/093eb095d98469b868428eef9f42dccc911fed46))
- 修复优化翻译的逻辑 ([3bb8d29](https://github.com/wangrongding/super-extensions/commit/3bb8d299b9c5a3f72cbce18f6370526519a90b40))
- 修改重复翻译的问题 ([aa6d3b8](https://github.com/wangrongding/super-extensions/commit/aa6d3b887127356a462b74e72344b6deb9ad78a7))
- 修改 chrome runtime 事件控制逻辑及测试页面 ([e22df78](https://github.com/wangrongding/super-extensions/commit/e22df78d4e9a38a35c7b231e3888d21c4d137ad7))
