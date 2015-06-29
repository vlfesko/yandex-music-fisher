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

downloader.getWaitingEntity = function () {
    for (var i = 0; i < downloader.downloads.length; i++) {
        var entity = downloader.downloads[i];
        if (!entity) {
            continue; // эту загрузку удалили
        }
        if (entity.type === downloader.TYPE.ALBUM || entity.type === downloader.TYPE.PLAYLIST) {
            for (var j = 0; j < entity.tracks.length; j++) {
                if (entity.tracks[j].status === downloader.STATUS.WAITING) {
                    return entity.tracks[j];
                }
            }
        } else if (entity.type === downloader.TYPE.TRACK || entity.type === downloader.TYPE.COVER) {
            if (entity.status === downloader.STATUS.WAITING) {
                return entity;
            }
        }
    }
    return undefined;
};

downloader.runAllThreads = function () {
    for (var i = 0; i < storage.current.downloadThreadCount; i++) {
        downloader.download();
    }
};

downloader.handleEntityInterruption = function (entity, error) {
    entity.status = downloader.STATUS.INTERRUPTED;
    entity.loadedBytes = 0;
    console.error(error);
    downloader.activeThreadCount--;
    downloader.download();
};

downloader.download = function () {
    if (downloader.activeThreadCount >= storage.current.downloadThreadCount) {
        return; // достигнуто максимальное количество потоков загрузки
    }
    var entity = downloader.getWaitingEntity();
    if (!entity) { // в очереди нет загрузок
        return;
    }
    entity.status = downloader.STATUS.LOADING;
    downloader.activeThreadCount++;

    if (entity.type === downloader.TYPE.TRACK) {
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

        yandex.getTrackUrl(track.storageDir, function (url) {
            yandex.getAlbum(track.albums[0].id, function (album) {
                var coverUri = 'https://avatars.yandex.net/get-music-content/8579b435.a.2770824-1/400x400';
                if (track.albums[0].coverUri) {
                    coverUri = 'https://' + track.albums[0].coverUri.replace('%%', '400x400');
                } // todo: ковера может не быть, тогда не надо его грузить
                utils.ajax(coverUri, 'arraybuffer', function (coverArrayBuffer) {
                    entity.xhr = utils.ajax(url, 'arraybuffer', function (trackArrayBuffer) {
                        var frames = {
                            TIT2: entity.title, // Название
                            TPE1: entity.artists, // Исполнители
                            TALB: track.albums[0].title, // Альбом
                            TYER: track.albums[0].year // Год
                        };
                        var genre = track.albums[0].genre;
                        var trackPostition = downloader.getTrackPositionInAlbum(track.id, album);
                        if (trackPostition) {
                            frames.TRCK = trackPostition.track; // Номер в альбоме
                            if (trackPostition.albumCount > 1) {
                                frames.TPOS = trackPostition.album; // Номер диска
                            }
                        }
                        if (track.albums[0].artists[0].name !== 'сборник') {
                            frames.TPE2 = track.albums[0].artists[0].name; // Исполнитель альбома
                        }
                        if (genre) {
                            frames.TCON = genre[0].toUpperCase() + genre.substr(1); // Жанр
                        }
                        frames.APIC = coverArrayBuffer; // Обложка

                        var localUrl = utils.addId3Tag(trackArrayBuffer, frames);

                        chrome.downloads.download({
                            url: localUrl,
                            filename: savePath,
                            saveAs: false
                        }, function (downloadId) {
                            if (chrome.runtime.lastError) {
                                downloader.handleEntityInterruption(entity, chrome.runtime.lastError.message);
                            } else {
                                entity.browserDownloadId = downloadId;
                            }
                        });
                    }, function (error) {
                        downloader.handleEntityInterruption(entity, error);
                    }, function (event) {
                        entity.loadedBytes = event.loaded;
                    });
                }, function (error) {
                    downloader.handleEntityInterruption(entity, error);
                });
            }, function (error) {
                downloader.handleEntityInterruption(entity, error);
            });
        }, function (error) {
            downloader.handleEntityInterruption(entity, error);
        });
    } else if (entity.type === downloader.TYPE.COVER) {
        chrome.downloads.download({
            url: entity.url,
            filename: entity.filename,
            saveAs: false
        }, function (downloadId) {
            if (chrome.runtime.lastError) {
                downloader.handleEntityInterruption(entity, chrome.runtime.lastError.message);
            } else {
                entity.browserDownloadId = downloadId;
            }
        });
    }
};

downloader.getTrackPositionInAlbum = function (trackId, album) {
    if (album.volumes.length === 1 && album.volumes[0].length === 1) {
        return undefined; // частый случай оборачивания треков в альбомы, игнорируем это
    }
    for (var i = 0; i < album.volumes.length; i++) {
        for (var j = 0; j < album.volumes[i].length; j++) {
            var track = album.volumes[i][j];
            if (track.id === trackId) {
                return {
                    track: j + 1,
                    album: i + 1,
                    albumCount: album.volumes.length
                };
            }
        }
    }
    return undefined;
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
            downloader.downloads.push({
                type: downloader.TYPE.COVER,
                status: downloader.STATUS.WAITING,
                index: downloader.downloads.length,
                url: 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSize),
                filename: saveDir + '/cover.jpg'
            });
            downloader.download();
        }
        albumEntity.index = downloader.downloads.length;

        for (var i = 0; i < album.volumes.length; i++) {
            for (var j = 0; j < album.volumes[i].length; j++) {
                var track = album.volumes[i][j];
                if (track.error) { // todo: проверить, если ли сейчас такое поле
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
