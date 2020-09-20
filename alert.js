browser.runtime.onMessage.addListener(message => {
  if (message.alerts) {
    document.getElementById('alert').innerText = message.alerts.join("\n");
  }
});

document.getElementById('ok').addEventListener('click', async (event) => {
  window.close();
});

browser.runtime.sendMessage({ alertsRequest: true });
