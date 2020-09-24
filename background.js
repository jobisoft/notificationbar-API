browser.notificationbox.onButtonClicked.addListener((id, label) => {
  console.log(`${label} clicked in ${id}`);
  if (label == "Stay!") {
    console.log("Never gonna give you up!");
    return true;
  }
});
browser.notificationbox.onClosed.addListener((id) => {
  console.log(`${id} was closed`);
});

browser.compose.onBeforeSend.addListener(async (tab, details) => {
  browser.notificationbox.create({
    label: "Sample notification",
    priority: browser.notificationbox.PRIORITY_CRITICAL_MEDIUM,
    buttons: [
      {
        label: "Okey-dokey",
        accesskey: "o",
      },
      {
        label: "Stay!"
      }
    ]
  });


  let body = null;
  if (details.isPlainText) {
    body = details.plainTextBody;
  }
  else {
    body = details.body;
  }

  let template = Handlebars.compile(body, { strict: true, explicitPartialContext: true });
  let context = { test: "this is a test" };
  try {
    body = template(context);
  }
  catch (e) {
    if (e instanceof Handlebars.Exception) {
      if (/^"[^"]+" not defined in /.test(e.message)) {
        let name = e.message.match(/^"([^"]+)"/)[1];

        browser.notification.create(`"${name}" is not defined`, "error", '', browser.notification.PRIORITY_CRITICAL_MEDIUM);
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
