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
        let getWaitingEntity = () => {
            for (let i = 0; i < downloader.downloads.length; i++) {
                let entity = downloader.downloads[i];
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
                        for (let j = 0; j < entity.tracks.length; j++) {
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
        };

        if (downloader.activeThreadCount < 0) {
            downloader.activeThreadCount = 0; // выравнивание при сбоях
        }
        if (downloader.activeThreadCount >= storage.current.downloadThreadCount) {
            return; // достигнуто максимальное количество потоков загрузки
        }
        let entity = getWaitingEntity();
        if (!entity) { // в очереди нет загрузок
            return;
        }
        entity.status = downloader.STATUS.LOADING;
        downloader.activeThreadCount++;
        let coverArrayBuffer;
        let trackAlbum;
        let trackUrl;

        let onInterruptEntity = (error, details) => {
            entity.attemptCount++;
            entity.loadedBytes = 0;
            if (entity.attemptCount < 3) {
                setTimeout(() => {
                    entity.status = downloader.STATUS.WAITING;
                    downloader.download();
                }, 10000);
            } else {
                entity.status = downloader.STATUS.INTERRUPTED;
                utils.logError(error, details);
            }
            downloader.activeThreadCount--;
            downloader.download();
        };

        let onProgress = event => {
            entity.loadedBytes = event.loaded;
        };

        let onChromeDownloadStart = downloadId => {
            if (chrome.runtime.lastError) {
                let details;
                if (entity.type === downloader.TYPE.TRACK) {
                    details = entity.track.id;
                } else if (entity.type === downloader.TYPE.COVER) {
                    details = entity.url;
                }
                onInterruptEntity(chrome.runtime.lastError.message, details);
            } else {
                entity.browserDownloadId = downloadId;
            }
        };

        let getTrackPositionInAlbum = () => {
            for (let i = 0; i < trackAlbum.volumes.length; i++) {
                for (let j = 0; j < trackAlbum.volumes[i].length; j++) {
                    if (entity.track.id === trackAlbum.volumes[i][j].id) {
                        return {
                            track: j + 1,
                            album: i + 1,
                            albumCount: trackAlbum.volumes.length
                        };
                    }
                }
            }
            return undefined;
        };

        let saveTrack = trackArrayBuffer => {
            entity.xhr = null;
            let artists = utils.parseArtists(entity.track.artists, '/');
            let frames = {
                TIT2: entity.title, // Название
                TPE1: artists.artists, // Исполнители
                TALB: trackAlbum.title, // Альбом
                TLEN: entity.track.durationMs // Продолжительность
            };
            if (trackAlbum.year) {
                frames.TYER = trackAlbum.year; // Год
            }
            if (artists.composers) {
                frames.TCOM = artists.composers; // Композиторы
            }
            let trackPostition = getTrackPositionInAlbum();
            if (trackPostition) {
                frames.TRCK = trackPostition.track; // Номер в альбоме
                if (trackPostition.albumCount > 1) {
                    frames.TPOS = trackPostition.album; // Номер диска
                }
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
                saveAs: false
            }, onChromeDownloadStart);
        };

        let onInterruptEntityExcept404 = (error, details) => {
            if (error === 'Not found (404)') { // обложки с выбранном размером нет - игнорируем её
                if (entity.type === downloader.TYPE.TRACK) { // продолжаем загрузку трека без обложки
                    entity.xhr = utils.ajax(trackUrl, 'arraybuffer', saveTrack, onInterruptEntity, onProgress);
                }
            } else {
                onInterruptEntity(error, details);
            }
        };

        let handleCover = arrayBuffer => {
            coverArrayBuffer = arrayBuffer;
            entity.xhr = utils.ajax(trackUrl, 'arraybuffer', saveTrack, onInterruptEntity, onProgress);
        };

        let handleAlbum = album => {
            trackAlbum = album;
            if (album.coverUri) {
                let coverUrl = 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSizeId3);
                utils.ajax(coverUrl, 'arraybuffer', handleCover, onInterruptEntityExcept404);
            } else {
                // пример альбома без обложки: https://music.yandex.ru/album/2236232/track/23652415
                entity.xhr = utils.ajax(trackUrl, 'arraybuffer', saveTrack, onInterruptEntity, onProgress);
            }
        };

        let handleTrackUrl = url => {
            trackUrl = url;
            // альбом нужен для вычисления номера трека
            yandex.getAlbum(entity.track.albums[0].id, handleAlbum, onInterruptEntity);
        };

        let saveCover = coverArrayBuffer => {
            entity.xhr = null;
            let blob = new Blob([coverArrayBuffer], {type: 'image/jpeg'});
            let localUrl = window.URL.createObjectURL(blob);
            chrome.downloads.download({
                url: localUrl,
                filename: entity.filename,
                saveAs: false
            }, onChromeDownloadStart);
        };

        if (entity.type === downloader.TYPE.TRACK) {
            yandex.getTrackUrl(entity.track.id, handleTrackUrl, onInterruptEntity);
        } else if (entity.type === downloader.TYPE.COVER) {
            entity.xhr = utils.ajax(entity.url, 'arraybuffer', saveCover, onInterruptEntityExcept404, onProgress);
        }
    };

    downloader.downloadTrack = trackId => {
        ga('send', 'event', 'track', trackId);
        yandex.getTrack(trackId, track => {
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

            if (track.error) {
                utils.logError('Ошибка трека: ' + track.error, track.id);
                return;
            }

            downloader.downloads.push(entity);
            downloader.download();
        }, utils.logError);
    };

    downloader.downloadAlbum = (albumId, artistOrLabelName) => {
        ga('send', 'event', 'album', albumId);
        yandex.getAlbum(albumId, album => {
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
            // пример длинного названия: https://music.yandex.ua/album/512639
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
                    status: downloader.STATUS.WAITING,
                    url: 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSize),
                    filename: saveDir + '/cover.jpg',
                    loadedBytes: 0,
                    attemptCount: 0
                };
            }

            album.volumes.forEach((volume, i) => {
                volume.forEach((track, j) => {
                    if (track.error) {
                        utils.logError('Ошибка трека: ' + track.error, track.id);
                        return;
                    }

                    albumEntity.size += track.fileSize;
                    albumEntity.duration += track.durationMs;
                    let trackEntity = {
                        type: downloader.TYPE.TRACK,
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
                    if (album.volumes.length > 1) {
                        // пример: https://music.yandex.ru/album/2490723
                        savePath += 'CD' + (i + 1) + '/';
                    }

                    if (storage.current.enumerateAlbums) {
                        savePath += utils.addExtraZeros(j + 1, volume.length) + '. ';
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
        }, utils.logError);
    };

    downloader.downloadPlaylist = (username, playlistId) => {
        ga('send', 'event', 'playlist', username, playlistId);
        yandex.getPlaylist(username, playlistId, playlist => {
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

            playlist.tracks.forEach((track, i) => {
                if (track.error) {
                    utils.logError('Ошибка трека: ' + track.error, track.id);
                    return;
                }
                playlistEntity.size += track.fileSize;
                playlistEntity.duration += track.durationMs;
                let trackEntity = {
                    type: downloader.TYPE.TRACK,
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
                if (storage.current.enumeratePlaylists) {
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
        }, utils.logError);
    };

})();
