// Defining a onButtonClicked listener
messenger.notificationbox.onButtonClicked.addListener((windowId, notificationId, buttonId) => {
  console.log(`Listener #1 sees: ${buttonId} clicked in box ${notificationId} in window ${windowId}.`);
    if (["btn-keep"].includes(buttonId)) {
    console.log("Box will not close, as long as one listener returns {close:false}.");
    return {close: false};
  }
});

// Defining another onButtonClicked listener
messenger.notificationbox.onButtonClicked.addListener((windowId, notificationId, buttonId) => {
  console.log(`Listener #2 sees: ${buttonId} clicked in box ${notificationId} in window ${windowId}.`);
  if (["btn-direct"].includes(buttonId)) {
    console.log("Box will close as long no listener returns {close:false}.");
  }
});

// Defining a onDismissed listener
messenger.notificationbox.onDismissed.addListener((windowId, notificationId) => {
  console.log(`${notificationId} in window ${windowId} was dismissed`);
});

// Defining a onClosed listener
messenger.notificationbox.onClosed.addListener((windowId, notificationId, closedByUser) => {
  console.log(`${notificationId} in window ${windowId} was closed by user: ${closedByUser}`);
});



async function addBoxes(window) {
  // adding a top box
  await messenger.notificationbox.create({
    windowId: window.id,
    label: "Sample notification top 1",
    placement: "top",
    priority: messenger.notificationbox.PRIORITY_WARNING_HIGH,
    buttons: [
      {
        id: "btn-direct",
        label: "Close",
        accesskey: "o",
      },
      {
        id: "btn-keep",
        label: "Stay!"
      }
    ]
  });
  
  // some default boxes to test stacking
  await messenger.notificationbox.create({
    windowId: window.id,
    label: "Sample notification default 1",
  });

  await messenger.notificationbox.create({
    windowId: window.id,
    priority: messenger.notificationbox.PRIORITY_CRITICAL_HIGH,
    label: "Sample notification default 2",
    buttons: [
      {
        id: "btn",
        label: "Close",
        accesskey: "d",
      }
    ]
  });

  // a bottom box
  await messenger.notificationbox.create({
    windowId: window.id,
    label: "Sample notification bottom 1",
    image: "icon.png",
    placement: "bottom",    
  });
}



// add boxes to all future windows
messenger.windows.onCreated.addListener(addBoxes);

// add boxes to all existing windows
messenger.windows.getAll()
  .then(windows => {
    for (let window of windows) {
      addBoxes(window);
    }
  });
  
  messenger.windows.create({
                height: 200,
                width: 510,
                type: "popup"
            })
