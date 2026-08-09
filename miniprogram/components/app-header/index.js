Component({
  data: {
    statusBarHeight: 20,
    navigationHeight: 48
  },

  lifetimes: {
    attached() {
      try {
        const windowInfo = typeof wx.getWindowInfo === 'function'
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync();
        const capsule = wx.getMenuButtonBoundingClientRect();
        const statusBarHeight = Number(windowInfo.statusBarHeight) || 20;
        const navigationHeight = capsule && capsule.height
          ? capsule.height + Math.max(capsule.top - statusBarHeight, 4) * 2
          : 48;
        this.setData({ statusBarHeight, navigationHeight });
      } catch (error) {
        console.warn('Unable to read Mini Program navigation metrics', error);
      }
    }
  }
});
