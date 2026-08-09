const { localDateKey, mergeStores, normalizeBackup } = require('../../utils/task-utils');
const { loadStore, saveStore } = require('../../utils/store');
const {
  getSyncState,
  subscribeSyncState,
  requestCloudSync
} = require('../../utils/cloud-sync');

function formatSyncTime(isoTime) {
  if (!isoTime) return '';
  const date = new Date(isoTime);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function syncPresentation(state) {
  const presentations = {
    idle: {
      title: '等待自动同步',
      copy: '进入小程序或恢复联网后，会自动合并本机和云端记录。',
      tone: 'pending'
    },
    syncing: {
      title: '正在同步',
      copy: '正在安全合并本机和云端记录…',
      tone: 'syncing'
    },
    synced: {
      title: '已同步',
      copy: state.lastSyncedAt ? `最近同步 ${formatSyncTime(state.lastSyncedAt)}` : '本机与云端记录一致。',
      tone: 'synced'
    },
    setup_required: {
      title: '等待数据库配置',
      copy: '请创建 daily_note_users 集合，并设为“仅创建者可读写”。',
      tone: 'error'
    },
    offline: {
      title: '当前离线',
      copy: '待办已保存在本机，恢复联网后会自动补同步。',
      tone: 'pending'
    },
    unsupported: {
      title: '当前基础库不支持云开发',
      copy: '请升级微信或开发者工具后再试。',
      tone: 'error'
    },
    error: {
      title: state.errorCode === 'PERMISSION_DENIED' ? '数据库权限需要调整' : '暂时无法同步',
      copy: state.errorCode === 'PERMISSION_DENIED'
        ? '请确认集合权限为“仅创建者可读写”。'
        : '本机数据不受影响，稍后可以再次尝试。',
      tone: 'error'
    }
  };
  return presentations[state.status] || presentations.idle;
}

Page({
  data: {
    taskCount: 0,
    dayCount: 0,
    appVersion: '1.2.0',
    syncTitle: '等待自动同步',
    syncCopy: '进入小程序或恢复联网后，会自动合并本机和云端记录。',
    syncTone: 'pending',
    isSyncing: false,
    clearDataTitle: '清空本机与云端数据',
    clearDataCopy: '删除本机与云端的全部待办，设置和备份不受影响'
  },

  onLoad() {
    this.unsubscribeSyncState = subscribeSyncState((state) => this.applySyncState(state));
  },

  onShow() {
    this.refreshSummary();
    this.applySyncState(getSyncState());
    if (this.getTabBar) this.getTabBar().setData({ selected: 2 });
    requestCloudSync().then(() => this.refreshSummary());
  },

  onUnload() {
    if (this.unsubscribeSyncState) this.unsubscribeSyncState();
  },

  onClosePanel() {
    wx.switchTab({ url: '/pages/today/today' });
  },

  applySyncState(state) {
    const presentation = syncPresentation(state);
    this.setData({
      syncTitle: presentation.title,
      syncCopy: presentation.copy,
      syncTone: presentation.tone,
      isSyncing: state.status === 'syncing'
    });
  },

  refreshSummary() {
    const store = loadStore();
    this.setData({
      taskCount: store.tasks.length,
      dayCount: new Set(store.tasks.map((task) => task.date)).size,
      clearDataTitle: '清空本机与云端数据',
      clearDataCopy: '删除本机与云端的全部待办，设置和备份不受影响'
    });
  },

  backupPayload() {
    const store = loadStore();
    return JSON.stringify({
      ...store,
      exportedAt: new Date().toISOString(),
      appVersion: this.data.appVersion,
      source: 'wechat-miniprogram'
    }, null, 2);
  },

  onExportBackup() {
    const data = this.backupPayload();
    const fileName = `小笺备份-${localDateKey()}.json`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    const fileSystem = wx.getFileSystemManager();
    try {
      // Keep file creation and sharing inside the user's tap gesture.
      fileSystem.writeFileSync(filePath, data, 'utf8');
      if (typeof wx.shareFileMessage === 'function') {
        wx.shareFileMessage({
          filePath,
          fileName,
          fail: () => this.copyBackupToClipboard(data)
        });
      } else {
        this.copyBackupToClipboard(data);
      }
    } catch (error) {
      console.error('Unable to export backup file', error);
      this.copyBackupToClipboard(data);
    }
  },

  copyBackupToClipboard(data = this.backupPayload()) {
    wx.setClipboardData({
      data,
      success: () => wx.showModal({
        title: '备份文本已复制',
        content: '可以把它保存到自己的聊天或文档中。恢复时在本页点击“从剪贴板导入”。',
        showCancel: false
      })
    });
  },

  onImportFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (result) => {
        const selected = result.tempFiles && result.tempFiles[0];
        if (!selected || !selected.path) return;
        wx.getFileSystemManager().readFile({
          filePath: selected.path,
          encoding: 'utf8',
          success: (file) => this.applyBackup(file.data),
          fail: () => this.showInvalidBackup()
        });
      }
    });
  },

  onImportClipboard() {
    wx.getClipboardData({
      success: (result) => this.applyBackup(result.data),
      fail: () => this.showInvalidBackup()
    });
  },

  applyBackup(raw) {
    try {
      const incoming = normalizeBackup(JSON.parse(raw), {});
      const merged = mergeStores(loadStore(), incoming, {});
      saveStore(merged);
      this.refreshSummary();
      requestCloudSync({ force: true }).then(() => this.refreshSummary());
      wx.showToast({ title: '备份已合并', icon: 'success' });
    } catch (error) {
      console.error('Unable to import backup', error);
      this.showInvalidBackup();
    }
  },

  showInvalidBackup() {
    wx.showModal({
      title: '无法导入',
      content: '没有识别到有效的小笺 JSON 备份。',
      showCancel: false
    });
  },

  onClearData() {
    wx.showModal({
      title: '清空本机与云端？',
      content: '此操作无法撤销，建议先导出一份备份。',
      confirmText: '清空',
      confirmColor: '#b45d4c',
      success: (result) => {
        if (!result.confirm) return;
        const store = loadStore();
        const deletedAt = new Date().toISOString();
        const deletionMap = new Map(store.deletedTasks.map((entry) => [entry.id, entry]));
        store.tasks.forEach((task) => deletionMap.set(task.id, { id: task.id, deletedAt }));
        store.tasks = [];
        store.deletedTasks = [...deletionMap.values()];
        saveStore(store);
        this.refreshSummary();
        requestCloudSync({ force: true }).then(() => this.refreshSummary());
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  }
});
