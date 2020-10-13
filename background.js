browser.notificationbox.onButtonClicked.addListener((id, name) => {
  console.log(`${name} clicked in ${id}`);
  
  // returning true will keep the box open
  if (["btn4", "btn2"].includes(name)) {
    console.log("Never gonna give you up!");
    return true;
  }
});

browser.notificationbox.onDismissed.addListener((id) => {
  console.log(`${id} was dismissed`);
});

browser.notificationbox.onClosed.addListener((id) => {
  console.log(`${id} was closed`);
});

browser.compose.onBeforeSend.addListener(async (tab, details) => { 
  await browser.notificationbox.create(tab.windowId, {
    label: "Sample notification",
    priority: 2,
    buttons: [
      {
        id: "btn3",
        label: "Okey-dokey",
        accesskey: "o",
      },
      {
        id: "btn4",
        label: "Stay!"
      }
    ]
  });

  return { cancel: true };
  
});
