/* global storage, yandex, chrome, utils, ga */
'use strict';

var downloader = {
    TYPE: Object.freeze({
        TRACK: 'track',
        ALBUM: 'album',
        PLAYLIST: 'playlist',
        COVER: 'cover'
    }),
    STATUS: Object.freeze({
        WAITING: 'waiting',
        LOADING: 'loading',
        FINISHED: 'finished',
        INTERRUPTED: 'interrupted'
    }),
    downloads: [],
    activeThreadCount: 0
};

downloader.runAllThreads = function () {
    for (var i = 0; i < storage.current.downloadThreadCount; i++) {
        downloader.download();
    }
};

downloader.download = function () {
    function getWaitingEntity() {
        for (var i = 0; i < downloader.downloads.length; i++) {
            var entity = downloader.downloads[i];
            if (!entity) {
                continue; // эту загрузку удалили
            }
            if (entity.type === downloader.TYPE.ALBUM &&
                entity.cover && entity.cover.status === downloader.STATUS.WAITING) {

                return entity.cover;
            }
            switch (entity.type) {
                case downloader.TYPE.ALBUM:
                case downloader.TYPE.PLAYLIST:
                    for (var j = 0; j < entity.tracks.length; j++) {
                        if (entity.tracks[j].status === downloader.STATUS.WAITING) {
                            return entity.tracks[j];
                        }
                    }
                    break;
                case downloader.TYPE.TRACK:
                    if (entity.status === downloader.STATUS.WAITING) {
                        return entity;
                    }
                    break;
            }
        }
        return undefined;
    }

    function getTrackPositionInAlbum() {
        for (var i = 0; i < trackAlbum.volumes.length; i++) {
            for (var j = 0; j < trackAlbum.volumes[i].length; j++) {
                if (track.id === trackAlbum.volumes[i][j].id) {
                    return {
                        track: j + 1,
                        album: i + 1,
                        albumCount: trackAlbum.volumes.length
                    };
                }
            }
        }
        return undefined;
    }

    function onInterruptEntity(error, details) {
        entity.attemptCount++;
        entity.loadedBytes = 0;
        if (entity.attemptCount < 3) {
            setTimeout(function () {
                entity.status = downloader.STATUS.WAITING;
                downloader.download();
            }, 10000);
        } else {
            entity.status = downloader.STATUS.INTERRUPTED;
            utils.logError(error, details);
        }
        downloader.activeThreadCount--;
        downloader.download();
    }

    function onChromeDownloadStart(downloadId) {
        if (chrome.runtime.lastError) {
            var details;
            if (entity.type === downloader.TYPE.TRACK) {
                details = track.id;
            } else if (entity.type === downloader.TYPE.COVER) {
                details = entity.url;
            }
            onInterruptEntity(chrome.runtime.lastError.message, details);
        } else {
            entity.browserDownloadId = downloadId;
        }
    }

    function onProgress(event) {
        entity.loadedBytes = event.loaded;
        entity.totalBytes = event.total; // используется только для обложки
    }

    function handleTrackUrl(url) {
        trackUrl = url;
        yandex.getAlbum(track.albums[0].id, handleAlbum, onInterruptEntity); // альбом нужен для вычисления номера трека
    }

    function handleAlbum(album) {
        trackAlbum = album;
        if (album.coverUri) {
            var coverUrl = 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSizeId3);
            utils.ajax(coverUrl, 'arraybuffer', handleCover, onInterruptEntity);
        } else {
            // пример: https://music.yandex.ru/album/2236232/track/23652415
            entity.xhr = utils.ajax(trackUrl, 'arraybuffer', saveTrack, onInterruptEntity, onProgress);
        }
    }

    function handleCover(arrayBuffer) {
        coverArrayBuffer = arrayBuffer;
        entity.xhr = utils.ajax(trackUrl, 'arraybuffer', saveTrack, onInterruptEntity, onProgress);
    }

    function saveTrack(trackArrayBuffer) {
        entity.xhr = null;
        var artists = utils.parseArtists(track.artists, '/');
        var frames = {
            TIT2: entity.title, // Название
            TPE1: artists.artists, // Исполнители
            TALB: trackAlbum.title, // Альбом
            TLEN: track.durationMs // Продолжительность
        };
        if (trackAlbum.year) {
            frames.TYER = trackAlbum.year; // Год
        }
        if (artists.composers) {
            frames.TCOM = artists.composers; // Композиторы
        }
        var trackPostition = getTrackPositionInAlbum();
        if (trackPostition) {
            frames.TRCK = trackPostition.track; // Номер в альбоме
            if (trackPostition.albumCount > 1) {
                frames.TPOS = trackPostition.album; // Номер диска
            }
        }
        if (trackAlbum.artists[0].name === 'сборник') {
            frames.TPE2 = 'Various Artists'; // Исполнитель альбома
        } else {
            frames.TPE2 = trackAlbum.artists[0].name; // Исполнитель альбома
        }
        var genre = trackAlbum.genre;
        if (genre) {
            frames.TCON = genre[0].toUpperCase() + genre.substr(1); // Жанр
        }
        if (coverArrayBuffer) {
            frames.APIC = coverArrayBuffer; // Обложка
        }

        var localUrl = utils.addId3Tag(trackArrayBuffer, frames);

        chrome.downloads.download({
            url: localUrl,
            filename: savePath,
            saveAs: false
        }, onChromeDownloadStart);
    }

    function saveCover(coverArrayBuffer) {
        entity.xhr = null;
        var blob = new Blob([coverArrayBuffer], {type: 'image/jpeg'});
        var localUrl = window.URL.createObjectURL(blob);
        chrome.downloads.download({
            url: localUrl,
            filename: entity.filename,
            saveAs: false
        }, onChromeDownloadStart);
    }

    if (downloader.activeThreadCount < 0) {
        downloader.activeThreadCount = 0; // выравнивание при сбоях
    }
    if (downloader.activeThreadCount >= storage.current.downloadThreadCount) {
        return; // достигнуто максимальное количество потоков загрузки
    }
    var entity = getWaitingEntity();
    if (!entity) { // в очереди нет загрузок
        return;
    }
    entity.status = downloader.STATUS.LOADING;
    downloader.activeThreadCount++;
    var coverArrayBuffer;
    var trackAlbum;
    var trackUrl;

    switch (entity.type) {
        case downloader.TYPE.TRACK:
            var track = entity.track;
            var savePath = entity.artists + ' - ' + entity.title;
            if (storage.current.shouldNumberLists && entity.namePrefix) {
                savePath = entity.namePrefix + ' ' + savePath;
            }
            savePath = utils.clearPath(savePath) + '.mp3';
            if (entity.saveDir) {
                savePath = entity.saveDir + '/' + savePath;
            }

            yandex.getTrackUrl(track.storageDir, handleTrackUrl, onInterruptEntity);
            break;
        case downloader.TYPE.COVER:
            entity.xhr = utils.ajax(entity.url, 'arraybuffer', saveCover, onInterruptEntity, onProgress);
            break;
    }
};

downloader.downloadTrack = function (trackId) {
    ga('send', 'event', 'track', trackId);
    yandex.getTrack(trackId, function (track) {
        var entity = {
            type: downloader.TYPE.TRACK,
            status: downloader.STATUS.WAITING,
            index: downloader.downloads.length,
            track: track,
            artists: utils.parseArtists(track.artists, ', ').artists,
            title: track.title,
            loadedBytes: 0,
            attemptCount: 0
        };
        if (track.version) {
            entity.title += ' (' + track.version + ')';
        }
        downloader.downloads.push(entity);
        downloader.download();
    }, utils.logError);
};

downloader.downloadAlbum = function (albumId, discographyArtist) {
    ga('send', 'event', 'album', albumId);
    yandex.getAlbum(albumId, function (album) {
        if (!album.volumes.length) {
            utils.logError('Пустой альбом', albumId);
            return;
        }
        var albumEntity = {
            type: downloader.TYPE.ALBUM,
            index: downloader.downloads.length,
            duration: 0,
            size: 0,
            artists: utils.parseArtists(album.artists, ', ').artists,
            title: album.title,
            tracks: []
        };

        if (album.version) {
            albumEntity.title += ' (' + album.version + ')';
        }
        if (albumEntity.artists === 'сборник') {
            albumEntity.artists = 'Various Artists';
        }
        var saveDir = utils.clearPath(albumEntity.artists + ' - ' + albumEntity.title);
        if (album.year) {
            saveDir = album.year + ' - ' + saveDir;
        }
        if (discographyArtist) {
            saveDir = utils.clearPath(discographyArtist) + '/' + saveDir;
        }

        if (storage.current.shouldDownloadCover && album.coverUri) {
            albumEntity.cover = {
                type: downloader.TYPE.COVER,
                status: downloader.STATUS.WAITING,
                url: 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSize),
                filename: saveDir + '/cover.jpg',
                loadedBytes: 0,
                totalBytes: 1, // пока не получен размер - прогресс в загрузчике не дойдёт до 100%
                attemptCount: 0
            };
        }

        for (var i = 0; i < album.volumes.length; i++) {
            for (var j = 0; j < album.volumes[i].length; j++) {
                var track = album.volumes[i][j];
                if (track.error) {
                    utils.logError('Ошибка трека: ' + track.error, track.id);
                    continue;
                }
                var saveCdDir = saveDir;
                if (album.volumes.length > 1) {
                    // пример: https://music.yandex.ru/album/2490723
                    saveCdDir += '/CD' + (i + 1);
                }
                albumEntity.size += track.fileSize;
                albumEntity.duration += track.durationMs;
                var trackEntity = {
                    type: downloader.TYPE.TRACK,
                    status: downloader.STATUS.WAITING,
                    track: track,
                    artists: utils.parseArtists(track.artists, ', ').artists,
                    title: track.title,
                    loadedBytes: 0,
                    attemptCount: 0,
                    saveDir: saveCdDir,
                    namePrefix: utils.addExtraZeros(j + 1, album.volumes[i].length)
                };
                if (track.version) {
                    trackEntity.title += ' (' + track.version + ')';
                }
                albumEntity.tracks.push(trackEntity);
            }
        }
        downloader.downloads.push(albumEntity);
        downloader.runAllThreads();
    }, utils.logError);
};

downloader.downloadPlaylist = function (username, playlistId) {
    ga('send', 'event', 'playlist', username + '#' + playlistId);
    yandex.getPlaylist(username, playlistId, function (playlist) {
        if (!playlist.tracks.length) {
            utils.logError('Пустой плейлист', username + '#' + playlistId);
            return;
        }
        var playlistEntity = {
            type: downloader.TYPE.PLAYLIST,
            index: downloader.downloads.length,
            duration: 0,
            size: 0,
            title: playlist.title,
            tracks: []
        };

        for (var i = 0; i < playlist.tracks.length; i++) {
            var track = playlist.tracks[i];
            if (track.error) {
                utils.logError('Ошибка трека: ' + track.error, track.id);
                continue;
            }
            playlistEntity.size += track.fileSize;
            playlistEntity.duration += track.durationMs;
            var trackEntity = {
                type: downloader.TYPE.TRACK,
                status: downloader.STATUS.WAITING,
                track: track,
                artists: utils.parseArtists(track.artists, ', ').artists,
                title: track.title,
                loadedBytes: 0,
                attemptCount: 0,
                saveDir: utils.clearPath(playlist.title),
                namePrefix: utils.addExtraZeros(i + 1, playlist.tracks.length)
            };
            if (track.version) {
                trackEntity.title += ' (' + track.version + ')';
            }
            playlistEntity.tracks.push(trackEntity);
        }
        downloader.downloads.push(playlistEntity);
        downloader.runAllThreads();
    }, utils.logError);
};
