/* global chrome, storage, utils, downloader, ga */
'use strict';

var archiveUrl;

(function (i, s, o, g, r, a, m) {
    i.GoogleAnalyticsObject = r;
    i[r] = i[r] || function () {
            (i[r].q = i[r].q || []).push(arguments);
        };
    i[r].l = 1 * new Date();
    a = s.createElement(o);
    m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m);
})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');

ga('create', 'UA-65265089-1', 'auto');
ga('set', 'checkProtocolTask', null); // разрешает протокол "chrome-extension"
ga('send', 'event', 'background', 'extension loaded', chrome.runtime.getManifest().version);

chrome.runtime.onInstalled.addListener(function (details) { // установка или обновление расширения
    storage.init();
    var version = chrome.runtime.getManifest().version;
    if (details.reason === 'install') {
        ga('send', 'event', 'background', 'extension installed', version);
    } else if (details.reason === 'update' && details.previousVersion !== version) {
        ga('send', 'event', 'background', 'extension updated', details.previousVersion + ' -> ' + version);
    }
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
                if (entity.type === downloader.TYPE.ALBUM &&
                    entity.cover && entity.cover.browserDownloadId === browserDownloadId) {

                    return entity.cover;
                }
                switch (entity.type) {
                    case downloader.TYPE.ALBUM:
                    case downloader.TYPE.PLAYLIST:
                        for (var j = 0; j < entity.tracks.length; j++) {
                            if (entity.tracks[j].browserDownloadId === browserDownloadId) {
                                return entity.tracks[j];
                            }
                        }
                        break;
                    case downloader.TYPE.TRACK:
                        if (entity.browserDownloadId === browserDownloadId) {
                            return entity;
                        }
                        break;
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
        if (entity) {
            // не попадут: архив с обновлением,
            // трек и обложка при удалённой сущности в процессе сохранения BLOB (теоретически, но маловероятно)
            if (delta.state.current === 'complete') {
                entity.status = downloader.STATUS.FINISHED;
            } else if (delta.state.current === 'interrupted') {
                entity.status = downloader.STATUS.INTERRUPTED;
                entity.loadedBytes = 0;
            }
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
    if (notificationId !== 'yandex-music-fisher-update') {
        return;
    }
    if (buttonIndex === 0) {
        chrome.downloads.showDefaultFolder();
        chrome.notifications.clear(notificationId, function (wasCleared) {
            // The callback is required before Chrome 42.
        });
        chrome.downloads.download({
            url: archiveUrl,
            saveAs: false
        });
    } else if (buttonIndex === 1) {
        chrome.tabs.create({
            url: 'https://github.com/egoroof/yandex-music-fisher/releases'
        });
    }
});

storage.load(function () {
    if (!storage.current.shouldNotifyAboutUpdates) {
        return;
    }
    var releaseInfoUrl = 'https://api.github.com/repos/egoroof/yandex-music-fisher/releases/latest';
    utils.ajax(releaseInfoUrl, 'json', function (releaseInfo) {
        archiveUrl = releaseInfo.assets[0].browser_download_url;
        var latestVersion = releaseInfo.tag_name.replace('v', '').split('.');
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
                }, {
                    title: 'Просмотреть изменения'
                }],
                isClickable: false
            }, function (notificationId) {
                // The callback is required before Chrome 42.
            });
        }
    }, utils.logError);
});
