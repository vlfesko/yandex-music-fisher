var storage = {};
// todo: перейти с localStorage на chrome.storage

storage.defaults = {
    downloadThreadCount: 4,
    shouldDownloadCover: 'yes',
    albumCoverSize: '460x460',
    trackNameMask: '#ИСПОЛНИТЕЛИ# - #НАЗВАНИЕ#'
};

storage.init = function () {
    for (var param in storage.defaults) {
        if (!storage.get(param)) {
            storage.reset(param);
        }
    }
};

storage.get = function (param) {
    return localStorage.getItem(param);
};

storage.set = function (param, value) {
    localStorage.setItem(param, value);
};

storage.reset = function (param) {
    var defaultValue = storage.defaults[param];
    localStorage.setItem(param, defaultValue);
};

storage.resetAll = function () {
    localStorage.clear();
    for (var param in storage.defaults) {
        localStorage.setItem(param, storage.defaults[param]);
    }
};