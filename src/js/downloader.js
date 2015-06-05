/* global storage, yandex, chrome, logger, utils */
'use strict';

var downloader = {
    queue: [],
    downloads: [],
    notifications: [],
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
    if (!entity) {
        return;
    }
    switch (entity.type) {
        case 'track':
        case 'album_track':
        case 'playlist_track':
            downloader.activeThreadCount++;
            var track = entity.cargo;
            var trackNameMask = storage.current.trackNameMask;
            var artists = track.artists.map(function (artist) {
                return artist.name;
            }).join(', ');
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

                jBinary.load(url, null, function (err, binary) {
                    var newBinary = new jBinary(binary.view.byteLength + 128);
                    newBinary.write('binary', binary);
                    newBinary.write(['string', 3], 'TAG');
                    newBinary.write(['string0', 30, 'utf8'], 'Русский, ёпта'); // title
                    newBinary.write(['string0', 30, 'utf8'], 'Рвач хач'); // artist
                    newBinary.write(['string0', 30, 'utf8'], 'Пендосия'); // album
                    newBinary.write(['string', 4], '1998'); //year
                    newBinary.write(['string0', 28, 'utf8'], 'Офигенски!'); // comment
                    newBinary.write('uint8', 0); // zero_byte
                    newBinary.write('uint8', 68); // track
                    newBinary.write('uint8', 3); // genre (Dance)
                    newBinary.saveAs('test.mp3');
                });

                return;

                chrome.downloads.download({
                    url: url,
                    filename: savePath,
                    saveAs: false
                }, function (downloadId) {
                    downloader.downloads[downloadId] = entity;
                });
            }, function (error) {
                var nId = entity.options.notificationId;
                downloader.notifications[nId].interruptedTracks.push(entity);
                var notificationData = downloader.notifications[nId];
                switch (entity.type) {
                    case 'track':
                        chrome.notifications.update(nId, {
                            title: 'Загрузка прервана',
                            buttons: [{
                                    title: 'Отменить загрузку',
                                    iconUrl: 'img/cancel.png'
                                }, {
                                    title: 'Повторить загрузку',
                                    iconUrl: 'img/resume.png'
                                }]
                        }, function (wasUpdated) {
                        });
                        break;
                    case 'album_track':
                    case 'playlist_track':
                        chrome.notifications.update(nId, {
                            buttons: [{
                                    title: 'Отменить загрузку',
                                    iconUrl: 'img/cancel.png'
                                }, {
                                    title: 'Повторить загрузку',
                                    iconUrl: 'img/resume.png'
                                }]
                        }, function (wasUpdated) {
                        });
                        var interruptedCount = notificationData.interruptedTracks.length;
                        if (notificationData.trackCount + interruptedCount === notificationData.totalTrackCount) {
                            chrome.notifications.update(nId, {
                                title: 'Загрузка частично прервана (загружено ' + notificationData.trackCount + ' из ' + notificationData.totalTrackCount + ')'
                            }, function (wasUpdated) {
                            });
                        }
                        break;
                }
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
        default:
            logger.addMessage('Неизвестный тип загрузки: ' + entity.type);
    }
};

downloader.add = function (type, cargo, options) {
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

downloader.downloadTrack = function (track) {
    var notificationId = 'track#' + track.id;
    var artists = track.artists.map(function (artist) {
        return artist.name;
    }).join(', ');
    var iconUrl = 'img/icon.png';

    downloader.add('track', track, {
        notificationId: notificationId
    });

    if (track.albums[0].coverUri) {
        iconUrl = 'https://' + track.albums[0].coverUri.replace('%%', '100x100');
    }
    chrome.notifications.create(notificationId, {
        type: 'progress',
        iconUrl: iconUrl,
        title: 'Загрузка...',
        message: artists + ' - ' + track.title,
        contextMessage: 'Трек (' + utils.bytesToStr(track.fileSize) + ' - ' + utils.durationToStr(track.durationMs) + ')',
        progress: 0,
        buttons: [{
                title: 'Отменить загрузку',
                iconUrl: 'img/cancel.png'
            }]
    }, function (notificationId) {
        downloader.notifications[notificationId] = {
            interruptedTracks: []
        };
    });
};

downloader.downloadAlbum = function (album, discographyArtist) {
    if (!album.volumes.length) {
        logger.addMessage('Пустой альбом. album.id:' + album.id);
        return;
    }
    var notificationId = 'album#' + album.id;
    var artists = album.artists.map(function (artist) {
        return artist.name;
    }).join(', ');
    if (album.version) {
        album.title += ' (' + album.version + ')';
    }
    var saveDir = downloader.clearPath(artists + ' - ' + album.title);
    if (discographyArtist) {
        saveDir = downloader.clearPath(discographyArtist) + '/' + saveDir;
    }
    var totalSize = 0;
    var totalDuration = 0;
    var totalTrackCount = album.trackCount;
    var iconUrl = 'img/icon.png';

    if (storage.current.shouldDownloadCover && album.coverUri) {
        iconUrl = 'https://' + album.coverUri.replace('%%', '100x100');
        downloader.add('cover', {
            url: 'https://' + album.coverUri.replace('%%', storage.current.albumCoverSize),
            filename: saveDir + '/cover.jpg'
        }, {
            notificationId: notificationId
        });
    }

    var i;
    var track;
    if (album.volumes.length > 1) {
        for (i = 0; i < album.volumes.length; i++) {
            for (var j = 0; j < album.volumes[i].length; j++) {
                track = album.volumes[i][j];
                if (track.error) {
                    totalTrackCount--;
                    logger.addMessage('Ошибка: ' + track.error + '. trackId: ' + track.id);
                    continue;
                }
                totalSize += track.fileSize;
                totalDuration += track.durationMs;
                downloader.add('album_track', track, {
                    saveDir: saveDir + '/CD' + (i + 1),
                    namePrefix: downloader.getPrefix(j + 1, album.volumes[i].length),
                    notificationId: notificationId
                });
            }
        }
    } else {
        for (i = 0; i < album.volumes[0].length; i++) {
            track = album.volumes[0][i];
            if (track.error) {
                totalTrackCount--;
                logger.addMessage('Ошибка: ' + track.error + '. trackId: ' + track.id);
                continue;
            }
            totalSize += track.fileSize;
            totalDuration += track.durationMs;
            downloader.add('album_track', track, {
                saveDir: saveDir,
                namePrefix: downloader.getPrefix(i + 1, album.volumes[0].length),
                notificationId: notificationId
            });
        }
    }

    chrome.notifications.create(notificationId, {
        type: 'progress',
        iconUrl: iconUrl,
        title: 'Загрузка (0 из ' + totalTrackCount + ')...',
        message: artists + ' - ' + album.title,
        contextMessage: 'Альбом (' + utils.bytesToStr(totalSize) + ' - ' + utils.durationToStr(totalDuration) + ')',
        progress: 0,
        buttons: [{
                title: 'Отменить загрузку',
                iconUrl: 'img/cancel.png'
            }]
    }, function (notificationId) {
        downloader.notifications[notificationId] = {
            trackCount: 0,
            totalTrackCount: totalTrackCount,
            interruptedTracks: [],
            saveDir: saveDir
        };
    });
};

downloader.downloadPlaylist = function (playlist) {
    if (!playlist.tracks.length) {
        var message = 'Пустой плейлист. playlist.owner.login: ';
        message += playlist.owner.login + ', playlist.kind: ' + playlist.kind;
        logger.addMessage(message);
        return;
    }
    var notificationId = 'playlist#' + playlist.owner.login + '#' + playlist.kind;
    var saveDir = downloader.clearPath(playlist.title);
    var totalSize = 0;
    var totalDuration = 0;
    var totalTrackCount = playlist.tracks.length;

    for (var i = 0; i < playlist.tracks.length; i++) {
        var track = playlist.tracks[i];
        if (track.error) {
            totalTrackCount--;
            logger.addMessage('Ошибка: ' + track.error + '. trackId: ' + track.id);
            continue;
        }
        totalSize += track.fileSize;
        totalDuration += track.durationMs;
        downloader.add('playlist_track', track, {
            saveDir: saveDir,
            namePrefix: downloader.getPrefix(i + 1, playlist.tracks.length),
            notificationId: notificationId
        });
    }

    var iconUrl = 'img/icon.png';
    if (playlist.cover) {
        switch (playlist.cover.type) {
            case 'pic':
                iconUrl = 'https://' + playlist.cover.uri.replace('%%', '100x100');
                break;
            case 'mosaic':
                iconUrl = 'https://' + playlist.cover.itemsUri[0].replace('%%', '100x100');
                break;
            default:
                logger.addMessage('Неизвестный тип обложки: ' + playlist.cover.type);
        }
    }

    chrome.notifications.create(notificationId, {
        type: 'progress',
        iconUrl: iconUrl,
        title: 'Загрузка (0 из ' + totalTrackCount + ')...',
        message: playlist.title,
        contextMessage: 'Плейлист (' + utils.bytesToStr(totalSize) + ' - ' + utils.durationToStr(totalDuration) + ')',
        progress: 0,
        buttons: [{
                title: 'Отменить загрузку',
                iconUrl: 'img/cancel.png'
            }]
    }, function (notificationId) {
        downloader.notifications[notificationId] = {
            trackCount: 0,
            totalTrackCount: totalTrackCount,
            interruptedTracks: [],
            saveDir: saveDir
        };
    });
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
    if (entity.type === 'opener') {
        if (delta.state.current === 'complete') {
            chrome.downloads.show(delta.id);
            chrome.downloads.removeFile(delta.id);
            chrome.downloads.erase({
                id: delta.id
            });
            delete(downloader.downloads[delta.id]);
        }
        return;
    }
    var nId = entity.options.notificationId;
    var notificationData = downloader.notifications[nId];
    switch (entity.type) {
        case 'track':
            if (delta.state.current === 'complete') {
                chrome.notifications.update(nId, {
                    title: 'Загрузка завершена',
                    progress: 100,
                    buttons: []
                }, function (wasUpdated) {
                });
            } else if (delta.state.current === 'interrupted') {
                downloader.notifications[nId].interruptedTracks.push(downloader.downloads[delta.id]);
                chrome.notifications.update(nId, {
                    title: 'Загрузка прервана',
                    buttons: [{
                            title: 'Отменить загрузку',
                            iconUrl: 'img/cancel.png'
                        }, {
                            title: 'Повторить загрузку',
                            iconUrl: 'img/resume.png'
                        }]
                }, function (wasUpdated) {
                });
            }
            break;
        case 'album_track':
        case 'playlist_track':
            if (delta.state.current === 'complete') {
                downloader.notifications[nId].trackCount++;
                if (notificationData.trackCount === notificationData.totalTrackCount) {
                    chrome.notifications.update(nId, {
                        title: 'Загрузка завершена',
                        progress: 100,
                        buttons: []
                    }, function (wasUpdated) {
                    });
                } else {
                    var progress = Math.round(notificationData.trackCount / notificationData.totalTrackCount * 100);
                    chrome.notifications.update(nId, {
                        title: 'Загрузка (' + notificationData.trackCount + ' из ' + notificationData.totalTrackCount + ')...',
                        progress: progress
                    }, function (wasUpdated) {
                    });
                }
            } else if (delta.state.current === 'interrupted') {
                downloader.notifications[nId].interruptedTracks.push(downloader.downloads[delta.id]);
                chrome.notifications.update(nId, {
                    buttons: [{
                            title: 'Отменить загрузку',
                            iconUrl: 'img/cancel.png'
                        }, {
                            title: 'Повторить загрузку',
                            iconUrl: 'img/resume.png'
                        }]
                }, function (wasUpdated) {
                });
            }
            var interruptedCount = notificationData.interruptedTracks.length;
            if (interruptedCount && notificationData.trackCount + interruptedCount === notificationData.totalTrackCount) {
                chrome.notifications.update(nId, {
                    title: 'Загрузка прервана (загружено ' + notificationData.trackCount + ' из ' + notificationData.totalTrackCount + ')'
                }, function (wasUpdated) {
                });
            }
            break;
        case 'cover':
            break;
    }
    downloader.activeThreadCount--;
    delete(downloader.downloads[delta.id]);
    chrome.downloads.erase({
        id: delta.id
    });
    downloader.download();
};
