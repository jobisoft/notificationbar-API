browser.notificationbox.onButtonClicked.addListener((id, name) => {
  console.log(`${name} clicked in ${id}`);
  if (["btn4", "btn2"].includes(name)) {
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
    priority: 2,
    buttons: [
      {
        name: "btn3",
        label: "Okey-dokey",
        accesskey: "o",
      },
      {
        name: "btn4",
        label: "Stay!"
      }
    ]
  });

  await browser.notificationbox.create(tab.windowId, {
    label: "Sample notification",
    priority: 8,
    buttons: [
      {
        name: "btn1",
        label: "Okey-dokey",
        accesskey: "o",
      },
      {
        name: "btn2",
        label: "Stay!"
      }
    ]
  });  
  return { cancel: true };
  
});
