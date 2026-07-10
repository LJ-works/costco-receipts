# Costco 订单助手

运行在 costco.com 上的 userscript，用于同步本地订单、按商品查找历史订单，以及检查近期购买商品是否降价。所有订单和商品缓存都保存在浏览器本地，不会上传到第三方服务。

## 功能

### 查找订单

- 按商品名称、订单商品描述或完整商品号查找订单。
- 名称支持大小写不敏感的关键词部分匹配，例如 `dar chi` 可以匹配 `Dark Baking Chip`。
- 结果按日期从新到旧显示。
- 可查看订单中的全部商品、商品号、历史成交价格和折扣。

### 30 天价格匹配

- 检查最近 30 天内的 warehouse 销售订单。
- 使用订单折后价格与商品最新 `listPrice` 比较。
- 自动跳过退款订单、按重量计价商品、已停止销售/无有效价格的商品，以及没有降价的商品。
- 按订单汇总降价商品，并展示商品号、订单原价、折扣、折后旧价格和新价格。

### 本地数据同步

点击「开始使用」后，脚本会先增量同步 warehouse 订单和商品详情，再显示功能选择。首次使用会同步最近 3 年订单；以后只同步上次成功同步以来的订单，并刷新近期购买商品的价格。

## 使用方法

使用前请先登录 [costco.com](https://www.costco.com/)，并在 Safari/浏览器中打开 **Account > Orders & Purchases** 页面，让脚本可以读取 Costco 登录信息。

### 桌面浏览器

1. 安装 userscript 管理器，例如 [Tampermonkey](https://www.tampermonkey.net/)。
2. 打开[最新版 userscript](https://github.com/LJ-works/costco-receipts/releases/latest/download/costco-userjs.user.js)，并在管理器中确认安装。
3. 登录 costco.com，打开 **Account > Orders & Purchases**。
4. 点击页面右下角的「开始使用」。
5. 等待同步完成，然后选择「查找订单」或「30 天价格匹配」。

### iPhone / iPad

需要 iOS/iPadOS 15.1 或更高版本，并使用 Safari。

1. 从 App Store 安装 [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887)。
2. 打开 Userscripts App。新版本会自动设置默认脚本目录；如果页面提示设置目录，请点击 **Set Userscripts Directory** 并选择目录。
3. 在系统设置的 **Safari > Extensions** 中启用 Userscripts；也可从 Safari 的 `AA`/扩展按钮管理扩展。建议允许 Userscripts **Always Allow** 访问 **All Websites**。
4. 在 Safari 中打开[最新版 userscript](https://github.com/LJ-works/costco-receipts/releases/latest/download/costco-userjs.user.js)。
5. 打开 Safari 的 Userscripts 扩展面板，点击出现的安装提示并完成安装。
6. 登录 costco.com，打开 **Account > Orders & Purchases**。
7. 点击页面右下角的「开始使用」，等待同步完成后选择功能。

也可以把下载后的 `costco-userjs.user.js` 直接保存到 Userscripts App 使用的脚本目录中。

## 更新

打开[最新版 userscript](https://github.com/LJ-works/costco-receipts/releases/latest/download/costco-userjs.user.js)并在 userscript 管理器中重新确认安装，即可更新到最新版本。

## 参与开发

开发环境、测试、构建和发布流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
