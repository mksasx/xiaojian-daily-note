# 小笺

一个轻量的 Windows / macOS 桌面每日待办便签。它把注意力放在“今天要做什么”和“过去完成了什么”上，不引入项目、标签或团队协作等复杂概念。

在线版：[mksasx.github.io/xiaojian-daily-note](https://mksasx.github.io/xiaojian-daily-note/)

## 下载安装

Windows 安装程序和同时支持 Apple 芯片、Intel Mac 的通用 `.dmg` 会发布在 [GitHub Releases](https://github.com/mksasx/xiaojian-daily-note/releases)。

macOS 安装包目前未使用 Apple Developer 证书签名。首次打开时如果被系统拦截，请在 Finder 的“应用程序”中按住 Control 点击“小笺”，选择“打开”，再确认一次。

## 功能

- 每日独立待办，点击切换完成状态
- 浏览任意日期及搜索历史记录
- 一键将前一天未完成事项续到今天
- 今日完成进度、已完成事项折叠
- 双击编辑，悬停删除
- 删除后可撤销，历史日期可直接返回查看
- JSON 备份导出、校验与跨设备无损合并
- 可安装的离线 PWA 手机版，和桌面版共用备份格式
- 原生微信小程序版本，支持按微信用户云同步和手动备份互通
- 窗口置顶、紧凑模式、开机启动
- 本地 JSON 数据存储，原子写入避免意外损坏

## 开发运行

需要 Node.js 22.12 或更高版本。

```bash
npm install
npm start
```

运行测试：

```bash
npm test
```

构建并预览手机 PWA：

```bash
npm run build:pwa
npm run pwa
```

手机端只在本机浏览器保存数据。安装后可以离线使用；跨设备仍通过“导出备份 / 导入并合并”完成。

构建当前平台安装包：

```bash
npm run dist
```

Windows 安装包需在 Windows 上构建，macOS DMG 需在 macOS 上构建。应用数据存放在 Electron 的 `userData` 目录中。

微信小程序项目可直接用微信开发者工具导入仓库根目录，具体说明见 [miniprogram/README.md](miniprogram/README.md)。

推送 `v*.*.*` 格式的版本标签后，GitHub Actions 会自动构建 Windows x64 安装程序和 macOS 通用 DMG，并上传到对应的 GitHub Release。

## 数据与同步

桌面版与网页版的数据仍只保存在当前设备上，多设备之间通过 JSON 备份的“导出 / 导入并合并”传递数据。微信小程序默认本地优先，用户明确开启云同步后，会通过 CloudBase 按小程序 OpenID 隔离并合并同一微信账号的数据。

具体步骤见 [手动多设备同步](MANUAL_SYNC.md)。云同步不会替代手动备份能力。
