const status = document.getElementById('status');
const output = document.getElementById('report');
const buttons = [...document.querySelectorAll('button')];

async function refresh() {
  output.textContent = JSON.stringify(await window.probe.report(), null, 2);
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    buttons.forEach(item => { item.disabled = true; });
    status.textContent = '验证中…';
    try {
      await window.probe.run(button.dataset.operation);
      await refresh();
      status.textContent = '本次操作已记录；请查看报告中的 passed / failed / cancelled / pending。';
    } catch (error) {
      status.textContent = String(error);
    } finally {
      buttons.forEach(item => { item.disabled = false; });
    }
  });
}

window.probe.ready({ userAgent: navigator.userAgent, nodeExposed: typeof window.require !== 'undefined',
  title: document.title }).then(async () => {
  status.textContent = '隔离桥接已连接，可以开始验证。';
  await refresh();
}).catch(error => { status.textContent = String(error); });
