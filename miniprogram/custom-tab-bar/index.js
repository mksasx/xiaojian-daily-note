Component({
  data: {
    selected: 0,
    tabs: [
      {
        path: '/pages/today/today', text: '今日',
        iconPath: '/assets/nav-today.svg', selectedIconPath: '/assets/nav-today-active.svg'
      },
      {
        path: '/pages/history/history', text: '历史',
        iconPath: '/assets/nav-history.svg', selectedIconPath: '/assets/nav-history-active.svg'
      },
      {
        path: '/pages/settings/settings', text: '设置',
        iconPath: '/assets/nav-settings.svg', selectedIconPath: '/assets/nav-settings-active.svg'
      }
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
