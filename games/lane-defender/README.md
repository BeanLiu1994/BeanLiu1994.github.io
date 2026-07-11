# 通道阻击 · Lane Defender

一个纯前端（HTML5 Canvas + 原生 JS，零依赖、零构建）的竖屏通道射击小游戏。
控制底部角色左右移动并**自动向上开火**，击落各个竖直通道里下来的怪物与奖励，
把它们身上的**数字打到 0** 即击杀或领取升级。漏过的怪物会从上端循环回来，
只有**撞到你本体**才扣减**倍率**，倍率归零即失败。

一份代码，可发布到 **Web / PWA / 桌面 / 手机** 等平台。

---

## 玩法

- 角色在底部，可左右移动（键盘 / 触屏拖动 / 点击左右半区）。
- 角色**自动持续射击**，子弹沿当前位置向上飞。
- 通道里会下来 4 种怪物和 7 种奖励，每个都带一个数字（HP / 需击打次数）。
  - 子弹命中 → 数字递减，到 0 即消灭（怪物）或领取（奖励）。
- 漏过的怪物不会扣血、会循环回顶部；只有**撞到玩家本体**才扣倍率（普通 1、快速 1、坦克 3、射手 2、Boss 5）。
- 射手怪会向下发射子弹，命中你也扣倍率。
- 奖励类型：**射速↑ / 伤害↑ / 穿透↑ / 多重↑ / 斜射↑ / 倍率+ / 分数+**。
- 波次随时间推进，越来越快、怪物越来越硬。

### 操作
- ⌨ 键盘：`←` `→` 或 `A` `D` 移动，`空格` 暂停。
- 📱 触屏：左右拖动角色跟随手指；或轻点屏幕左/右半区迈一步。
- 🤖 自动：右上角「自动」开关开启后，由 AI 自动走位（躲避逼近的敌人与子弹、顺路吃奖励、对准目标射击）；此时手动输入仍可临时覆盖。

---

## 运行（开发 / 试玩）

**方式一：直接打开**（推荐先看效果）
双击 `index.html` 即可，无需任何服务器或安装。

**方式二：本地服务器**（PWA / Service Worker 需要 http 环境）
```bash
# 任选其一，在游戏根目录执行
python -m http.server 8080
# 或
npx serve .
```
浏览器打开 `http://localhost:8080`。

---

## 目录结构

```
D:\project\game
├─ index.html              # 入口页面 + 菜单/暂停/结束覆盖层
├─ styles.css              # 页面与 UI 样式
├─ manifest.webmanifest    # PWA 清单
├─ sw.js                   # Service Worker（离线缓存）
├─ src/js/
│  ├─ config.js            # ★ 所有数值/难度都在这里，调参入口
│  ├─ utils.js             # 工具函数（随机、碰撞、缓动…）
│  ├─ entities.js          # Player / Enemy / Bullet / EnemyBullet / Reward
│  ├─ input.js             # 键盘 + 指针（触屏/鼠标）输入
│  ├─ ui.js                # DOM 菜单控制
│  ├─ game.js              # 主逻辑：状态机/生成/碰撞/升级/HUD/渲染
│  └─ main.js              # 启动 + 主循环（固定步长）
└─ publish/
   ├─ electron/            # 桌面封装（已配好）
   └─ capacitor/           # 移动端封装配置（已配好）
```

---

## 调参

所有手感与难度都集中在 `src/js/config.js`：
- `player`：初始倍率、射速、伤害、穿透、多重射击、移动速度。
- `enemyTypes`：每种怪的 HP、速度、大小、攻击力、颜色、是否射手。
- `rewardTypes`：奖励类型与对应的数字（需击打次数）。
- `spawn`：已废弃（波次节奏改由 `director.js` 动态计算，难度曲线见其 `plan()`）。
- `upgrade`：各升级的增量与上限。

---

## 发布到各平台

游戏是纯静态文件（HTML/CSS/JS），可直接作为静态站点部署，或包进原生壳。

### 1. Web 静态托管
把整个 `D:\project\game` 目录上传到任意静态托管即可：
GitHub Pages / Vercel / Netlify / Cloudflare Pages / 对象存储 + CDN。
根目录即 `index.html`。

### 2. PWA（已内置）
`manifest.webmanifest` + `sw.js` 已就绪。用本地服务器或静态托管打开后即具备
「添加到主屏幕 / 离线运行」能力。如需图标，准备 `192` 和 `512` 尺寸 PNG 并填入
`manifest.webmanifest` 的 `icons` 数组。

### 3. 桌面（Electron，已配好）
```bash
cd publish/electron
npm install
npm start            # 本地运行
npm run dist         # 打包 Windows/macOS/Linux 安装包（需 electron-builder）
```

### 4. 手机（Capacitor，已配好配置）
```bash
# 在游戏根目录初始化 web 项目并安装 Capacitor
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init 通道阻击 com.example.lanedefender --web-dir .

# 添加平台
npx cap add android      # 需要 Android Studio
npx cap add ios          # 需要 Xcode（macOS）
npx cap sync
npx cap open android     # 或 npx cap open ios
```
`publish/capacitor/capacitor.config.json` 已把 `webDir` 指向游戏根目录。

### 5. 微信小游戏 / 其他 Runtime
微信小游戏的运行时不支持直接 `document`/`canvas` DOM，需要把渲染层从
`Canvas 2D (DOM)` 改为小游戏适配的 `wx.createCanvas()` + 对应 API，并将
`requestAnimationFrame` / 输入事件替换为 `wx.onTouch*` 等。游戏逻辑
（`config.js` / `entities.js` / `game.js` 的核心算法）可原样复用，
只需替换「渲染与输入适配层」。如有需要可在此基础上再封装一层 adapter。

---

## 技术说明

- 无任何第三方库、无打包步骤；ES5/ES2017 兼容写法。
- 逻辑坐标基于虚拟分辨率 `450×800`，渲染时整体缩放适配任意屏幕（含高清屏 DPR）。
- 主循环使用固定步长累加器，保证不同帧率下手感一致。
- 全部图形由 Canvas 绘制，无外部图片/音频资源，便于分发。

祝玩得开心，也方便二次开发 🎮
