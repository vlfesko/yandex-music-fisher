/* global storage, yandex, chrome, utils, ga */

(()=> {
    'use strict';

    let downloader = {
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
        PATH_LIMIT: 50,
        downloads: [],
        activeThreadCount: 0
    };
    window.downloader = downloader;

    downloader.runAllThreads = () => {
        for (let i = 0; i < storage.current.downloadThreadCount; i++) {
            downloader.download();
        }
    };

    downloader.download = () => {
        if (downloader.activeThreadCount < 0) {
            downloader.activeThreadCount = 0; // выравнивание при сбоях
        }
        if (downloader.activeThreadCount >= storage.current.downloadThreadCount) {
            return; // достигнуто максимальное количество потоков загрузки
        }
        let entity = downloader.getWaitingEntity();
        if (!entity) { // в очереди нет загрузок
            return;
        }
        entity.status = downloader.STATUS.LOADING;
        downloader.activeThreadCount++;
        let coverArrayBuffer;
        let trackAlbum;
        let trackUrl;
        let chain = Promise.resolve();

        let onInterruptEntity = error => {
            entity.attemptCount++;
            entity.loadedBytes = 0;
            if (entity.attemptCount < 3) {
                utils.delay(10000).then(() => {
                    entity.status = downloader.STATUS.WAITING;
                    downloader.download();
                });
            } else {
                entity.status = downloader.STATUS.INTERRUPTED;
                utils.logError(error);
            }
            downloader.activeThreadCount--;
            downloader.download();
        };

        let onProgress = event => {
            entity.loadedBytes = event.loaded;
        };

        let onChromeDownloadStart = downloadId => {
            if (chrome.runtime.lastError) {
                let error = {
                    message: chrome.runtime.lastError.message,
                    details: ''
                };
                if (entity.type === downloader.TYPE.TRACK) {
                    error.details = entity.track.id;
                } else if (entity.type === downloader.TYPE.COVER) {
                    error.details = entity.url;
                }
                onInterruptEntity(error);
            } else {
                entity.browserDownloadId = downloadId;
            }
        };

        let saveTrack = trackArrayBuffer => {
            if (!downloader.downloads[entity.index]) { // загрузку отменили
                return;
            }
            let artists = utils.parseArtists(entity.track.artists, '/');
            let frames = {
                TIT2: entity.title, // Название
                TPE1: artists.artists // Исполнители
            };
            if (trackAlbum.title) {
                frames.TALB = trackAlbum.title; // Альбом
            }
            if (entity.track.durationMs) {
                frames.TLEN = entity.track.durationMs; // Продолжительность
            }
            if (trackAlbum.year) {
                frames.TYER = trackAlbum.year; // Год
            }
            if (artists.composers) {
                frames.TCOM = artists.composers; // Композиторы
            }
            if (entity.trackPosition) {
                frames.TRCK = entity.trackPosition; // Номер в альбоме
            }
            if (entity.albumPosition && entity.albumCount > 1) {
                frames.TPOS = entity.albumPosition; // Номер диска
            }
            frames.TPE2 = utils.parseArtists(trackAlbum.artists, ', ').artists; // Исполнитель альбома
            let genre = trackAlbum.genre;
            if (genre) {
                frames.TCON = genre[0].toUpperCase() + genre.substr(1); // Жанр
            }
            if (coverArrayBuffer) {
                frames.APIC = coverArrayBuffer; // Обложка
            }

            let localUrl = utils.addId3Tag(trackArrayBuffer, frames);

            chrome.downloads.download({
                url: localUrl,
                filename: entity.savePath,
                conflictAction: 'overwrite',
                saveAs: false
            }, onChromeDownloadStart);
        };

        let onInterruptEntityExcept404 = error => {
            if (error.message === 'Not found (404)') { // обложки с выбранном размером нет - игнорируем её
                if (entity.type === downloader.TYPE.TRACK) { // продолжаем загрузку трека без обложки
                    chain = chain.then(() => utils.ajax(trackUrl, 'arraybuffer', onProgress))
                        .then(saveTrack)
                        .catch(onInterruptEntity);
                }
            } else {
                onInterruptEntity(error);
            }
        };

        if (entity.type === downloader.TYPE.TRACK) {
            trackAlbum = entity.track.albums[0];
            if (trackAlbum.coverUri) {
                // пример альбома без обложки: https://music.yandex.ru/album/2236232/track/23652415
                let coverUrl = 'https://' + trackAlbum.coverUri.replace('%%', storage.current.albumCoverSizeId3);
                chain = chain.then(() => utils.ajax(coverUrl, 'arraybuffer'))
                    .catch(onInterruptEntityExcept404)
                    .then(arrayBuffer => {
                        coverArrayBuffer = arrayBuffer;
                    });
            }
            if (storage.current.downloadHighestBitrate) {
                chain = chain.then(() => yandex.getTrackUrl(entity.track.id));
            } else {
                chain = chain.then(() => yandex.getTrackOldUrl(entity.track.storageDir));
            }
            chain.then(url => {
                    trackUrl = url;
                })
                .then(() => utils.ajax(trackUrl, 'arraybuffer', onProgress))
                .then(saveTrack)
                .catch(onInterruptEntity);
        } else if (entity.type === downloader.TYPE.COVER) {
            utils.ajax(entity.url, 'arraybuffer', onProgress).then(arrayBuffer => {
                if (!downloader.downloads[entity.index]) { // загрузку отменили
                    return;
                }
                let blob = new Blob([arrayBuffer], {type: 'image/jpeg'});
                let localUrl = window.URL.createObjectURL(blob);
                chrome.downloads.download({
                    url: localUrl,
                    filename: entity.filename,
                    conflictAction: 'overwrite',
                    saveAs: false
                }, onChromeDownloadStart);
            }).catch(onInterruptEntityExcept404);
        }
    };

    downloader.downloadTrack = trackId => {
        ga('send', 'event', 'track', trackId);
        yandex.getTrack(trackId).then(track => {
            if (track.error) {
                utils.logError({
                    message: 'Ошибка трека: ' + track.error,
                    details: track.id
                });
                return;
            }

            let entity = {
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

            let shortArtists = entity.artists.substr(0, downloader.PATH_LIMIT);
            let shortTitle = entity.title.substr(0, downloader.PATH_LIMIT);
            entity.savePath = utils.clearPath(shortArtists + ' - ' + shortTitle + '.mp3', false);

            downloader.downloads.push(entity);
            downloader.download();
        }).catch(utils.logError);
    };

    downloader.downloadAlbum = (albumId, artistOrLabelName) => {
        ga('send', 'event', 'album', albumId);
        yandex.getAlbum(albumId).then(album => {
            if (!album.trackCount) {
                return;
            }
            let albumEntity = {
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
            let saveDir = '';
            if (artistOrLabelName) {
                let shortName = artistOrLabelName.substr(0, downloader.PATH_LIMIT);
                saveDir += utils.clearPath(shortName, true) + '/';
            }
            let shortAlbumArtists = albumEntity.artists.substr(0, downloader.PATH_LIMIT);
            let shortAlbumTitle = albumEntity.title.substr(0, downloader.PATH_LIMIT);
            if (album.year) {
                saveDir += utils.clearPath(album.year + ' - ' + shortAlbumArtists + ' - ' + shortAlbumTitle, true);
            } else {
                saveDir += utils.clearPath(shortAlbumArtists + ' - ' + shortAlbumTitle, true);
            }

            if (storage.current.shouldDownloadCover && album.coverUri) {
                albumEntity.cover = {
                    type: downloader.TYPE.COVER,
                    index: albumEntity.index,
                    status: downloader.STATUS.WAITING,
                    url: 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSize),
                    filename: saveDir + '/cover.jpg',
                    loadedBytes: 0,
                    attemptCount: 0
                };
            }

            // принудительная нумерация при совпадении названий, пример: https://music.yandex.ru/album/512639
            let duplicationMap = [];
            album.volumes.forEach(volume => {
                let volumeTrackNames = [];
                volume.forEach(track => {
                    if (track.error) {
                        return;
                    }
                    let title = track.title;
                    if (track.version) {
                        title += ' (' + track.version + ')';
                    }
                    let shortTitle = title.substr(0, downloader.PATH_LIMIT);
                    volumeTrackNames.push(shortTitle);
                });
                duplicationMap.push(utils.existDuplicates(volumeTrackNames));
            });

            album.volumes.forEach((volume, i) => {
                volume.forEach((track, j) => {
                    if (track.error) {
                        utils.logError({
                            message: 'Ошибка трека: ' + track.error,
                            details: track.id
                        });
                        return;
                    }

                    albumEntity.size += track.fileSize;
                    albumEntity.duration += track.durationMs;
                    let trackPosition = j + 1;
                    let albumPosition = i + 1;
                    let trackEntity = {
                        type: downloader.TYPE.TRACK,
                        index: albumEntity.index,
                        status: downloader.STATUS.WAITING,
                        track: track,
                        artists: utils.parseArtists(track.artists, ', ').artists,
                        title: track.title,
                        loadedBytes: 0,
                        attemptCount: 0,
                        trackPosition: trackPosition,
                        albumPosition: albumPosition,
                        albumCount: album.volumes.length
                    };
                    if (track.version) {
                        trackEntity.title += ' (' + track.version + ')';
                    }

                    let savePath = saveDir + '/';
                    if (album.volumes.length > 1) {
                        // пример: https://music.yandex.ru/album/2490723
                        savePath += 'CD' + albumPosition + '/';
                    }

                    if (storage.current.enumerateAlbums || duplicationMap[i]) {
                        savePath += utils.addExtraZeros(trackPosition, volume.length) + '. ';
                    }

                    let shortTrackTitle = trackEntity.title.substr(0, downloader.PATH_LIMIT);
                    trackEntity.savePath = savePath + utils.clearPath(shortTrackTitle + '.mp3', false);

                    albumEntity.tracks.push(trackEntity);
                });
            });

            if (!albumEntity.tracks.length) {
                return;
            }

            downloader.downloads.push(albumEntity);
            downloader.runAllThreads();
        }).catch(utils.logError);
    };

    downloader.downloadPlaylist = (username, playlistId) => {
        ga('send', 'event', 'playlist', username, playlistId);
        yandex.getPlaylist(username, playlistId).then(playlist => {
            if (!playlist.trackCount) {
                return;
            }
            let playlistEntity = {
                type: downloader.TYPE.PLAYLIST,
                index: downloader.downloads.length,
                duration: 0,
                size: 0,
                title: playlist.title,
                tracks: []
            };
            let shortPlaylistTitle = playlist.title.substr(0, downloader.PATH_LIMIT);
            let saveDir = utils.clearPath(shortPlaylistTitle, true);

            let playlistTrackNames = [];
            playlist.tracks.forEach(track => {
                if (track.error) {
                    return;
                }
                let title = track.title;
                if (track.version) {
                    title += ' (' + track.version + ')';
                }
                let shortTitle = title.substr(0, downloader.PATH_LIMIT);
                playlistTrackNames.push(shortTitle);
            });
            let existDuplicates = utils.existDuplicates(playlistTrackNames);

            playlist.tracks.forEach((track, i) => {
                if (track.error) {
                    utils.logError({
                        message: 'Ошибка трека: ' + track.error,
                        details: track.id
                    });
                    return;
                }
                playlistEntity.size += track.fileSize;
                playlistEntity.duration += track.durationMs;
                let trackEntity = {
                    type: downloader.TYPE.TRACK,
                    index: playlistEntity.index,
                    status: downloader.STATUS.WAITING,
                    track: track,
                    artists: utils.parseArtists(track.artists, ', ').artists,
                    title: track.title,
                    loadedBytes: 0,
                    attemptCount: 0
                };
                if (track.version) {
                    trackEntity.title += ' (' + track.version + ')';
                }

                let savePath = saveDir + '/';
                if (storage.current.enumeratePlaylists || existDuplicates) {
                    savePath += utils.addExtraZeros(i + 1, playlist.tracks.length) + '. ';
                }

                let shortTrackArtists = trackEntity.artists.substr(0, downloader.PATH_LIMIT);
                let shortTrackTitle = trackEntity.title.substr(0, downloader.PATH_LIMIT);
                trackEntity.savePath = savePath + utils.clearPath(shortTrackArtists + ' - ' + shortTrackTitle + '.mp3', false);

                playlistEntity.tracks.push(trackEntity);
            });

            if (!playlistEntity.tracks.length) {
                return;
            }

            downloader.downloads.push(playlistEntity);
            downloader.runAllThreads();
        }).catch(utils.logError);
    };

    downloader.getWaitingEntity = () => {
        let foundEntity = false;
        downloader.downloads.some(entity => {
            let isAlbum = entity.type === downloader.TYPE.ALBUM;
            let isCover = isAlbum && entity.cover;
            let isPlaylist = entity.type === downloader.TYPE.PLAYLIST;
            let isTrack = entity.type === downloader.TYPE.TRACK;

            if (isCover && entity.cover.status === downloader.STATUS.WAITING) {
                foundEntity = entity.cover;
                return true;
            } else if (isAlbum || isPlaylist) {
                for (let j = 0; j < entity.tracks.length; j++) {
                    if (entity.tracks[j].status === downloader.STATUS.WAITING) {
                        foundEntity = entity.tracks[j];
                        return true;
                    }
                }
            } else if (isTrack) {
                if (entity.status === downloader.STATUS.WAITING) {
                    foundEntity = entity;
                    return true;
                }
            }
        });
        return foundEntity;
    };

    downloader.getEntityByBrowserDownloadId = browserDownloadId => {
        let foundEntity = false;
        downloader.downloads.some(entity => {
            let isAlbum = entity.type === downloader.TYPE.ALBUM;
            let isCover = isAlbum && entity.cover;
            let isPlaylist = entity.type === downloader.TYPE.PLAYLIST;
            let isTrack = entity.type === downloader.TYPE.TRACK;

            if (isCover && entity.cover.browserDownloadId === browserDownloadId) {
                foundEntity = entity.cover;
                return true;
            } else if (isAlbum || isPlaylist) {
                for (let j = 0; j < entity.tracks.length; j++) {
                    let track = entity.tracks[j];
                    if (track.browserDownloadId === browserDownloadId) {
                        foundEntity = track;
                        return true;
                    }
                }
            } else if (isTrack) {
                if (entity.browserDownloadId === browserDownloadId) {
                    foundEntity = entity;
                    return true;
                }
            }
        });
        return foundEntity;
    };

})();
