/* global chrome, storage, utils, downloader, logger */
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
            return; // загрузка пропала из памяти, например из-за chrome.downloads.erase
        }
        var name = downloads[0].byExtensionName;
        if (!name || name !== 'Yandex Music Fisher') {
            return; // загрузка не принадлежит нашему расширению
        }
        var entity;
        for (var i = 0; i < downloader.downloads.length; i++) {
            if (delta.id === downloader.downloads[i].browserDownloadId) {
                entity = downloader.downloads[i];
                entity.status = downloader.STATUS.FINISHED;
                break;
            }
        }
        if (!entity) {
            logger.addMessage('Загруженного файла нет в downloader.downloads');
            return;
        }
        if (!delta.state) {
            return; // todo: выяснить, когда так происходит (передвинуть до вызова chrome.downloads.search?)
        }
        downloader.activeThreadCount--;
        chrome.downloads.erase({
            id: delta.id
        });
        downloader.download();
    });
});

chrome.runtime.onInstalled.addListener(function () {
    storage.init();
});
