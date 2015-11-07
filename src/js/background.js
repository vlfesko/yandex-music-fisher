/* global chrome, storage, utils, downloader, ga */
'use strict';

var distributionUrl;

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

ga('create', 'UA-65530110-1', 'auto');
ga('set', 'checkProtocolTask', null); // разрешает протокол "chrome-extension"
ga('set', 'page', '/home');
ga('send', 'event', 'load', chrome.runtime.getManifest().version);

window.onerror = function (message, file, line, col, error) {
    var relativePattern = /chrome-extension:\/\/[^\/]+/g;
    var report = chrome.runtime.getManifest().version + ': ' + error.stack.replace(relativePattern, '').replace(/\n/g, '');
    utils.getActiveTab(function (activeTab) {
        if (activeTab) {
            ga('send', 'event', 'onerror', report, activeTab.url);
        } else {
            ga('send', 'event', 'onerror', report);
        }
    });
};

chrome.runtime.onInstalled.addListener(function (details) { // установка или обновление расширения
    storage.init();
    var version = chrome.runtime.getManifest().version;
    if (details.reason === 'install') {
        ga('send', 'event', 'install', version);
    } else if (details.reason === 'update' && details.previousVersion !== version) {
        ga('send', 'event', 'update', details.previousVersion + ' > ' + version);
    }
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'loading') { // переход по новому URL
        utils.updateTabIcon(tab);
    }
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function (tab) { // переключение вкладки
        if (chrome.runtime.lastError) { // консоль
            return;
        }
        utils.updateTabIcon(tab);
    });
});

chrome.downloads.onChanged.addListener(function (delta) {
    if (!delta.state) {
        return; // состояние не изменилось (начало загрузки)
    }
    utils.getDownload(delta.id, function (download) {
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

        var entity = getEntityByBrowserDownloadId(delta.id);
        if (entity) {
            // не попадут: архив с обновлением,
            // трек и обложка при удалённой сущности в процессе сохранения BLOB (теоретически, но маловероятно)
            if (delta.state.current === 'complete') {
                entity.status = downloader.STATUS.FINISHED;
            } else if (delta.state.current === 'interrupted') {
                entity.attemptCount++;
                entity.loadedBytes = 0;
                if (entity.attemptCount < 3) {
                    setTimeout(function () {
                        entity.status = downloader.STATUS.WAITING;
                        downloader.download();
                    }, 10000);
                } else {
                    entity.status = downloader.STATUS.INTERRUPTED;
                    var details;
                    if (entity.type === downloader.TYPE.TRACK) {
                        details = entity.track.id;
                    } else if (entity.type === downloader.TYPE.COVER) {
                        details = entity.url;
                    }
                    utils.logError(download.error, details);
                }
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
        chrome.notifications.clear(notificationId);
        chrome.downloads.download({
            url: distributionUrl,
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
    utils.checkUpdate(function (version, distUrl) {
        distributionUrl = distUrl;
        chrome.notifications.create('yandex-music-fisher-update', {
            type: 'basic',
            iconUrl: '/img/icon.png',
            title: 'Yandex Music Fisher',
            message: 'Доступно обновление ' + version,
            contextMessage: 'Обновления устанавливаются вручную!',
            buttons: [{
                title: 'Скачать обновление',
                iconUrl: '/img/download.png'
            }, {
                title: 'Просмотреть изменения'
            }],
            isClickable: false
        });
    });
});
