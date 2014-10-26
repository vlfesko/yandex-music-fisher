var storage = {
    defaults: {
        downloadThreadCount: 4,
        shouldDownloadCover: 'yes',
        albumCoverSize: '460x460',
        trackNameMask: '#ИСПОЛНИТЕЛИ# - #НАЗВАНИЕ#'
    },
    current: {}
};

storage.init = function () {
    var keys = Object.keys(storage.defaults);
    chrome.storage.local.get(keys, function (items) {
        for (var key in storage.defaults) {
            if (!items[key]) {
                storage.reset(key);
            }
        }
    });
};

storage.load = function () {
    chrome.storage.local.get(function (params) {
        storage.current = params;
    });
};

storage.reset = function (param) {
    var defaultValue = storage.defaults[param];
    var data = {};
    data[param] = defaultValue;
    chrome.storage.local.set(data, storage.load);
};

storage.resetAll = function (success) {
    chrome.storage.local.clear(function () {
        var data = {};
        for (var param in storage.defaults) {
            data[param] = storage.defaults[param];
        }
        chrome.storage.local.set(data, success);
    });
};
