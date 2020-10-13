browser.notificationbox.onButtonClicked.addListener((id, name) => {
  console.log(`${name} clicked in ${id}`);
  
  if (["btn2"].includes(name)) {
    console.log("Programatically closing!");
    browser.notificationbox.clear(id);
    return true;
  }

  if (["btn4"].includes(name)) {
    console.log("Never gonna give you up!");
    // returning true will keep the box open
    return true;
  }
});

browser.notificationbox.onDismissed.addListener((id) => {
  console.log(`${id} was dismissed`);
});

browser.notificationbox.onClosed.addListener((id, closedByUser) => {
  console.log(`${id} was closed by user: ${closedByUser}`);
});

browser.compose.onBeforeSend.addListener(async (tab, details) => {   
  await browser.notificationbox.create(tab.windowId, "testID", {
    label: "Sample notification",
    buttons: [
      {
        id: "btn2",
        label: "Delayed Close",
        accesskey: "d",
      },
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
  
  let data = await browser.notificationbox.getAll();
  console.log(data);
  
  return { cancel: true };
  
});

