"use strict";

const ToolkitModules = {};

ChromeUtils.defineModuleGetter(
  ToolkitModules,
  "EventEmitter",
  "resource://gre/modules/EventEmitter.jsm"
);

var { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
//const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

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
    throw new Error("Can't find a notification bar");
  }
}

class Notification {
  constructor(context, notificationsMap, id, options) {
    this.notificationsMap = notificationsMap;
    this.id = id;
    this.options = options;

    let imageURL;
    if (options.iconUrl) {
      imageURL = context.extension.baseURI.resolve(options.image);
    }

    // Set before calling into nsIAlertsService, because the notification may be
    // closed during the call.
    notificationsMap.set(id, this);

    let eventCallback = function() { console.log("notification box event callback fired"); };
    let notificationId = this.id;
    let buttons = options.buttons.map((button) => {
      return {
        label: button.label,
        accesskey: button.accesskey,
        callback: () => {
          let results = notificationsMap.emit("buttonclicked", id, button.label);
          for (let result of results) {
            if (result !== true) {
              return false;
            }
          }
          return true;
        }
      }
    });

    try {
      // FIXME: display the notification
      notificationBox().appendNotification(options.label, this.id, imageURL, this.options.priority, buttons, eventCallback);
    } catch (e) {
      // This will fail if notificationbox is not available.

      this.observe(null, "notificationfinished", id);
    }
  }

  clear() {
    try {
      // FIXME: close this notification
    } catch (e) {
      // FIXME handle the error
    }
    this.notificationsMap.delete(this.id);
  }

  observe(subject, topic, data) {
    switch (topic) {
      case "notificationclickcallback":
        this.notificationsMap.emit("clicked", data);
        break;
      case "notificationfinished":
        this.notificationsMap.emit("closed", data);
        this.notificationsMap.delete(this.id);
        break;
      case "notificationshow":
        this.notificationsMap.emit("shown", data);
        break;
    }
  }
}

var notificationbox = class extends ExtensionCommon.ExtensionAPI {
  constructor(extension) {
    super(extension);

    this.nextId = 0;
    this.notificationsMap = new Map();
    ToolkitModules.EventEmitter.decorate(this.notificationsMap);
  }

  onShutdown() {
    for (let notification of this.notificationsMap.values()) {
      notification.clear();
    }
  }

  getAPI(context) {
    let notificationsMap = this.notificationsMap;

    return {
      notificationbox: {
        create(notificationId, options) {
          if (!notificationId) {
            notificationId = String(this.nextId++);
          }

          if (notificationsMap.has(notificationId)) {
            notificationsMap.get(notificationId).clear();
          }

          new Notification(context, notificationsMap, notificationId, options);

          return Promise.resolve(notificationId);
        },

        clear: function(notificationId) {
          if (notificationsMap.has(notificationId)) {
            notificationsMap.get(notificationId).clear();
            return Promise.resolve(true);
          }
          return Promise.resolve(false);
        },

        getAll: function() {
          let result = {};
          notificationsMap.forEach((value, key) => {
            result[key] = value.options;
          });
          return Promise.resolve(result);
        },

        onClosed: new ExtensionCommon.EventManager({
          context,
          name: "notificationbox.onClosed",
          register: fire => {
            let listener = (event, notificationId) => {
              // TODO Bug 1413188, Support the byUser argument.
              fire.async(notificationId, true);
            };

            notificationsMap.on("closed", listener);
            return () => {
              notificationsMap.off("closed", listener);
            };
          },
        }).api(),

        onButtonClicked: new ExtensionCommon.EventManager({
          context,
          name: "notificationbox.onButtonClicked",
          register: fire => {
            let listener = (event, notificationId, label) => {
              return fire.sync(notificationId, label);
            };

            notificationsMap.on("buttonclicked", listener);
            return () => {
              notificationsMap.off("buttonclicked", listener);
            };
          },
        }).api(),
      }
    }
  }
}
