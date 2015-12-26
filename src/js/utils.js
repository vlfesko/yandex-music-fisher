/* global chrome, storage, ga, downloader */

(()=> {
    'use strict';

    let utils = {};
    window.utils = utils;

    utils.ajax = (url, type, onProgress) => new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = type;
        xhr.onload = () => {
            if (xhr.status === 200) {
                if (xhr.response) {
                    resolve(xhr.response);
                } else {
                    reject({
                        message: 'Пустой ответ',
                        details: url
                    });
                }
            } else {
                reject({
                    message: xhr.statusText + ' (' + xhr.status + ')',
                    details: url
                });
            }
        };
        xhr.onerror = () => reject({
            message: 'Ошибка при запросе',
            details: url
        });

        if (onProgress) {
            xhr.onprogress = onProgress;
        }
        xhr.send();
    });

    utils.delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    utils.bytesToStr = bytes => {
        let KiB = 1024;
        let MiB = 1024 * KiB;
        let GiB = 1024 * MiB;
        if (bytes < GiB) {
            return (bytes / MiB).toFixed(2) + ' МиБ';
        } else {
            return (bytes / GiB).toFixed(2) + ' ГиБ';
        }
    };

    utils.addExtraZeros = (val, max) => {
        let valLength = val.toString().length;
        let maxLength = max.toString().length;
        let diff = maxLength - valLength;
        let zeros = '';
        for (let i = 0; i < diff; i++) {
            zeros += '0';
        }
        return zeros + val;
    };

    utils.durationToStr = duration => {
        let seconds = Math.floor(duration / 1000);
        let minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        let hours = Math.floor(minutes / 60);
        minutes -= hours * 60;
        return hours + ':' + utils.addExtraZeros(minutes, 10) + ':' + utils.addExtraZeros(seconds, 10);
    };

    utils.clearPath = (path, isDir) => {
        let unsafeChars = /[\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        path = path.replace(/^\./, '_'); // первый символ - точка (https://music.yandex.ru/album/2289231/track/20208868)
        path = path.replace(/"/g, "''"); // двойные кавычки в одинарные
        path = path.replace(/\t/g, ' '); // табы в пробелы (https://music.yandex.ru/album/718010/track/6570232)
        path = path.replace(unsafeChars, '');
        path = path.replace(/[\\/:*?<>|~]/g, '_'); // запрещённые символы в винде
        if (isDir) {
            path = path.replace(/(\.| )$/, '_'); // точка или пробел в конце
            // пример папки с точкой в конце https://music.yandex.ru/album/1288439/
            // пример папки с пробелом в конце https://music.yandex.ru/album/62046/
        }
        return path;
    };

    utils.logError = error => {
        console.error(error.message, error.details);
        if (error.message !== 'Пустой ответ' && error.message !== 'Ошибка трека: no-rights') {
            ga('send', 'event', 'error', error.message, error.details);
        }
    };

    utils.parseArtists = allArtists => {
        const VA = 'Various Artists'; // пример https://music.yandex.ru/album/718010/track/6570232
        const UA = 'Unknown Artist'; // пример https://music.yandex.ru/album/533785/track/4790215
        let artists = [];
        let composers = [];
        allArtists.forEach(artist => {
            if (artist.composer) { // пример https://music.yandex.ru/album/717747/track/6672611
                composers.push(artist.name);
            } else if (artist.various) {
                artists.push(VA);
            } else {
                artists.push(artist.name);
            }
        });
        if (!artists.length) {
            if (composers.length) {
                artists = composers;
            } else {
                artists.push(UA);
            }
        }
        return {
            artists: artists,
            composers: composers
        };
    };

    utils.getUrlInfo = url => {
        let info = {};
        let parts = url.replace(/\?.*/, '').split('/');
        //["http:", "", "music.yandex.ru", "users", "furfurmusic", "playlists", "1000"]
        info.isYandexMusic = (
            parts[2] === 'music.yandex.ru' ||
            parts[2] === 'music.yandex.ua' ||
            parts[2] === 'music.yandex.kz' ||
            parts[2] === 'music.yandex.by'
        );
        if (info.isYandexMusic) {
            storage.current.domain = parts[2].split('.')[2];
        } else {
            return info;
        }
        info.isPlaylist = (parts[3] === 'users' && parts[5] === 'playlists' && !!parts[6]);
        info.isTrack = (parts[3] === 'album' && parts[5] === 'track' && !!parts[6]);
        info.isAlbum = (parts[3] === 'album' && !!parts[4]);
        info.isArtist = (parts[3] === 'artist' && !!parts[4]);
        info.isLabel = (parts[3] === 'label' && !!parts[4]);
        info.isGenre = (parts[3] === 'genre');
        if (info.isPlaylist) {
            info.username = parts[4];
            info.playlistId = parts[6];
        } else if (info.isTrack) {
            info.trackId = parts[6];
        } else if (info.isAlbum) {
            info.albumId = parts[4];
        } else if (info.isArtist) {
            info.artistId = parts[4];
        } else if (info.isLabel) {
            info.labelId = parts[4];
        }
        return info;
    };

    utils.updateTabIcon = tab => {
        let page = utils.getUrlInfo(tab.url);
        let iconPath = 'img/black.png';
        if (page.isPlaylist) {
            iconPath = 'img/green.png';
        } else if (page.isTrack || page.isGenre) {
            iconPath = 'img/blue.png';
        } else if (page.isAlbum) {
            iconPath = 'img/yellow.png';
        } else if (page.isArtist || page.isLabel) {
            iconPath = 'img/pink.png';
        }
        chrome.browserAction.setIcon({
            tabId: tab.id,
            path: iconPath
        });
    };

    utils.getActiveTab = () => new Promise((resolve, reject) => {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, tabs => {
            if (tabs.length) {
                resolve(tabs[0]);
            } else {
                reject(new Error('No active tab'));
            }
        });
    });

    utils.getDownload = downloadId => new Promise(resolve => {
        chrome.downloads.search({
            id: downloadId
        }, downloads => {
            if (downloads.length && downloads[0].byExtensionName === chrome.runtime.getManifest().name) {
                resolve(downloads[0]);
            }
        });
    });

    utils.updateBadge = () => {
        let count = downloader.getDownloadCount();
        let countStr = '';
        if (count) {
            countStr = count.toString();
        }
        chrome.browserAction.setBadgeText({
            text: countStr
        });
    };

    utils.checkUpdate = () => new Promise(resolve => {
        let releaseInfoUrl = 'https://api.github.com/repos/egoroof/yandex-music-fisher/releases/latest';
        utils.ajax(releaseInfoUrl, 'json').then(releaseInfo => {
            let latestVersion = releaseInfo.tag_name.replace('v', '').split('.');
            let currentVersion = chrome.runtime.getManifest().version.split('.');

            let isMajorUpdate = (
                latestVersion[0] > currentVersion[0]
            );
            let isMinorUpdate = (
                latestVersion[1] > currentVersion[1] &&
                latestVersion[0] === currentVersion[0]
            );
            let isPatchUpdate = (
                latestVersion[2] > currentVersion[2] &&
                latestVersion[1] === currentVersion[1] &&
                latestVersion[0] === currentVersion[0]
            );

            if (isMajorUpdate || isMinorUpdate || isPatchUpdate) {
                resolve({
                    version: latestVersion.join('.'),
                    distUrl: releaseInfo.assets[0].browser_download_url
                });
            }
        }).catch(utils.logError);
    });

})();
