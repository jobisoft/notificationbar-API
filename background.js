browser.notificationbox.onButtonClicked.addListener((id, label) => {
  console.log(`${label} clicked in ${id}`);
  if (label == "Stay!") {
    console.log("Never gonna give you up!");
    return true;
  }
});

browser.notificationbox.onClosed.addListener((id) => {
  console.log(`${id} was closed`);
  return false;
});


browser.compose.onBeforeSend.addListener(async (tab, details) => { 
  await browser.notificationbox.create(tab.windowId, {
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

  return { cancel: true };
  
});
