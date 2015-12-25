/* global storage, yandex, chrome, utils, ga, ID3Writer */

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
        utils.updateBadge();
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
                chrome.downloads.setShelfEnabled(true);
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
            let writer = new ID3Writer(trackArrayBuffer);
            let artists = utils.parseArtists(entity.track.artists);
            if (entity.title) {
                writer.setFrame('TIT2', entity.title);
            }
            if (artists.artists.length) {
                writer.setFrame('TPE1', artists.artists);
            }
            if (trackAlbum.title) {
                writer.setFrame('TALB', trackAlbum.title);
            }
            if (entity.track.durationMs) {
                writer.setFrame('TLEN', entity.track.durationMs);
            }
            if (trackAlbum.year) {
                writer.setFrame('TYER', trackAlbum.year);
            }
            if (artists.composers.length) {
                writer.setFrame('TCOM', artists.composers);
            }
            if (entity.trackPosition) {
                writer.setFrame('TRCK', entity.trackPosition);
            }
            if (entity.albumPosition && entity.albumCount > 1) {
                writer.setFrame('TPOS', entity.albumPosition);
            }
            let albumArtist = utils.parseArtists(trackAlbum.artists).artists.join(', ');
            if (albumArtist) {
                writer.setFrame('TPE2', albumArtist);
            }
            let genre = trackAlbum.genre;
            if (genre) {
                writer.setFrame('TCON', [genre[0].toUpperCase() + genre.substr(1)]);
            }
            if (entity.lyrics) {
                writer.setFrame('USLT', entity.lyrics);
            }
            if (coverArrayBuffer) {
                writer.setFrame('APIC', coverArrayBuffer);
            }
            writer.addTag();

            chrome.downloads.setShelfEnabled(false);
            chrome.downloads.download({
                url: writer.getURL(),
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
                chrome.downloads.setShelfEnabled(false);
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
        yandex.getTrack(trackId).then(json => {
            let track = json.track;
            if (track.error) {
                utils.logError({
                    message: 'Ошибка трека: ' + track.error,
                    details: track.id
                });
                return;
            }

            let trackEntity = {
                type: downloader.TYPE.TRACK,
                status: downloader.STATUS.WAITING,
                index: downloader.downloads.length,
                track: track,
                artists: utils.parseArtists(track.artists).artists.join(', '),
                title: track.title,
                savePath: null,
                lyrics: null,
                loadedBytes: 0,
                attemptCount: 0
            };
            if (track.version) {
                trackEntity.title += ' (' + track.version + ')';
            }
            if (json.lyric.length && json.lyric[0].fullLyrics) {
                trackEntity.lyrics = json.lyric[0].fullLyrics;
            }

            let shortArtists = trackEntity.artists.substr(0, downloader.PATH_LIMIT);
            let shortTitle = trackEntity.title.substr(0, downloader.PATH_LIMIT);
            trackEntity.savePath = utils.clearPath(shortArtists + ' - ' + shortTitle + '.mp3', false);

            downloader.downloads.push(trackEntity);
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
                artists: utils.parseArtists(album.artists).artists.join(', '),
                title: album.title,
                tracks: [],
                cover: null
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

            album.volumes.forEach((volume, i) => {
                let trackNameCounter = {}; // пример: https://music.yandex.ru/album/512639
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
                        artists: utils.parseArtists(track.artists).artists.join(', '),
                        title: track.title,
                        savePath: null,
                        loadedBytes: 0,
                        attemptCount: 0,
                        trackPosition: trackPosition,
                        albumPosition: albumPosition,
                        albumCount: album.volumes.length
                    };
                    if (track.version) {
                        trackEntity.title += ' (' + track.version + ')';
                    }
                    let shortTrackTitle = trackEntity.title.substr(0, downloader.PATH_LIMIT);

                    let savePath = saveDir + '/';
                    if (album.volumes.length > 1) {
                        // пример: https://music.yandex.ru/album/2490723
                        savePath += 'CD' + albumPosition + '/';
                    }

                    if (storage.current.enumerateAlbums) {
                        // нумеруем все треки
                        savePath += utils.addExtraZeros(trackPosition, volume.length) + '. ';
                    } else {
                        // если совпадают имена - добавляем номер
                        if (shortTrackTitle in trackNameCounter) {
                            trackNameCounter[shortTrackTitle]++;
                            shortTrackTitle += ' (' + trackNameCounter[shortTrackTitle] + ')';
                        } else {
                            trackNameCounter[shortTrackTitle] = 1;
                        }
                    }

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
            let trackNameCounter = {}; // пример https://music.yandex.ru/users/dimzon541/playlists/1002

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
                    artists: utils.parseArtists(track.artists).artists.join(', '),
                    title: track.title,
                    savePath: null,
                    loadedBytes: 0,
                    attemptCount: 0
                };
                if (track.version) {
                    trackEntity.title += ' (' + track.version + ')';
                }
                let shortTrackArtists = trackEntity.artists.substr(0, downloader.PATH_LIMIT);
                let shortTrackTitle = trackEntity.title.substr(0, downloader.PATH_LIMIT);
                let name = shortTrackArtists + ' - ' + shortTrackTitle;

                let savePath = saveDir + '/';
                if (storage.current.enumeratePlaylists) {
                    // нумеруем все треки
                    savePath += utils.addExtraZeros(i + 1, playlist.tracks.length) + '. ';
                } else {
                    // если совпадают имена - добавляем номер
                    if (name in trackNameCounter) {
                        trackNameCounter[name]++;
                        name += ' (' + trackNameCounter[name] + ')';
                    } else {
                        trackNameCounter[name] = 1;
                    }
                }

                trackEntity.savePath = savePath + utils.clearPath(name + '.mp3', false);
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

    downloader.getDownloadCount = () => {
        let count = 0;
        downloader.downloads.forEach(entity => {
            let isAlbum = entity.type === downloader.TYPE.ALBUM;
            let isCover = isAlbum && entity.cover;
            let isPlaylist = entity.type === downloader.TYPE.PLAYLIST;
            let isTrack = entity.type === downloader.TYPE.TRACK;

            if (isCover && entity.cover.status !== downloader.STATUS.FINISHED) {
                count++;
            }
            if (isAlbum || isPlaylist) {
                entity.tracks.forEach(track => {
                    if (track.status !== downloader.STATUS.FINISHED) {
                        count++;
                    }
                });
            } else if (isTrack && entity.status !== downloader.STATUS.FINISHED) {
                count++;
            }
        });
        return count;
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
