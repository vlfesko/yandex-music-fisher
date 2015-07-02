/* global chrome, storage, utils, downloader */
'use strict';

var latestVersion;

chrome.runtime.onInstalled.addListener(function () { // установка или обновление расширения
    storage.init();
});

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

        var download = downloads[0];
        var name = download.byExtensionName;
        if (!name || name !== 'Yandex Music Fisher') {
            return; // загрузка не принадлежит нашему расширению
        }
        var entity = getEntityByBrowserDownloadId(delta.id);
        if (!entity) { // архив с обновлением
            return;
        }
        if (delta.state.current === 'complete') {
            entity.status = downloader.STATUS.FINISHED;
        } else if (delta.state.current === 'interrupted') {
            entity.status = downloader.STATUS.INTERRUPTED;
            entity.loadedBytes = 0;
        }
        if (entity.type === downloader.TYPE.COVER) {
            delete(downloader.downloads[entity.index]);
        } else if (entity.type === downloader.TYPE.TRACK) {
            window.URL.revokeObjectURL(download.url);
        }
        chrome.downloads.erase({
            id: delta.id
        });
        downloader.activeThreadCount--;
        downloader.download();
    });
});

chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
    if (notificationId !== 'yandex-music-fisher-update' || buttonIndex !== 0) {
        return;
    }
    chrome.notifications.clear(notificationId, function (wasCleared) {
        // The callback is required before Chrome 42.
    });
    var version = latestVersion.join('.');
    var archiveUrl = 'https://github.com/egoroof/yandex-music-fisher/releases/download/v' + version;
    archiveUrl += '/yandex-music-fisher_' + version + '.zip';
    chrome.downloads.download({
        url: archiveUrl,
        saveAs: false
    });
});

storage.load(function () {
    var githubManifestUrl = 'https://raw.githubusercontent.com/egoroof/yandex-music-fisher';
    githubManifestUrl += '/master/src/manifest.json?r=' + Math.random();
    if (storage.current.shouldNotifyAboutUpdates) {
        utils.ajax(githubManifestUrl, 'json', function (githubManifest) {
            latestVersion = githubManifest.version.split('.');
            var manifest = chrome.runtime.getManifest();
            var currentVersion = manifest.version.split('.');

            var isMajorUpdate = (
                latestVersion[0] > currentVersion[0]
            );
            var isMinorUpdate = (
                latestVersion[1] > currentVersion[1] &&
                latestVersion[0] >= currentVersion[0]
            );
            var isPatchUpdate = (
                latestVersion[2] > currentVersion[2] &&
                latestVersion[1] >= currentVersion[1] &&
                latestVersion[0] >= currentVersion[0]
            );

            if (isMajorUpdate || isMinorUpdate || isPatchUpdate) {
                chrome.notifications.create('yandex-music-fisher-update', {
                    type: 'basic',
                    iconUrl: '/img/icon.png',
                    title: 'Yandex Music Fisher',
                    message: 'Доступно обновление ' + latestVersion.join('.'),
                    contextMessage: 'Обновления устанавливаются вручную!',
                    buttons: [{
                        title: 'Скачать обновление',
                        iconUrl: '/img/download.png'
                    }],
                    isClickable: false
                }, function (notificationId) {
                    // The callback is required before Chrome 42.
                });
            }
        }, function (error) {
            console.error(error);
        });
    }
});
