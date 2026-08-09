const { dateFromKey } = require('./task-utils');

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function formatDateHeading(key) {
  const date = dateFromKey(key);
  return {
    weekday: weekdays[date.getDay()],
    title: `${date.getMonth() + 1}月${date.getDate()}日`,
    historyTitle: `${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`
  };
}

module.exports = { formatDateHeading };
