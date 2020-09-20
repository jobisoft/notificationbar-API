// Storage for alerts and other messages
var alerts = [];
// Alerts requests handler
browser.runtime.onMessage.addListener(message => {
  if (message.alertsRequest) {
    browser.runtime.sendMessage({ alerts: alerts });
    alerts = [];
  }
});

browser.compose.onBeforeSend.addListener(async (tab, details) => {
  let body = null;
  if (details.isPlainText) {
    body = details.plainTextBody;
  }
  else {
    body = details.body;
  }

  console.log(Handlebars.Exception);

  let template = Handlebars.compile(body, { strict: true, explicitPartialContext: true });
  let context = { test: "this is a test" };
  try {
    body = template(context);
  }
  catch (e) {
    if (e instanceof Handlebars.Exception) {
      if (/^"[^"]+" not defined in /.test(e.message)) {
        let name = e.message.match(/^"([^"]+)"/)[1];
        console.log(`"${name}" is not defined`);

        let notifyBox = gNotification.notificationbox;
        console.dir(notificationBox);

        alerts.push(`"${name}" is not defined`);
        browser.composeAction.enable(tab.id);
        browser.composeAction.setPopup({ popup: 'alert.html' });
        browser.composeAction.openPopup();
      }
      else {
        console.log("Uncaught exception:");
        console.dir(e);
      }
      return { cancel: true }
    }
    else {
      throw e;
    }
  }

  if (details.isPlainText) {
    return { details: { plainTextBody: body } };
  }
  else {
    return { details: { body: body } };
  }
});
