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
  constructor(options, parent) {
    this.closedByUser = true;
    this.options = options;
    this.parent = parent;

    let imageURL = (options.image && !options.image.includes(":"))
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
          self.parent.emitter.emit("buttonclicked", self.options.windowId, self.options.notificationId, button.id).then((rv) => {
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
        self.parent.emitter.emit("dismissed", self.options.windowId, self.options.notificationId);
      }
      if (event === "removed") {
        self.parent.emitter.emit("closed", self.options.windowId, self.options.notificationId, self.closedByUser);
        self.cleanup();
      }
    };

    let element = this.getNotificationBox().appendNotification(options.label, options.notificationId, imageURL, options.priority, buttons, callback);
    for (let key in options.style) {
      element.style[key] = options.style[key];
    }
  }

  getNotificationBox() {
    let w = this.parent.extension.windowManager.get(this.options.windowId, this.parent.context).window;
    switch (this.options.placement) {
      case "message":
        {
          // below the receipient list in the message preview window
          if (w.gMessageNotificationBar) {
            return w.gMessageNotificationBar.msgNotificationBar;
          }
        }
        
      case "bottom":
        {
          // default bottom notification in the mail3:pane
          if (w.specialTabs) {
            return w.specialTabs.msgNotificationBar;
          }
          // default bottom notification in message composer window and
          // most calendar dialogs (currently windows.onCreated event does not see these)
          if (w.gNotification) {
            return w.gNotification.notificationbox;
          }
          // if there is no default bottom box, use our own
          if (!w.gExtensionNotificationBottomBox) {
            w.gExtensionNotificationBottomBox = new w.MozElements.NotificationBox(element => {
              element.id = "extension-notification-bottom-box";
              element.setAttribute("notificationside", "bottom");
              w.document.documentElement.append(element);
            });
          }            
          return w.gExtensionNotificationBottomBox;
        }
        break;
        
      case "top":
        {
          if (!w.gExtensionNotificationTopBox) {
            // try to add it before the toolbox, if that fails add it firstmost
            let toolbox = w.document.querySelector("toolbox");
            if (toolbox) {
              w.gExtensionNotificationTopBox = new w.MozElements.NotificationBox(element => {
                element.id = "extension-notification-top-box";
                element.setAttribute("notificationside", "top");
                toolbox.parentElement.insertBefore(element, toolbox.nextElementSibling);
              });
            } else {              
              w.gExtensionNotificationTopBox = new w.MozElements.NotificationBox(element => {
                element.id = "extension-notification-top-box";
                element.setAttribute("notificationside", "top");
                w.document.documentElement.insertBefore(element, w.document.documentElement.firstChild);                
              });              
            }
          }
          return w.gExtensionNotificationTopBox;
        }
        break;
    }
  }
  
  remove(closedByUser) {
      // The remove() method is called by button clicks and by notificationBox.clear()
      // but not by dismissal. In that case, the default value defined in the constructor
      //  defines the value of closedByUser which is used by the event emitter.
      this.closedByUser = closedByUser;
      let notificationBox = this.getNotificationBox();
      let notification = notificationBox.getNotificationWithValue(this.options.notificationId);
      notificationBox.removeNotification(notification);
  }

  cleanup() {
      this.parent.notificationsMap.delete(this.options.notificationId);    
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

  observe(aSubject, aTopic, aData) {
    let win = this.context.extension.windowManager.convert(aSubject);
    this.notificationsMap.forEach((value, key) => {
      if (value.options.windowId == win.id) {
        this.notificationsMap.delete(key);
      }
    });
  }
  
  close() {
    Services.obs.removeObserver(this, "domwindowclosed");
  }
  
  getAPI(context) {

    this.context = context;
    let self = this;

    context.callOnClose(this);
    Services.obs.addObserver(this, "domwindowclosed", false);

    return {
      notificationbox: {
        async create(options) {
          if (!options.notificationId) {
            do {
              options.notificationId =uuid();
            } while (self.notificationsMap.has(options.notificationId))
          }

          if (self.notificationsMap.has(options.notificationId)) {
            self.notificationsMap.get(options.notificationId).remove(/* closedByUser */ false);
          }

          self.notificationsMap.set(options.notificationId, new Notification(options, self));
          return options.notificationId;
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
            let listener = (event, windowId, notificationId) => {
              fire.async(windowId, notificationId);
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
            let listener = (event, windowId, notificationId, closedByUser) => {
              fire.async(windowId, notificationId, closedByUser);
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
            let listener = (event, windowId, notificationId, buttonId) => {
              return fire.async(windowId, notificationId, buttonId);
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
