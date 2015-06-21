/* global storage, yandex, chrome, logger, utils */
'use strict';

var downloader = {
    queue: [],
    downloads: [],
    activeThreadCount: 0
};

downloader.clearPath = function (path) {
    var clearedPath = path.replace(/[\\/:*?"<>|]/g, '_'); // Windows path illegals
    clearedPath = clearedPath.replace(/\.$/, '_'); // точка в конце
    return clearedPath;
};

downloader.getPrefix = function (i, max) {
    var prefix = '';
    max = max.toString();
    switch (max.length) {
        case 2:
            prefix = (i < 10) ? '0' + i : i;
            break;
        case 3:
            prefix = (i < 10) ? '00' + i : ((i < 100) ? '0' + i : i);
            break;
        case 4:
            prefix = (i < 10) ? '000' + i : ((i < 100) ? '00' + i : ((i < 1000) ? '0' + i : i));
            break;
        default:
            prefix = i;
    }
    return prefix;
};

downloader.download = function () {
    var entity = downloader.queue.shift();
    if (!entity) { // в очереди нет загрузок
        return;
    }
    switch (entity.type) {
        case 'track':
        case 'album_track':
        case 'playlist_track':
            downloader.activeThreadCount++;
            var track = entity.cargo;
            var trackNameMask = storage.current.trackNameMask;
            var artists = utils.parseArtists(track.artists);
            if (track.version) {
                track.title += ' (' + track.version + ')';
            }
            var savePath = trackNameMask.replace('#НАЗВАНИЕ#', track.title);
            savePath = savePath.replace('#ИСПОЛНИТЕЛИ#', artists);
            if (storage.current.shouldNumberLists && entity.options.namePrefix) {
                savePath = entity.options.namePrefix + ' ' + savePath;
            }
            savePath = downloader.clearPath(savePath) + '.mp3';
            if (entity.options.saveDir) {
                savePath = entity.options.saveDir + '/' + savePath;
            }
            yandex.getTrackUrl(track.storageDir, function (url) {

                utils.ajax(url, 'arraybuffer', function (arrayBuffer) {
                    var frames = {
                        TIT2: track.title, // Title/songname/content description
                        TPE1: artists, // Lead performer(s)/Soloist(s)
                        TALB: track.albums[0].title, // Album/Movie/Show title
                        TYER: track.albums[0].year, // Year
                        TCON: track.albums[0].genre // Content type
                    };
                    if (entity.type === 'album_track') {
                        // todo: ставить не порядковый номер, а из альбома
                        frames.TRCK = entity.options.namePrefix; // Track number/Position in set
                    }
                    var localUrl = utils.addId3Tag(arrayBuffer, frames);

                    chrome.downloads.download({
                        url: localUrl,
                        filename: savePath,
                        saveAs: false
                    }, function (downloadId) {
                        downloader.downloads[downloadId] = entity;
                    });
                }, function (error) {
                    logger.addMessage(error);
                }, function (event) {
                    console.info(event.loaded + ' / ' + event.total);
                });

            }, function (error) {
                logger.addMessage(error);
                downloader.activeThreadCount--;
                downloader.download();
            });
            break;
        case 'cover':
            downloader.activeThreadCount++;
            chrome.downloads.download({
                url: entity.cargo.url,
                filename: entity.cargo.filename,
                saveAs: false
            }, function (downloadId) {
                downloader.downloads[downloadId] = entity;
            });
            break;
    }
};

downloader.add = function (type, cargo, options) {
    if (!options) {
        options = {};
    }
    downloader.queue.push({
        type: type,
        cargo: cargo,
        options: options
    });
    var newThreadCount = storage.current.downloadThreadCount - downloader.activeThreadCount;
    for (var i = 0; i < newThreadCount; i++) {
        downloader.download();
    }
};

downloader.downloadTrack = function (trackId) {
    yandex.getTrack(trackId, function (track) {
        downloader.add('track', track);
    }, logger.addMessage);
};

downloader.downloadAlbum = function (albumId, discographyArtist) {
    yandex.getAlbum(albumId, function (album) {
        if (!album.volumes.length) {
            logger.addMessage('Пустой альбом. album.id:' + album.id);
            return;
        }
        var artists = utils.parseArtists(album.artists);
        if (album.version) {
            album.title += ' (' + album.version + ')';
        }
        var saveDir = downloader.clearPath(artists + ' - ' + album.title);
        if (discographyArtist) {
            saveDir = downloader.clearPath(discographyArtist) + '/' + saveDir;
        }

        if (storage.current.shouldDownloadCover && album.coverUri) {
            downloader.add('cover', {
                url: 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSize),
                filename: saveDir + '/cover.jpg'
            });
        }

        for (var i = 0; i < album.volumes.length; i++) {
            for (var j = 0; j < album.volumes[i].length; j++) {
                var track = album.volumes[i][j];
                if (track.error) { // todo: проверить, если ли сейчас такое поле
                    logger.addMessage('Ошибка: ' + track.error + '. trackId: ' + track.id);
                    continue;
                }
                var options = {
                    saveDir: saveDir,
                    namePrefix: downloader.getPrefix(j + 1, album.volumes[i].length)
                };
                if (album.volumes.length > 1) {
                    // пример: https://music.yandex.ru/album/2490723
                    options.saveDir += '/CD' + (i + 1);
                }
                downloader.add('album_track', track, options);
            }
        }
    }, logger.addMessage);
};

downloader.downloadPlaylist = function (username, playlistId) {
    yandex.getPlaylist(username, playlistId, function (playlist) {
        if (!playlist.tracks.length) {
            var message = 'Пустой плейлист. playlist.owner.login: ';
            message += playlist.owner.login + ', playlist.kind: ' + playlist.kind;
            logger.addMessage(message);
            return;
        }

        for (var i = 0; i < playlist.tracks.length; i++) {
            var track = playlist.tracks[i];
            if (track.error) {
                logger.addMessage('Ошибка: ' + track.error + '. trackId: ' + track.id);
                continue;
            }
            downloader.add('playlist_track', track, {
                saveDir: downloader.clearPath(playlist.title),
                namePrefix: downloader.getPrefix(i + 1, playlist.tracks.length)
            });
        }
    }, logger.addMessage);
};

downloader.onChange = function (delta) {
    var entity = downloader.downloads[delta.id];
    if (!entity || !entity.type) {
        logger.addMessage('Загруженного файла нет в downloader.downloads');
        return;
    }
    if (!delta.state) {
        return;
    }
    downloader.activeThreadCount--;
    delete(downloader.downloads[delta.id]);
    chrome.downloads.erase({
        id: delta.id
    });
    downloader.download();
};
