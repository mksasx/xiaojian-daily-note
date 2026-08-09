Component({
  data: {
    selected: 0,
    tabs: [
      { path: '/pages/today/today', text: '今日', icon: 'home' },
      { path: '/pages/history/history', text: '历史', icon: 'history' },
      { path: '/pages/settings/settings', text: '设置', icon: 'settings' }
    ]
  },

  methods: {
    onSwitchTab(event) {
      const { index, path } = event.currentTarget.dataset;
      if (Number(index) === this.data.selected) return;
      wx.switchTab({ url: path });
    }
  }
});
