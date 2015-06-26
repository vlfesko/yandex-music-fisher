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

function getEntityByBrowserDownloadId(browserDownloadId) {
    for (var i = 0; i < downloader.downloads.length; i++) {
        var entity = downloader.downloads[i];
        if (!entity) {
            continue; // эту загрузку удалили
        }
        if (entity.type === downloader.TYPE.ALBUM || entity.type === downloader.TYPE.PLAYLIST) {
            for (var j = 0; j < entity.tracks.length; j++) {
                if (entity.tracks[j].browserDownloadId === browserDownloadId) {
                    return entity.tracks[j];
                }
            }
        } else if (entity.type === downloader.TYPE.TRACK || entity.type === downloader.TYPE.COVER) {
            if (entity.browserDownloadId === browserDownloadId) {
                return entity;
            }
        }
    }
    return undefined;
}

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
        var entity = getEntityByBrowserDownloadId(delta.id);
        if (entity) {
            if (delta.state.current === 'complete') {
                entity.status = downloader.STATUS.FINISHED;
            } else if (delta.state.current === 'interrupted') {
                entity.status = downloader.STATUS.INTERRUPTED;
            }
            if (entity.type === downloader.TYPE.COVER) {
                delete(downloader.downloads[entity.index]);
            }
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
