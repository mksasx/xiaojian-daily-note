# 小笺

一个轻量的 Windows / macOS 桌面每日待办便签。它把注意力放在“今天要做什么”和“过去完成了什么”上，不引入项目、标签或团队协作等复杂概念。

## 功能

- 每日独立待办，点击切换完成状态
- 浏览任意日期及搜索历史记录
- 一键将前一天未完成事项续到今天
- 今日完成进度、已完成事项折叠
- 双击编辑，悬停删除
- 删除后可撤销，历史日期可直接返回查看
- JSON 备份导出、校验与跨设备无损合并
- 可安装的离线 PWA 手机版，和桌面版共用备份格式
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

## 后续同步设计

当前数据访问统一经由 preload API 调用主进程，未来可在不改动界面交互的情况下，把本地存储替换为“本地优先 + 远端增量同步”。建议服务端为任务记录增加 `accountId`、`updatedAt`、`deletedAt` 与版本号，并以任务 ID 做冲突合并。

GitHub、同步盘、Supabase 与 Firebase 的具体取舍见 [SYNC_OPTIONS.md](SYNC_OPTIONS.md)。

不联网的多设备操作步骤见 [MANUAL_SYNC.md](MANUAL_SYNC.md)。
