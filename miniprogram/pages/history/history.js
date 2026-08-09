const { groupedHistory, progressForDate, tasksForDate } = require('../../utils/task-utils');
const { formatDateHeading } = require('../../utils/format');
const { loadStore } = require('../../utils/store');
const { requestCloudSync } = require('../../utils/cloud-sync');

Page({
  data: {
    query: '',
    taskCount: 0,
    dayCount: 0,
    groups: [],
    emptyCopy: '完成第一件小事后，这里会留下足迹。'
  },

  onShow() {
    this.store = loadStore();
    this.render();
    requestCloudSync().then(() => {
      this.store = loadStore();
      this.render();
    });
  },

  onSearchInput(event) {
    this.setData({ query: event.detail.value }, () => this.render());
  },

  render() {
    const query = this.data.query.trim();
    const groups = groupedHistory(this.store.tasks, query).map(([dateKey, tasks]) => {
      const progress = progressForDate(tasks, dateKey);
      return {
        dateKey,
        title: formatDateHeading(dateKey).historyTitle,
        progressText: `${progress.completed}/${progress.total} 完成`,
        tasks: tasksForDate(tasks, dateKey)
      };
    });
    const dayCount = new Set(this.store.tasks.map((task) => task.date)).size;
    this.setData({
      taskCount: this.store.tasks.length,
      dayCount,
      groups,
      emptyCopy: query ? '没有找到相关记录。' : '完成第一件小事后，这里会留下足迹。'
    });
  },

  onOpenDate(event) {
    getApp().globalData.selectedDate = event.currentTarget.dataset.date;
    wx.switchTab({ url: '/pages/today/today' });
  }
});
