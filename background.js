var loggingOn = false;
var THlog = function(str) {
    if (loggingOn) {
        console.log(str);
    }
}

function onInstall() {
    THlog("Extension Installed");
}

function onUpdate() {
    THlog("Extension Updated");
}

function getVersion() {
    var details = chrome.app.getDetails();
    return details.version;
}

// Check if the version has changed.
var curVersion = getVersion();
var prevVersion = localStorage['version']
THlog("prev version: " + prevVersion);
THlog("cur version: " + curVersion);
if (curVersion !== prevVersion) {
    // Check if we just installed this extension.
    if (prevVersion === undefined) {
        onInstall();
    } else {
        onUpdate();
    }
    localStorage['version'] = curVersion;
}

var locked = false;
var windows = {};

var backwards = function () {
    if (locked) {
        return;
    }
    locked = true;
    chrome.windows.getLastFocused({}, function (window) {
        backwardsInWindow(window.id);
    });
};

var backwardsInWindow = function (windowId) {
    THlog("backwardsInWindow: " + windowId);
    var windowStack = windows[windowId];
    if (windowStack === undefined) {
        locked = false;
        return;
    }
    var curTabId = windowStack[windowStack.index];
    var index = windowStack.index-1;
    if (index < 0) {
        locked = false;
        return;
    }
    while (index >= 0 && windowStack[index] === curTabId) {
        windowStack.splice(index, 1);
        index--;
    }
    if (index < 0) {
        index = 0;
    }
    windowStack.index = index;
    var tabId = windowStack[index];
    if (tabId === curTabId) {
        locked = false; // nothing to do, we must have eliminated
                        // duplicates and still been left with the
                        // same tab
        return;
    }
    // need to test if tabId really exists still and whether it's in
    // the right window still.
    chrome.tabs.get(tabId, function (tab) {
        if (chrome.runtime.lastError || tab === undefined || tab.windowId !== windowId) {
            // it doesn't exist, or it's gone somewhere else.
            windowStack.splice(index, 1);
            backwardsInWindow(windowId);
            return;
        }
        chrome.tabs.update(tabId, {active: true, highlighted: true});
        locked = false;
    });
}

var forwards = function () {
    if (locked) {
        return;
    }
    locked = true;
    chrome.windows.getLastFocused({}, function (window) {
        forwardsInWindow(window.id);
    });
};

var forwardsInWindow = function (windowId) {
    THlog("forwardsInWindow: " + windowId);
    var windowStack = windows[windowId];
    if (windowStack === undefined) {
        locked = false;
        return;
    }
    var curTabId = windowStack[windowStack.index];
    var index = windowStack.index+1;
    if (index >= windowStack.length) {
        locked = false;
        return;
    }
    while (index < windowStack.length && windowStack[index] === curTabId) {
        windowStack.splice(index, 1);
    }
    if (index >= windowStack.length) {
        index = windowStack.length-1;
    }
    windowStack.index = index;
    var tabId = windowStack[index];
    if (tabId === curTabId) {
        locked = false; // nothing to do, we must have eliminated
                        // duplicates and still been left with the
                        // same tab
        return;
    }
    // need to test if tabId really exists still and whether it's in
    // the right window still.
    chrome.tabs.get(tabId, function (tab) {
        if (chrome.runtime.lastError || tab === undefined || tab.windowId !== windowId) {
            // it doesn't exist, or it's gone somewhere else.
            windowStack.splice(index, 1);
            forwardsInWindow(windowId);
            return;
        }
        chrome.tabs.update(tabId, {active: true, highlighted: true});
        locked = false;
    });
}

var processCommand = function (command) {
    if (command === "backwards") {
        backwards();
    } else if (command === "forwards") {
        forwards();
    }
};

chrome.commands.onCommand.addListener(processCommand);

var activated = function (activeInfo) {
    var tabId = activeInfo.tabId;
    var windowId = activeInfo.windowId;
    THlog("activated: " + tabId + ", " + windowId);
    var windowStack = windows[windowId];
    if (windowStack === undefined) {
        windowStack = [];
        windowStack.index = -1;
        windows[windowId] = windowStack;
    }

    // if the activation is either for what we think is the current
    // tab or the next tab, then there's no change to make:
    var index = windowStack.index;
    if (index >= 0 && windowStack[index] === tabId) {
        return; // current tab anyway
    }
    index++;
    if (index < windowStack.length && windowStack[index] === tabId) {
        windowStack.index = index;
        return; // just moved to the next tab
    }

    windowStack.splice(index, windowStack.length, tabId);
    windowStack.index = index;
    THlog("windowId: " + windowId + ", index: " + index + ", stack: " + windowStack);
};

chrome.tabs.onActivated.addListener(activated);

var initialized = false;
var init = function() {
    if (initialized) {
        return;
    }
    initialized = true;
    chrome.tabs.query({active: true, highlighted: true}, function (tabs) {
        if (tabs === undefined) {
            return;
        }
        for (var idx = 0; idx < tabs.length; idx++) {
            var tab = tabs[idx];
            var stack = [tab.id];
            stack.index = 0;
            windows[tab.windowId] = stack;
            THlog("init: windowId: " + tab.windowId + ", stack: " + stack);
        }
    });
}

chrome.runtime.onStartup.addListener(function () {
    THlog("on startup");
    init();
});

chrome.runtime.onInstalled.addListener(function () {
    THlog("on startup");
    init();
});
