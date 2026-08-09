const { localDateKey, mergeStores, normalizeBackup } = require('../../utils/task-utils');
const { emptyStore, loadStore, saveStore } = require('../../utils/store');

Page({
  data: {
    taskCount: 0,
    dayCount: 0,
    appVersion: '1.0.0'
  },

  onShow() {
    this.refreshSummary();
  },

  refreshSummary() {
    const store = loadStore();
    this.setData({
      taskCount: store.tasks.length,
      dayCount: new Set(store.tasks.map((task) => task.date)).size
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
      title: '清空本机数据？',
      content: '此操作无法撤销，建议先导出一份备份。',
      confirmText: '清空',
      confirmColor: '#b45d4c',
      success: (result) => {
        if (!result.confirm) return;
        saveStore(emptyStore());
        this.refreshSummary();
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  }
});
