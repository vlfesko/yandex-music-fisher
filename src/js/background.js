/* global chrome, storage, utils, yandex, downloader, logger */
'use strict';

storage.load();

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'loading') { // переход по новому URL
        utils.updateTabIcon(tab);
    }
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function (tab) { // переключение вкладки
        utils.updateTabIcon(tab);
    });
});

chrome.downloads.onChanged.addListener(function (delta) {
    chrome.downloads.search({
        id: delta.id
    }, function (downloads) {
        if (!downloads.length) {
            // загрузка пропала из памяти, например из-за chrome.downloads.erase
            return;
        }
        var name = downloads[0].byExtensionName;
        if (name && name === 'Yandex Music Fisher') {
            downloader.onChange(delta);
        }
    });
});

chrome.runtime.onInstalled.addListener(function (details) {
    storage.init();
});
