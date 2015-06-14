/* global chrome */
'use strict';

var storage = {
    defaults: {
        downloadThreadCount: 4,
        shouldDownloadCover: true,
        albumCoverSize: '460x460',
        shouldNumberLists: true,
        trackNameMask: '#ИСПОЛНИТЕЛИ# - #НАЗВАНИЕ#'
    },
    current: {}
};

storage.init = function () {
    var keys = Object.keys(storage.defaults);
    chrome.storage.local.get(keys, function (items) {
        for (var key in storage.defaults) {
            if (items[key] === undefined) {
                storage.reset(key);
            }
        }
    });
};

storage.load = function () {
    chrome.storage.local.get(function (params) {
        storage.current = params;
    });
    storage.current.domain = 'ru';
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
            if (storage.defaults.hasOwnProperty(param)) {
                data[param] = storage.defaults[param];
            }
        }
        chrome.storage.local.set(data, success);
    });
};
