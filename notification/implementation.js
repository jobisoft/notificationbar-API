var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

function notificationBox() {
  let w = Services.wm.getMostRecentWindow(null);
  let notifyBox;
  if (w.gMessageNotificationBar) {
    return w.gMessageNotificationBar.msgNotificationBar;
  }
  else if (w.specialTabs) {
    return wspecialTabs.msgNotificationBar;
  }
  else if (w.gNotification) {
    return w.gNotification.notificationbox;
  }
  else {
    w.console.log("Can't finde a notification bar");
    return null;
  }
}

var notification = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      notification: {
        create(label,
          value,
          image,
          priority,
          buttons = [],
          eventCallback = null) {
          notificationBox().appendNotification(label, value, image, priority, buttons, eventCallback);
        }
      }
    }
  }
}
