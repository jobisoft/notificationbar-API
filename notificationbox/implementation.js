"use strict";

var { EventEmitter, EventManager, ExtensionAPI } = ExtensionCommon;
var { ExtensionError } = ExtensionUtils;
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyServiceGetters(this, {
  UUIDGen: ["@mozilla.org/uuid-generator;1", "nsIUUIDGenerator"],
});

function uuid() {
  return `notificationbox-${UUIDGen.generateUUID().number.substring(1, 37)}`;
}

class Notification {
  constructor(windowId, notificationId, options, parent) {
    this.closedByUser = true;
    this.windowId = windowId;
    this.notificationId = notificationId;
    this.options = options;
    this.parent = parent;

    let imageURL = options.image
      ? parent.extension.baseURI.resolve(options.image)
      : null;
   
    let self = this;
    let buttons = options.buttons.map(function(button) {
      return {
        id: button.id,
        label: button.label,
        accesskey: button.accesskey,
        callback: function() {
          // Fire the event and keep the notification open, decided to close it
          // based on the return values later.
          self.parent.emitter.emit("buttonclicked", self.notificationId, button.id).then((rv) => {
            let keepOpen = rv.some((value) => value?.close === false);            
            if (!keepOpen) {
              self.remove(/* closedByUser */ true);
            }
          });

          // Keep the notification box open until we hear from the event
          // handlers.
          return true;
        }
      }
    });

    let callback = function(event) {
      // Every dismissed notification will also generate a removed notification
      if (event === "dismissed") {
        self.parent.emitter.emit("dismissed", self.notificationId);
      }
      if (event === "removed") {
        self.parent.emitter.emit("closed", self.notificationId, self.closedByUser);
        self.cleanup();
      }
    };

    let element = this.getNotificationBox().appendNotification(options.label, notificationId, imageURL, options.priority, buttons, callback);
    for (let key in options.style) {
      element.style[key] = options.style[key];
    }
  }

  getNotificationBox() {
    let w = this.parent.extension.windowManager.get(this.windowId, this.parent.context).window;
    switch (this.options.placement) {
    default:
      if (w.gMessageNotificationBar) {
        return w.gMessageNotificationBar.msgNotificationBar;
      }
    case "bottom":
      if (w.specialTabs) {
        return wspecialTabs.msgNotificationBar;
      }
      if (w.gNotification) {
        return w.gNotification.notificationbox;
      }
    case "top":
      if (w.gExtensionNotificationBox) {
        return w.gExtensionNotificationBox;
      }
      let toolbox = w.document.querySelector("toolbox");
      if (toolbox) {
        w.gExtensionNotificationBox = new w.MozElements.NotificationBox(element => {
          element.id = "extension-notification-box";
          element.setAttribute("notificationside", "top");
          toolbox.parentElement.insertBefore(element, toolbox.nextElementSibling);
        });
        return w.gExtensionNotificationBox;
      }
    }
    throw new ExtensionError("Can't find a notification bar");
  }
  
  remove(closedByUser) {
      // The remove() method is called by button clicks and by notificationBox.clear()
      // but not by dismissal. In that case, the default value defined in the constructor
      //  defines the value of closedByUser which is used by the event emitter.
      this.closedByUser = closedByUser;
      let notificationBox = this.getNotificationBox();
      let notification = notificationBox.getNotificationWithValue(this.notificationId);
      notificationBox.removeNotification(notification);
  }

  cleanup() {
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
      notification.remove(/* closedByUser */ false);
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
            self.notificationsMap.get(notificationId).remove(/* closedByUser */ false);
          }

          self.notificationsMap.set(notificationId, new Notification(windowId, notificationId, options, self));
          return notificationId;
        },
        
        async clear(notificationId) {
          if (self.notificationsMap.has(notificationId)) {
            self.notificationsMap.get(notificationId).remove(/* closedByUser */ false);
            return true;
          }
          return false;
        },

        async getAll() {
          let result = {};
          self.notificationsMap.forEach((value, key) => {
            result[key] = value.options;
          });
          return result;
        },

        onDismissed: new EventManager({
          context,
          name: "notificationbox.onDismissed",
          register: fire => {
            let listener = (event, notificationId) => {
              fire.async(notificationId);
            };

            self.emitter.on("dismissed", listener);
            return () => {
              self.emitter.off("dismissed", listener);
            };
          },
        }).api(),

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
            let listener = (event, notificationId, buttonId) => {
              return fire.async(notificationId, buttonId);
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
