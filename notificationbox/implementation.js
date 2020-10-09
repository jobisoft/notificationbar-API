"use strict";

const { EventEmitter, EventManager, ExtensionAPI } = ExtensionCommon;
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyServiceGetters(this, {
  UUIDGen: ["@mozilla.org/uuid-generator;1", "nsIUUIDGenerator"],
});

function uuid() {
  return `notificationbox-${UUIDGen.generateUUID().number.substring(1, 37)}`;
}

class Notification {
  constructor(windowId, notificationId, options, parent) {
    this.windowId = windowId;
    this.notificationId = notificationId;
    this.options = options;
    this.parent = parent;
    this.imageURL = options.iconUrl
      ? parent.extension.baseURI.resolve(options.image)
      : null;
   
    let self = this;
    let buttons = options.buttons.map(function(button) {
      return {
        label: button.label,
        accesskey: button.accesskey,
        callback: function() {
          // Fire the event and keep the notification open, decided to close it
          // based on the return values later.
          self.parent.emitter.emit("buttonclicked", self.notificationId, button.label).then((values) => {
            let allTrue = values.every((value) => value === true);
            if (!allTrue) {
              self.clear();
            }
          });

          // Keep the notification box open until we hear from the event
          // handlers.
          return true;
        }
      }
    });

    let callback = function(event) {
      console.log(`Notification event (${self.notificationId}: ${event}`);
      if (event === "removed") {
        self.parent.emitter.emit("closed", self.notificationId, /* closed by user */ true);
      }
    };

    this.getNotificationBox().appendNotification(this.options.label, this.notificationId, this.imageURL, this.options.priority, buttons, callback);
  }

  getNotificationBox() {
    let w = this.parent.extension.windowManager.get(this.windowId, this.parent.context).window;
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
  
  clear() {
      let notificationBox = this.getNotificationBox();
      let notification = notificationBox.getNotificationWithValue(this.notificationId);
      notificationBox.removeNotification(notification);
      this.parent.notificationsMap.delete(this.notificationId);    
  }
}

var notificationbox = class extends ExtensionAPI {
  constructor(extension) {
    super(extension);
    this.notificationsMap = new Map();
    this.emitter = new EventEmitter();
  }

  onShutdown() {
    for (let notification of this.notificationsMap.values()) {
      notification.clear();
    }
  }

  getAPI(context) {
    this.context = context;
    let self = this

    return {
      notificationbox: {
        async create(windowId, notificationId, options) {
          if (!notificationId) {
            do {
              notificationId =uuid();
            } while (self.notificationsMap.has(notificationId))
          }

          if (self.notificationsMap.has(notificationId)) {
            self.notificationsMap.get(notificationId).clear();
          }

          self.notificationsMap.set(notificationId, new Notification(windowId, notificationId, options, self));
          return notificationId;
        },

        clear: function(notificationId) {
          if (self.notificationsMap.has(notificationId)) {
            self.notificationsMap.get(notificationId).clear();
            return true;
          }
          return false;
        },

        getAll: function() {
          let result = {};
          self.notificationsMap.forEach((value, key) => {
            result[key] = value.options;
          });
          return result;
        },

        onClosed: new EventManager({
          context,
          name: "notificationbox.onClosed",
          register: fire => {
            let listener = (event, notificationId, closedByUser) => {
              fire.async(notificationId, closedByUser);
            };

            self.emitter.on("closed", listener);
            return () => {
              self.emitter.off("closed", listener);
            };
          },
        }).api(),

        onButtonClicked: new EventManager({
          context,
          name: "notificationbox.onButtonClicked",
          register: fire => {
            let listener = (event, notificationId, label) => {
              return fire.async(notificationId, label);
            };

            self.emitter.on("buttonclicked", listener);
            return () => {
              self.emitter.off("buttonclicked", listener);
            };
          },
        }).api(),
      }
    }
  }
}
