"use strict";

const { EventEmitter, EventManager, ExtensionAPI } = ExtensionCommon;

XPCOMUtils.defineLazyServiceGetters(this, {
  UUIDGen: ["@mozilla.org/uuid-generator;1", "nsIUUIDGenerator"],
});

function uuid() {
  return UUIDGen.generateUUID().toString();
}

function notificationBox() {
  let w = Services.wm.getMostRecentWindow(null);
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

    // Set before calling into notificationbox, because the notification may be
    // closed during the call.
    notificationsMap.set(id, this);
    var self = this;
    let buttons = options.buttons.map(function(button) {
      return {
        label: button.label,
        accesskey: button.accesskey,
        callback: function(/*notificationBox, buttonDescription, eventTarget*/) {
          // Fire the event and sort out if we need to close the notification
          // later.
          self.notificationsMap.emitter.emit("buttonclicked", self.id, button.label).then((values) => {
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
      if (event === "removed") {
        self.notificationsMap.emitter.emit("closed", self.id)
      }
      else {
        console.log(`Notification event (${self.id}: ${event}`);
      }
    };

    try {
      notificationBox().appendNotification(options.label, this.id, imageURL, this.options.priority, buttons, callback);
    } catch (e) {
      // This will fail if notificationbox is not available.
    }
  }

  clear() {
    try {
      notificationBox().removeNotification(
        notificationBox().getNotificationWithValue(this.id)
      );
    } catch (e) {
      // FIXME handle the error
    }
    this.notificationsMap.delete(this.id);
  }
}

var notificationbox = class extends ExtensionAPI {
  constructor(extension) {
    super(extension);

    this.idCounter = 0;
    this.notificationsMap = new Map();
    this.emitter = new EventEmitter();
    this.notificationsMap.emitter = this.emitter;
  }

  onShutdown() {
    for (let notification of this.notificationsMap.values()) {
      notification.clear();
    }
  }

  getAPI(context) {
    let notificationsMap = this.notificationsMap;
    let emitter = this.emitter;

    return {
      notificationbox: {
        create(notificationId, options) {
          if (!notificationId) {
            let newId = `notification-${uuid()}`;
            while (notificationsMap.has(newId)) {
              newId = `notification-${uuid()}`;
            }
            notificationId = newId;
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
            return true;
          }
          return false;
        },

        getAll: function() {
          let result = {};
          notificationsMap.forEach((value, key) => {
            result[key] = value.options;
          });
          return result;
        },

        onClosed: new EventManager({
          context,
          name: "notificationbox.onClosed",
          register: fire => {
            let listener = (event, notificationId) => {
              // TODO Bug 1413188, Support the byUser argument.
              fire.async(notificationId, true);
            };

            emitter.on("closed", listener);
            return () => {
              emitter.off("closed", listener);
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

            emitter.on("buttonclicked", listener);
            return () => {
              emitter.off("buttonclicked", listener);
            };
          },
        }).api(),
      }
    }
  }
}
