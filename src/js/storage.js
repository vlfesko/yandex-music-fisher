/* global chrome */
'use strict';

var storage = {
    defaults: {
        downloadThreadCount: 4,
        shouldDownloadCover: true,
        albumCoverSize: '400x400',
        shouldNumberLists: true,
        trackNameMask: '#ИСПОЛНИТЕЛИ# - #НАЗВАНИЕ#',
        shouldNotifyAboutUpdates: true
    },
    current: {}
};

storage.init = function () {
    var keys = Object.keys(storage.defaults);
    chrome.storage.local.get(keys, function (items) {
        for (var i = 0; i < keys.length; i++) {
            if (items[keys[i]] === undefined) {
                storage.reset(keys[i]);
            }
        }
    });
};

storage.load = function (callback) {
    chrome.storage.local.get(function (params) {
        storage.current = params;
        storage.current.domain = 'ru';
        if (callback) {
            callback();
        }
    });
};

storage.reset = function (param) {
    var defaultValue = storage.defaults[param];
    var data = {};
    data[param] = defaultValue;
    chrome.storage.local.set(data, storage.load);
};

storage.resetAll = function (callback) {
    var data = {};
    for (var param in storage.defaults) {
        if (storage.defaults.hasOwnProperty(param)) {
            data[param] = storage.defaults[param];
        }
    }
    chrome.storage.local.clear(function () {
        chrome.storage.local.set(data, callback);
    });
};
