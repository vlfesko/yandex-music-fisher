/* global storage, yandex, chrome, utils */
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
        if (trackAlbum.volumes.length === 1 && trackAlbum.volumes[0].length === 1) {
            return undefined; // частый случай оборачивания треков в альбомы, игнорируем это
        }
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

    function onInterruptEntity(error) {
        entity.status = downloader.STATUS.INTERRUPTED;
        entity.loadedBytes = 0;
        console.error(error);
        downloader.activeThreadCount--;
        downloader.download();
    }

    function onChromeDownloadStart(downloadId) {
        if (chrome.runtime.lastError) {
            onInterruptEntity(chrome.runtime.lastError.message);
        } else {
            entity.browserDownloadId = downloadId;
        }
    }

    function onProgress(event) {
        entity.loadedBytes = event.loaded;
    }

    function handleTrackUrl(url) {
        trackUrl = url;
        yandex.getAlbum(track.albums[0].id, handleAlbum, onInterruptEntity);
    }

    function handleAlbum(album) {
        trackAlbum = album;
        if (album.coverUri) {
            var coverUrl = 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSize);
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
        var frames = {
            TIT2: entity.title, // Название
            TPE1: entity.artists, // Исполнители
            TALB: trackAlbum.title // Альбом
        };
        if (trackAlbum.year) {
            frames.TYER = trackAlbum.year; // Год
        }
        var trackPostition = getTrackPositionInAlbum();
        if (trackPostition) {
            frames.TRCK = trackPostition.track; // Номер в альбоме
            if (trackPostition.albumCount > 1) {
                frames.TPOS = trackPostition.album; // Номер диска
            }
        }
        if (trackAlbum.artists[0].name !== 'сборник') {
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
            var savePath = storage.current.trackNameMask.replace('#НАЗВАНИЕ#', entity.title);
            savePath = savePath.replace('#ИСПОЛНИТЕЛИ#', entity.artists);
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
            chrome.downloads.download({
                url: entity.url,
                filename: entity.filename,
                saveAs: false
            }, onChromeDownloadStart);
            break;
    }
};

downloader.downloadTrack = function (trackId) {
    yandex.getTrack(trackId, function (track) {
        var entity = {
            type: downloader.TYPE.TRACK,
            status: downloader.STATUS.WAITING,
            index: downloader.downloads.length,
            track: track,
            artists: utils.parseArtists(track.artists),
            title: track.title,
            loadedBytes: 0
        };
        if (track.version) {
            entity.title += ' (' + track.version + ')';
        }
        downloader.downloads.push(entity);
        downloader.download();
    }, function (error) {
        console.error(error);
    });
};

downloader.downloadAlbum = function (albumId, discographyArtist) {
    yandex.getAlbum(albumId, function (album) {
        if (!album.volumes.length) {
            console.error('Пустой альбом. album.id:' + album.id);
            return;
        }
        var albumEntity = {
            type: downloader.TYPE.ALBUM,
            index: downloader.downloads.length,
            duration: 0,
            size: 0,
            artists: utils.parseArtists(album.artists),
            title: album.title,
            tracks: []
        };

        if (album.version) {
            albumEntity.title += ' (' + album.version + ')';
        }
        var saveDir = utils.clearPath(albumEntity.artists + ' - ' + albumEntity.title);
        if (discographyArtist) {
            saveDir = utils.clearPath(discographyArtist) + '/' + saveDir;
        }

        if (storage.current.shouldDownloadCover && album.coverUri) {
            albumEntity.cover = {
                type: downloader.TYPE.COVER,
                status: downloader.STATUS.WAITING,
                url: 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSize),
                filename: saveDir + '/cover.jpg'
            };
        }

        for (var i = 0; i < album.volumes.length; i++) {
            for (var j = 0; j < album.volumes[i].length; j++) {
                var track = album.volumes[i][j];
                if (track.error) {
                    console.error('Ошибка: ' + track.error + '. trackId: ' + track.id);
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
                    artists: utils.parseArtists(track.artists),
                    title: track.title,
                    loadedBytes: 0,
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
    }, function (error) {
        console.error(error);
    });
};

downloader.downloadPlaylist = function (username, playlistId) {
    yandex.getPlaylist(username, playlistId, function (playlist) {
        if (!playlist.tracks.length) {
            console.error('Пустой плейлист. username: ' + username + ', playlistId: ' + playlistId);
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
                console.error('Ошибка: ' + track.error + '. trackId: ' + track.id);
                continue;
            }
            playlistEntity.size += track.fileSize;
            playlistEntity.duration += track.durationMs;
            var trackEntity = {
                type: downloader.TYPE.TRACK,
                status: downloader.STATUS.WAITING,
                track: track,
                artists: utils.parseArtists(track.artists),
                title: track.title,
                loadedBytes: 0,
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
    }, function (error) {
        console.error(error);
    });
};
