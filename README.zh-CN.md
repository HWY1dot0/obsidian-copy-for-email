[English](README.md) | **简体中文**

# Copy for Email and Chat

把选中内容或整篇笔记复制成**可直接发邮件的富文本**。粘进 Gmail、Outlook、Apple Mail、Word 或微信公众号编辑器，排版都不会散 —— 标题、表格、callout、高亮代码、任务列表，甚至 Mermaid 图和数学公式（会转成图片）。同一次复制还带着一份**聊天可用的纯文本**：粘进微信、Slack、iMessage，得到的是结构清晰的干净文本，而不是原始 Markdown。

![Copy for Email and Chat 演示 —— 选中、右键、Copy for email and chat，粘进邮件排版完好](https://raw.githubusercontent.com/HWY1dot0/obsidian-copy-for-email/main/images/demo.gif)

从 Obsidian 直接复制出来的纯 Markdown，粘出去是一堆原始语法（`**加粗**`、`# 标题`、`| 表格 |`）。已有的"复制为 HTML"方案依赖 class 和 `<style>` 块，而邮件客户端在粘贴时会把它们剥掉。本插件换了个思路：

- **把每个样式内联**到每个元素上 —— 这是邮件客户端唯一能稳定保留的格式。
- **把邮件渲染不了的东西栅格化**：Mermaid 图、图表、MathJax 公式和 SVG 都变成嵌入的 PNG 图片。
- **把库内图片嵌入**为 data URI，让它们随文字一起粘过去。
- **固定用一套浅色配色**，即便你用深色 Obsidian 主题，文字在白底邮件里也清晰可读。
- **同时写一份聊天风格的纯文本**：忽略富文本的聊天应用（微信、Slack、iMessage）拿到的是用记号保住结构的干净文本 —— `【标题】`、`「重点」`、`① ② ③` 列表、`▏` 引用条 —— 每个记号都能在设置里自定义。

## 使用

- **复制选中内容** —— 命令面板，或右键选区 → *Copy for email and chat*（编辑视图）。阅读视图里也能用：选中渲染后的文字，再执行命令。
- **复制笔记** —— 复制当前笔记（不含元数据；可选在开头加上标题）。
- **侧边按钮** —— 左侧图标栏的信封按钮：有选中就复制选中，没选中就复制整篇。

然后粘进你的邮件撰写窗口即可。

> [!note]
> 普通的 `Cmd/Ctrl+C` 仍然是 Obsidian 自带的复制（Markdown 文本，或阅读视图里带主题样式的 HTML，邮件客户端渲染得很差）。要拿到可发邮件的版本，请用本插件的命令或菜单项。

## 谁变成谁

| 在 Obsidian 里 | 在邮件里 |
| --- | --- |
| 标题、加粗 / 斜体、高亮 | 带样式的文字（GitHub 浅色配色） |
| 表格（含列对齐） | 带边框的表格 |
| Callout | 带彩色左边框的浅底色块 |
| 代码块 | 带框的等宽字体，含语法配色 |
| 任务列表 | ☑ / ☐ |
| Mermaid / 图表 / 公式 / SVG | PNG 图片 |
| 库内图片嵌入 | 嵌入的图片（data URI） |
| 内部链接与标签 | 纯文本 |
| 外部链接 | 真实链接 |

## 聊天纯文本

聊天应用会完全忽略富文本那份 —— 比如微信的聊天消息根本不支持任何格式。所以同一次复制还会写入一份纯文本版本，用聊天里显示正常的记号把结构画回来：

```
【笔记标题】

■ 一级小节

「重点」以可见的方式保留强调。

▍二级小节

① 第一条
② 第二条
　• 嵌套项

▏ 引用的句子

※ Callout 标题
▏ Callout 正文
```

每个记号都可以在**设置 → Copy for Email and Chat → Plain text** 里自定义：换掉任何记号，或把样式切成 **Minimal** 得到不加修饰的纯文本。表格仍是 `a | b` 行 —— 聊天的比例字体没法对齐列，表格要好看，截图仍是更诚实的选择。

## 说明与限制

- 粘贴的 data URI 图片在 Gmail、Apple Mail、Mac 版 Outlook 和新版 Outlook 里都能显示。Windows 经典版 Outlook 在撰写时可能不显示；只要从受支持的客户端发送，收件人不受影响。
- 图表按你当前的 Obsidian 背景栅格化，所以始终清晰可读；若要在邮件里得到浅色的图，请用浅色主题。
- 移动端上，图表 / 公式会降级为 `[diagram]` 占位符（iOS 无法可靠地栅格化屏幕外的渲染）；文字、表格和图片复制正常。

## 安装

Copy for Email and Chat 已上架 Obsidian **社区插件**目录：

1. 打开**设置 → 第三方插件 → 浏览**。
2. 搜索 **Copy for Email and Chat** 并安装。
3. 启用后，命令和右键菜单项会立即出现。

<details>
<summary>手动安装</summary>

从[最新发布](https://github.com/HWY1dot0/obsidian-copy-for-email/releases/latest)下载 `main.js`、`manifest.json`、`styles.css`，放进 `<库>/.obsidian/plugins/copy-for-email/`，然后在**设置 → 第三方插件**里启用。

</details>

## HWY1dot0 的其它插件

- [Calendar Hub](https://github.com/HWY1dot0/calendar-hub) —— 一个日历，浮出某一天散落在各文件夹里的每一篇笔记。
- [Screenshot Selection](https://github.com/HWY1dot0/obsidian-screenshot-selection) —— 把选中的笔记内容截成忠于主题的 PNG。

如果这个插件帮到了你的工作流，可以[请我喝杯咖啡](https://www.buymeacoffee.com/hwy1dot0)。

## 许可

MIT
