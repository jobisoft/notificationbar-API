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
