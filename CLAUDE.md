# 项目：汉字乐园 iPad 版

## 这个项目是什么
把桌面版汉字乐园（`../desktop_version/`）做成 iPad 上用的**网页应用**：在 iPad 的 Safari 里打开网址，
点“添加到主屏幕”，以后从主屏幕图标打开，没有地址栏，没网也能用。iPhone 同样能装。

为什么不是真正的 iPad 应用：那要装 Xcode（苹果的开发工具），用免费账号装上去每 7 天要重装一次，
不想重装就要付 99 美元一年。网页应用不需要这些（2026-11-17 决定）。

## 心智模型
桌面版的主体本来就是一个网页（`web-template.html`），外面套了 Electron（自带 Chrome 内核的窗口工具）。
桌面补丁（`desktop.js`、`desktop-ui.js`、`tracing-ui.js`）只通过 `window.desktopApp` 这几个函数和外壳
打交道：存数据、导出、导入、保存 / 打印描红页。

iPad 版**原样复用**这些网页和补丁，只是换了一个 `window.desktopApp`（`src/ipad-bridge.js`），
用 iPad 上的办法完成同样的事：

| 事情 | Mac（Electron） | iPad（Safari） |
|---|---|---|
| 存老师数据 | 数据文件 `overlay.json` | 浏览器的 IndexedDB 数据库（`src/store.js`） |
| 导出 | “存储为”对话框 | iPad 的分享窗口（隔空投送、存储到文件），不行就下载 |
| 导入 | “打开”对话框 | 选文件（“文件”App） |
| 描红页 | 保存 PDF / 打印 | iPad 的打印窗口（可以 AirPrint 打印，也可以存成 PDF） |

**学习功能要改 → 改网页版，桌面版重新生成后，这里再 build 一次。** 描红页排版在桌面版的
`tracing-sheet.js` 里，两边共用。

## 老师数据不上网
`docs/` 会公开发布到 GitHub Pages（免费版只能公开），所以里面**只有应用本身**（生字、笔顺、页面），
没有老师的课文、录音、密码。`tools/build.js` 发现里面有老师数据就拒绝生成。
老师数据在 iPad 上第一次打开时导入（Mac 上 文件 → 导出网页版文件 → 隔空投送到 iPad → 导入），
之后只存在这台 iPad 上。**iPad 和 Mac 之间不会自动同步**，要靠导出 / 导入文件（整体替换，不是合并）。

## 启动过程（为什么有 index.html 和 app.html 两个页面）
网页自己的脚本在页面加载的那一刻就要读老师数据（`<script id="overlay-data">` 标签）。
IndexedDB 只能异步读，来不及。所以：
1. `index.html` + `loader.js` 先从 IndexedDB 读出数据；
2. 取来 `app.html`（应用页面，老师数据标签是空的），把数据填进标签；
3. 用 `document.write` 把自己整个换成这个页面。之后和 Mac 上一样启动。

数据读不出来（坏了）时，`loader.js` 用最新的一份备份恢复，并在页面顶部提示。

## 目录
```
src/index.html        启动页（主屏幕图标打开的就是它）
src/loader.js         读数据、填进 app.html、换成应用页面；登记离线缓存
src/store.js          IndexedDB：老师数据、每日备份（留 7 份）、导入前备份（留 5 份）
src/ipad-bridge.js    iPad 版的 window.desktopApp：保存、导出、导入、打印描红页
src/ipad-ui.js        iPad 特有的界面：导出/导入/修改密码按钮、第一次打开的欢迎卡片、
                      切到后台时立刻保存、Mac 录音（webm）的备用播放、触屏设置、描红按钮文字
src/sw.js             离线缓存（service worker）：app 的全部文件 + 老师新加字的笔顺数据
src/manifest.webmanifest  主屏幕应用的名字、图标
tools/build.js        从 ../desktop_version 和 src/ 生成 docs/；检查没有老师数据
tools/check.js        自动检查：WebKit（iPad Safari 的内核）+ iPad 屏幕和触屏
docs/                 【生成】要发布的网站，不要手工改
dev-data/             测试数据和截图（含老师数据，不进 git）
.pw-browsers/         检查用的 WebKit 浏览器（不进 git）
```

## 发布
网址：**https://jennyjacunski.github.io/hanzi-leyuan-ipad/**（GitHub Pages，公开仓库
`JennyJacunski/hanzi-leyuan-ipad`，从 `main` 分支的 `docs/` 发布）。
更新：`npm run build` → `npm run check` → 提交 → `git push`，GitHub 一分钟左右自动更新网站。
这个仓库的提交邮箱设成了 GitHub 的不公开地址（只在本仓库的 git 设置里），不要改回私人邮箱。

## 常用命令
- `npm run build` —— 生成 `docs/`（桌面版 `app/` 里的文件变了以后要重新 build）
- `npm run check` —— 自动检查，17 项；截图在 `dev-data/check/`
- 第一次在新电脑上：`npm install`，再 `PLAYWRIGHT_BROWSERS_PATH=.pw-browsers npx playwright install webkit`

## 已知的事
- **录音格式**：Mac 录的是 webm。检查用的 WebKit 26 能直接播放；万一真 iPad 不能，`ipad-ui.js`
  会改用 Web Audio 解码播放（课文播放器换成 WAV）。iPad 上录的是 mp4（AAC），Mac 能播放。
- **描红页**：打印的副本里所有 id 加了 `print-` 前缀，因为预览里有同样的 id，`<use>` 会指到
  隐藏的预览上，字和拼音就印不出来。
- **楷体**：iPad 上没有 Mac 的“楷体-简”，描红页上的“笔画 / 结构 / 部首 / 组词”这些小字会用别的字体。
  大字和描红的字是笔画数据画的，不受影响。
- 更新：发布新版后，iPad 有网时打开一次会在后台取新文件，**再下一次**打开才是新版。
- 检查用的 WebKit 不是真 iPad：分享窗口、打印窗口、麦克风、朗读声音只能在真 iPad 上确认。

## 约定
- 和桌面版一样：JavaScript，每个文件开头写它负责什么、不能做什么；界面文字是中文。
- **不改桌面版**来迁就 iPad：需要的不同都在 `src/` 里。
