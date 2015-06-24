/* global chrome, storage, utils, downloader */
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
    if (!delta.state) {
        return; // состояние не изменилось (начало загрузки)
    }
    chrome.downloads.search({
        id: delta.id
    }, function (downloads) {
        var name = downloads[0].byExtensionName;
        if (!name || name !== 'Yandex Music Fisher') {
            return; // загрузка не принадлежит нашему расширению
        }
        var entity;
        for (var i = 0; i < downloader.downloads.length; i++) {
            if (delta.id === downloader.downloads[i].browserDownloadId) {
                entity = downloader.downloads[i];
                if (delta.state.current === 'complete') {
                    entity.status = downloader.STATUS.FINISHED;
                } else if (delta.state.current === 'interrupted') {
                    entity.status = downloader.STATUS.INTERRUPTED;
                }
                break;
            }
        }
        if (!entity) {
            console.error('Загруженного файла нет в downloader.downloads');
            return;
        }
        chrome.downloads.erase({
            id: delta.id
        });
        downloader.activeThreadCount--;
        downloader.download();
    });
});

chrome.runtime.onInstalled.addListener(function () {
    storage.init();
});
