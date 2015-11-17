/* global chrome */

(() => {
    'use strict';

    let storage = {
        defaults: {
            downloadThreadCount: 4,
            shouldDownloadCover: true,
            albumCoverSize: '600x600',
            albumCoverSizeId3: '400x400',
            enumerateAlbums: true,
            enumeratePlaylists: false,
            shouldNotifyAboutUpdates: true,
            singleClickDownload: false,
            backgroundDownload: false
        },
        current: {}
    };
    window.storage = storage;

    storage.init = () => {
        let keys = Object.keys(storage.defaults);
        chrome.storage.local.get(keys, items => {
            for (let i = 0; i < keys.length; i++) {
                if (items[keys[i]] === undefined) {
                    storage.reset(keys[i]);
                }
            }
        });
    };

    storage.load = () => new Promise(resolve => {
        chrome.storage.local.get(params => {
            storage.current = params;
            storage.current.domain = 'ru';
            resolve();
        });
    });

    storage.reset = param => {
        let defaultValue = storage.defaults[param];
        let data = {};
        data[param] = defaultValue;
        chrome.storage.local.set(data, storage.load);
    };

    storage.resetAll = () => new Promise(resolve => {
        let data = {};
        for (let param in storage.defaults) {
            if (storage.defaults.hasOwnProperty(param)) {
                data[param] = storage.defaults[param];
            }
        }
        chrome.storage.local.clear(() => {
            chrome.storage.local.set(data, resolve);
        });
    });

})();
