# 小笺同步方案

小笺目前采用本地优先设计：没有网络也能完整使用，所有数据统一通过主进程的 `loadStore` / `saveStore` 接口读写。联网同步应当作为这一层的增量能力，而不是让应用依赖网络才能启动。

## 方案一：同步盘目录（最省事）

让用户选择 OneDrive、iCloud Drive 或 Dropbox 中的一个文件作为同步文件。应用继续读写 JSON，云盘客户端负责在 Windows 和 macOS 之间传输。

- 优点：不需要服务器、数据库或应用登录，开发量最小。
- 缺点：两台电脑同时修改时可能产生冲突副本；不适合多人或大量设备。
- 适合：个人使用、通常只在一台设备上编辑。
- 下一步实现：增加“选择同步文件”入口、文件变化监听、写入前备份与冲突提示。

## 方案二：GitHub 私有仓库（个人开发者方案）

在用户自己的私有仓库保存 `daily-note.json`，使用 GitHub Contents API 串行读取和更新。每次写入会形成一次提交，因此天然带有历史版本。

- 优点：利用现有 GitHub 账号；不需要自行维护服务器；版本历史清晰。
- 缺点：GitHub 是代码托管服务，不是实时数据库；需要处理令牌、API 限流和 SHA 冲突。
- 安全：不要使用 Gist 保存私人便签，secret gist 并不是真正的私有数据。建议使用私有仓库和仅授权该仓库 Contents 权限的 fine-grained token。令牌必须放在系统凭据库，不能写入 JSON 或前端代码。
- 适合：单用户、少量设备、同步频率不高。
- 同步节奏：启动时拉取，修改后延迟 5–10 秒推送，退出前再推送一次。更新时携带远端文件 SHA；收到 409 后拉取并按任务 ID 合并。

## 方案三：Supabase（推荐的长期方案）

使用 Supabase Auth 登录，把每条待办保存为 Postgres 表中的一行。通过 Row Level Security 保证用户只能读写自己的数据。

- 优点：账号、数据库和权限规则齐全；适合正式的多账户同步；以后容易增加网页端或移动端。
- 缺点：需要创建云项目、设计表结构和同步队列，开发量高于前两种方案。
- 适合：准备长期使用或发布给其他人的版本。

建议表字段：

```text
tasks
  id uuid primary key
  user_id uuid
  text text
  task_date date
  completed boolean
  created_at timestamptz
  updated_at timestamptz
  completed_at timestamptz
  deleted_at timestamptz
  device_id text
```

客户端仍保留本地 JSON，并维护待上传操作队列。联网后按 `updated_at` 合并；删除使用 `deleted_at` 软删除，避免另一台设备把已删除任务重新传回来。

## 方案四：Firebase Firestore

Firestore 客户端自带离线缓存与恢复联网后的同步能力，同一文档冲突默认采用最后写入者获胜。

- 优点：离线同步成熟，接入 Firebase Auth 后开发速度快。
- 缺点：查询和计费模型不同于传统数据库；复杂统计与数据迁移不如 Postgres 直观。
- 适合：希望最快得到成熟离线同步，并计划扩展 Web 或移动端。

## 建议路线

1. 现在：使用已实现的 JSON 导出/恢复做可靠备份。
2. 个人双设备：优先增加“同步盘文件”模式；若两台设备经常同时编辑，改用 GitHub 私有仓库或 Supabase。
3. 多账户正式版：直接使用 Supabase Auth + Postgres RLS，不再继续扩展文件同步方案。

无论选择哪一种，任务 ID 都应保持不变，并保留 `updatedAt`；云同步上线时再增加 `deletedAt`、`deviceId` 和操作队列。
