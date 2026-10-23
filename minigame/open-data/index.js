// 微信好友排行榜开放数据域:运行在独立作用域,把好友成绩画到 sharedCanvas
// 主域通过 postMessage({type:'show'}) 触发刷新;所有异常静默兜底,失败只显示空榜
/* eslint-disable */
var sharedCanvas = wx.getSharedCanvas();
var ctx = sharedCanvas.getContext('2d');
var list = [];

function draw() {
  var W = sharedCanvas.width || 960;
  var H = sharedCanvas.height || 540;
  ctx.fillStyle = '#0e1a2f';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('🏅 好友排行 · 最佳存活', W / 2, 48);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#9db8d8';
  ctx.fillText('只显示玩过本游戏的好友', W / 2, 76);

  if (!list.length) {
    ctx.fillStyle = '#cfe3ff';
    ctx.font = '20px sans-serif';
    ctx.fillText('暂无数据,分享给好友一起玩吧!', W / 2, H / 2);
    return;
  }
  var n = Math.min(list.length, Math.floor((H - 110) / 40));
  for (var i = 0; i < n; i++) {
    var item = list[i];
    var y = 118 + i * 40;
    var rankColor = i === 0 ? '#ffd43b' : i === 1 ? '#c0c8d8' : i === 2 ? '#e8a26a' : '#ffffff';
    var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
    ctx.textAlign = 'left';
    ctx.fillStyle = rankColor;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(medal + ' ' + item.nick, 24, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe066';
    ctx.fillText((item.score / 1000).toFixed(1) + 's', W - 24, y);
  }
}

wx.onMessage(function (msg) {
  if (!msg || msg.type !== 'show') return;
  try {
    wx.getFriendCloudStorage({
      keyList: ['bestTimeMs'],
      success: function (res) {
        list = (res.data || []).map(function (d) {
          var score = 0;
          try {
            var kv = (d.KVDataList || []).filter(function (k) { return k.key === 'bestTimeMs'; })[0];
            var parsed = kv ? JSON.parse(kv.value) : null;
            score = (parsed && parsed.wxgame && parsed.wxgame.score) || 0;
          } catch (e) {}
          return { nick: d.nickname || '微信用户', score: Number(score) || 0 };
        }).filter(function (x) { return x.score > 0; })
          .sort(function (a, b) { return b.score - a.score; })
          .slice(0, 20);
        draw();
      },
      fail: function () { list = []; draw(); }
    });
  } catch (e) { list = []; draw(); }
});

draw();
