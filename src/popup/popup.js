/* global chrome */

'use strict';

var $ = document.getElementById.bind(document);
var backgroundPage, updateIntervalId;

$('addBtn').addEventListener('click', function () {
    $('downloadBtn').classList.remove('active');
    $('addBtn').classList.add('active');
    $('addContainer').classList.remove('hide');
    $('downloadContainer').classList.add('hide');
});

$('downloadBtn').addEventListener('click', function () {
    $('addBtn').classList.remove('active');
    $('downloadBtn').classList.add('active');
    $('addContainer').classList.add('hide');
    $('downloadContainer').classList.remove('hide');
    $('errorContainer').classList.add('hide');
    startUpdater();
});

$('downloadFolderBtn').addEventListener('click', function () {
    chrome.downloads.showDefaultFolder();
});

$('settingsBtn').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
});

$('downloadContainer').addEventListener('mousedown', function (e) {
    var isRemoveBtnClick = e.target.classList.contains('remove-btn');
    var isRestoreBtnClick = e.target.classList.contains('restore-btn');
    var downloadId = e.target.getAttribute('data-id');
    var entity = backgroundPage.downloader.downloads[downloadId];
    var i;

    if (isRemoveBtnClick) {
        if (entity.type === backgroundPage.downloader.TYPE.ALBUM &&
            entity.cover && entity.cover.status === backgroundPage.downloader.STATUS.LOADING) {

            if (entity.cover.xhr) {
                entity.cover.xhr.abort();
            }
            backgroundPage.downloader.activeThreadCount--;
        }
        switch (entity.type) {
            case backgroundPage.downloader.TYPE.TRACK:
                if (entity.status === backgroundPage.downloader.STATUS.LOADING) {
                    if (entity.xhr) {
                        entity.xhr.abort();
                    }
                    backgroundPage.downloader.activeThreadCount--;
                }
                break;
            case backgroundPage.downloader.TYPE.ALBUM:
            case backgroundPage.downloader.TYPE.PLAYLIST:
                for (i = 0; i < entity.tracks.length; i++) {
                    if (entity.tracks[i].status === backgroundPage.downloader.STATUS.LOADING) {
                        if (entity.tracks[i].xhr) {
                            entity.tracks[i].xhr.abort();
                        }
                        backgroundPage.downloader.activeThreadCount--;
                    }
                }
                break;
        }
        delete(backgroundPage.downloader.downloads[downloadId]);
        backgroundPage.downloader.runAllThreads();
    } else if (isRestoreBtnClick) {
        if (entity.type === backgroundPage.downloader.TYPE.ALBUM &&
            entity.cover && entity.cover.status === backgroundPage.downloader.STATUS.INTERRUPTED) {

            entity.cover.attemptCount = 0;
            entity.cover.status = backgroundPage.downloader.STATUS.WAITING;
            backgroundPage.downloader.download();
        }
        switch (entity.type) {
            case backgroundPage.downloader.TYPE.TRACK:
                entity.attemptCount = 0;
                entity.status = backgroundPage.downloader.STATUS.WAITING;
                backgroundPage.downloader.download();
                break;
            case backgroundPage.downloader.TYPE.ALBUM:
            case backgroundPage.downloader.TYPE.PLAYLIST:
                for (i = 0; i < entity.tracks.length; i++) {
                    if (entity.tracks[i].status === backgroundPage.downloader.STATUS.INTERRUPTED) {
                        entity.tracks[i].attemptCount = 0;
                        entity.tracks[i].status = backgroundPage.downloader.STATUS.WAITING;
                        backgroundPage.downloader.download();
                    }
                }
                break;
        }
    }
});

$('startDownloadBtn').addEventListener('click', function () {
    $('downloadBtn').click();
    $('addBtn').classList.add('disabled');
    var downloadType = this.getAttribute('data-type');
    switch (downloadType) {
        case 'track':
            var trackId = this.getAttribute('data-trackId');
            backgroundPage.downloader.downloadTrack(trackId);
            break;
        case 'album':
            var albumId = this.getAttribute('data-albumId');
            backgroundPage.downloader.downloadAlbum(albumId);
            break;
        case 'playlist':
            var username = this.getAttribute('data-username');
            var playlistId = this.getAttribute('data-playlistId');
            backgroundPage.downloader.downloadPlaylist(username, playlistId);
            break;
        case 'artistOrLabel':
            var name = this.getAttribute('data-name');
            var albumElems = document.getElementsByClassName('album');
            var compilationElems = document.getElementsByClassName('compilation');
            var allElems = [].slice.call(albumElems).concat([].slice.call(compilationElems));

            for (var i = 0; i < allElems.length; i++) {
                if (allElems[i].checked) {
                    backgroundPage.downloader.downloadAlbum(allElems[i].value, name);
                }
            }
            break;
    }
    startUpdater();
});

function startUpdater() {
    if (updateIntervalId) {
        return; // уже запущено обновление загрузчика
    }
    updateDownloader();
    updateIntervalId = setInterval(updateDownloader, 250);
}

function updateDownloader() {
    var downloads = backgroundPage.downloader.downloads;
    var downloadsLength = downloads.reduce(function (count) {
        return ++count; // отбрасываются загрузки, которые удалили
    }, 0);
    var content = '';
    if (!downloadsLength) {
        content += 'Загрузок нет.<br><br>';
        content += 'Для добавления перейдите на страницу трека, альбома, плейлиста или исполнителя на сервисе Яндекс.Музыка';
    }
    for (var i = 0; i < downloads.length; i++) {
        var entity = downloads[i];
        if (!entity) {
            continue; // эту загрузку удалили
        }
        switch (entity.type) {
            case backgroundPage.downloader.TYPE.TRACK:
                content = generateTrackView(entity) + content;
                break;
            case backgroundPage.downloader.TYPE.ALBUM:
            case backgroundPage.downloader.TYPE.PLAYLIST:
                content = generateListView(entity) + content;
                break;
        }
    }
    $('downloadContainer').innerHTML = content;
}

function generateTrackView(entity) {
    var loadedSize = backgroundPage.utils.bytesToStr(entity.loadedBytes);
    var totalSize = backgroundPage.utils.bytesToStr(entity.track.fileSize);
    var status = '';
    switch (entity.status) {
        case backgroundPage.downloader.STATUS.WAITING:
            status = '<span class="text-muted">В очереди [' + totalSize + ']</span>';
            break;
        case backgroundPage.downloader.STATUS.LOADING:
            status = '<span class="text-primary">Загрузка [' + loadedSize + ' из ' + totalSize + ']</span>';
            break;
        case backgroundPage.downloader.STATUS.FINISHED:
            status = '<span class="text-success">Сохранён [' + totalSize + ']</span>';
            break;
        case backgroundPage.downloader.STATUS.INTERRUPTED:
            status = '<span class="text-danger">Ошибка [скачано ' + loadedSize + ' из ' + totalSize + ']</span>&nbsp;';
            status += '<button type="button" class="btn btn-info btn-xs restore-btn" data-id="' + entity.index + '">';
            status += '<i class="glyphicon glyphicon-repeat restore-btn" data-id="' + entity.index + '"></i></button>';
            break;
    }

    var view = '<div class="panel panel-default">';
    view += '<div class="panel-heading">';
    view += 'Трек <strong>' + entity.artists + ' - ' + entity.title + '</strong>';
    view += '</div>';
    view += '<div class="panel-body">';
    view += status;
    view += '&nbsp;<button type="button" class="btn btn-danger btn-xs remove-btn" data-id="' + entity.index + '">';
    view += '<i class="glyphicon glyphicon-remove remove-btn" data-id="' + entity.index + '"></i></button>';
    view += '</div>';
    view += '</div>';
    return view;
}

function generateListView(entity) {
    var loadedTrackSize = 0;
    var loadedTrackCount = 0;
    var totalTrackSize = entity.size;
    var totalTrackCount = entity.tracks.length;
    var totalStatus = {
        waiting: 0,
        loading: 0,
        finished: 0,
        interrupted: 0
    };
    for (var i = 0; i < totalTrackCount; i++) {
        loadedTrackSize += entity.tracks[i].loadedBytes;
        totalStatus[entity.tracks[i].status]++;
        if (entity.tracks[i].status === backgroundPage.downloader.STATUS.FINISHED) {
            loadedTrackCount++;
        }
    }
    var name = '';
    if (entity.type === backgroundPage.downloader.TYPE.ALBUM) {
        name = 'Альбом <strong>' + entity.artists + ' - ' + entity.title + '</strong>';
    } else if (entity.type === backgroundPage.downloader.TYPE.PLAYLIST) {
        name = 'Плейлист <strong>' + entity.title + '</strong>';
    }

    var status = '';
    var loadedTrackSizeStr = backgroundPage.utils.bytesToStr(loadedTrackSize);
    var totalTrackSizeStr = backgroundPage.utils.bytesToStr(totalTrackSize);
    if (totalStatus.loading > 0) {
        status = '<span class="text-primary">Загрузка [' + loadedTrackSizeStr + ' из ' + totalTrackSizeStr + ']</span>';
    } else if (totalStatus.interrupted > 0) {
        status = '<span class="text-danger">Ошибка [скачано ' + loadedTrackSizeStr + ' из ' + totalTrackSizeStr + ']</span>&nbsp;';
        status += '<button type="button" class="btn btn-info btn-xs restore-btn" data-id="' + entity.index + '">';
        status += '<i class="glyphicon glyphicon-repeat restore-btn" data-id="' + entity.index + '"></i></button>';
    } else if (totalStatus.finished === totalTrackCount) {
        status = '<span class="text-success">Сохранён [' + totalTrackSizeStr + ']</span>';
    } else if (totalStatus.waiting > 0) {
        status = '<span class="text-muted">В очереди [' + totalTrackSizeStr + ']</span>';
    }

    var loadedSizePercent = Math.floor(loadedTrackSize / totalTrackSize * 100);
    var view = '<div class="panel panel-default">';
    view += '<div class="panel-heading">';
    view += name + '<br>';
    view += 'Скачано треков ' + loadedTrackCount + ' из ' + totalTrackCount + ' (' + loadedSizePercent + '%)';
    view += '</div>';
    view += '<div class="panel-body">';
    view += status;
    view += '&nbsp;<button type="button" class="btn btn-danger btn-xs remove-btn" data-id="' + entity.index + '">';
    view += '<i class="glyphicon glyphicon-remove remove-btn" data-id="' + entity.index + '"></i></button>';
    view += '</div>';
    view += '</div>';
    return view;
}

function hidePreloader() {
    $('preloader').classList.add('hide');
    $('addContainer').classList.remove('hide');
    $('downloadBtn').classList.remove('disabled');
}

function generateDownloadArtist(artist) {
    var i;
    var title;
    var albumContent = '';
    var compilationContent = '';
    if (artist.albums.length) {
        albumContent += '<label><input type="checkbox" id="albumCheckbox" checked><b>Альбомы (';
        albumContent += artist.albums.length + ')</b></label><br>';
    }
    for (i = 0; i < artist.albums.length; i++) {
        title = artist.albums[i].title;
        if (artist.albums[i].version) {
            title += ' (' + artist.albums[i].version + ')';
        }
        albumContent += '<label><input type="checkbox" class="album" checked value="';
        albumContent += artist.albums[i].id + '">' + title + '</label><br>';
    }
    if (artist.alsoAlbums.length) {
        compilationContent += '<label><input type="checkbox" id="compilationCheckbox"><b>Сборники (';
        compilationContent += artist.alsoAlbums.length + ')</b></label><br>';
    }
    for (i = 0; i < artist.alsoAlbums.length; i++) {
        title = artist.alsoAlbums[i].title;
        if (artist.alsoAlbums[i].version) {
            title += ' (' + artist.alsoAlbums[i].version + ')';
        }
        compilationContent += '<label><input type="checkbox" class="compilation" value="';
        compilationContent += artist.alsoAlbums[i].id + '">' + title + '</label><br>';
    }
    $('name').innerHTML = artist.artist.name;
    $('info').innerHTML = 'Дискография';
    $('albums').innerHTML = albumContent;
    $('compilations').innerHTML = compilationContent;

    if (artist.albums.length) {
        $('albumCheckbox').addEventListener('click', function () {
            var toggle = $('albumCheckbox');
            var albums = document.getElementsByClassName('album');
            for (var i = 0; i < albums.length; i++) {
                albums[i].checked = toggle.checked;
            }
        });
    }
    if (artist.alsoAlbums.length) {
        $('compilationCheckbox').addEventListener('click', function () {
            var toggle = $('compilationCheckbox');
            var compilations = document.getElementsByClassName('compilation');
            for (var i = 0; i < compilations.length; i++) {
                compilations[i].checked = toggle.checked;
            }
        });
    }
    $('addContainer').style.fontSize = '12px';
}

function generateDownloadLabel(label) {
    var i;
    var title;
    var albumContent = '';
    if (label.albums.length) {
        albumContent += '<label><input type="checkbox" id="albumCheckbox"><b>Альбомы (';
        albumContent += label.albums.length + ')</b></label><br>';
    }
    for (i = 0; i < label.albums.length; i++) {
        title = label.albums[i].title;
        if (label.albums[i].version) {
            title += ' (' + label.albums[i].version + ')';
        }
        albumContent += '<label><input type="checkbox" class="album" value="';
        albumContent += label.albums[i].id + '">' + title + '</label><br>';
    }

    $('name').innerHTML = label.label.name;
    $('info').innerHTML = 'Лейбл';
    $('albums').innerHTML = albumContent;

    if (label.albums.length) {
        $('albumCheckbox').addEventListener('click', function () {
            var toggle = $('albumCheckbox');
            var albums = document.getElementsByClassName('album');
            for (var i = 0; i < albums.length; i++) {
                albums[i].checked = toggle.checked;
            }
        });
    }
    $('addContainer').style.fontSize = '12px';
}

function generateDownloadTrack(track) {
    var artists = backgroundPage.utils.parseArtists(track.artists, ', ').artists;
    var size = backgroundPage.utils.bytesToStr(track.fileSize);
    var duration = backgroundPage.utils.durationToStr(track.durationMs);
    $('name').innerHTML = artists + ' - ' + track.title;
    $('info').innerHTML = 'Трек / ' + size + ' / ' + duration;
}

function generateDownloadAlbum(album) {
    var artists = backgroundPage.utils.parseArtists(album.artists, ', ').artists;
    $('name').innerHTML = artists + ' - ' + album.title;
    if (!album.trackCount) {
        $('info').innerHTML = 'Пустой альбом';
        $('startDownloadBtn').style.display = 'none';
        backgroundPage.utils.logError('Пустой альбом', album.id);
        return;
    }

    var size = 0;
    var duration = 0;
    for (var i = 0; i < album.volumes.length; i++) {
        for (var j = 0; j < album.volumes[i].length; j++) {
            var track = album.volumes[i][j];
            if (!track.error) {
                size += track.fileSize;
                duration += track.durationMs;
            }
        }
    }
    size = backgroundPage.utils.bytesToStr(size);
    duration = backgroundPage.utils.durationToStr(duration);
    $('info').innerHTML = 'Альбом (' + album.trackCount + ') / ' + size + ' / ' + duration;
}

function generateDownloadPlaylist(playlist) {
    $('name').innerHTML = playlist.title;
    if (!playlist.trackCount) {
        $('info').innerHTML = 'Пустой плейлист';
        $('startDownloadBtn').style.display = 'none';
        backgroundPage.utils.logError('Пустой плейлист', playlist.owner.login + '#' + playlist.kind);
        return;
    }

    var size = 0;
    var duration = 0;
    for (var i = 0; i < playlist.tracks.length; i++) {
        var track = playlist.tracks[i];
        if (!track.error) {
            size += track.fileSize;
            duration += track.durationMs;
        }
    }
    size = backgroundPage.utils.bytesToStr(size);
    duration = backgroundPage.utils.durationToStr(duration);
    $('info').innerHTML = 'Плейлист (' + playlist.trackCount + ') / ' + size + ' / ' + duration;
}

function onAjaxFail(error, details) {
    backgroundPage.utils.logError(error, details);
    hidePreloader();
    $('addContainer').classList.add('hide');
    $('addBtn').classList.add('disabled');
    $('errorContainer').classList.remove('hide');
}

function adaptToSmallDeviceHeight(tabHeight) {
    if (tabHeight <= 600) {
        document.getElementsByTagName('body')[0].style.paddingBottom = '75px';
    }
}

window.onerror = function (message, file, line, col, error) {
    backgroundPage.onerror(message, file, line, col, error);
};

chrome.runtime.getBackgroundPage(function (bp) {
    backgroundPage = bp;
    bp.utils.getActiveTab(function (activeTab) {
        if (!activeTab) {
            return;
        }
        adaptToSmallDeviceHeight(activeTab.height);
        var page = bp.utils.getUrlInfo(activeTab.url);
        var downloadBtn = $('startDownloadBtn');
        if (page.isPlaylist) {
            downloadBtn.setAttribute('data-type', 'playlist');
            downloadBtn.setAttribute('data-username', page.username);
            downloadBtn.setAttribute('data-playlistId', page.playlistId);
            if (bp.storage.current.singleClickDownload) {
                hidePreloader();
                downloadBtn.click();
                return;
            }
            bp.yandex.getPlaylist(page.username, page.playlistId, function (playlist) {
                hidePreloader();
                generateDownloadPlaylist(playlist);
            }, onAjaxFail);
        } else if (page.isTrack) {
            downloadBtn.setAttribute('data-type', 'track');
            downloadBtn.setAttribute('data-trackId', page.trackId);
            if (bp.storage.current.singleClickDownload) {
                hidePreloader();
                downloadBtn.click();
                return;
            }
            bp.yandex.getTrack(page.trackId, function (track) {
                hidePreloader();
                generateDownloadTrack(track);
            }, onAjaxFail);
        } else if (page.isAlbum) {
            downloadBtn.setAttribute('data-type', 'album');
            downloadBtn.setAttribute('data-albumId', page.albumId);
            if (bp.storage.current.singleClickDownload) {
                hidePreloader();
                downloadBtn.click();
                return;
            }
            bp.yandex.getAlbum(page.albumId, function (album) {
                hidePreloader();
                generateDownloadAlbum(album);
            }, onAjaxFail);
        } else if (page.isArtist) {
            downloadBtn.setAttribute('data-type', 'artistOrLabel');
            bp.yandex.getArtist(page.artistId, function (artist) {
                hidePreloader();
                generateDownloadArtist(artist);
                downloadBtn.setAttribute('data-name', artist.artist.name);
            }, onAjaxFail);
        } else if (page.isLabel) {
            downloadBtn.setAttribute('data-type', 'artistOrLabel');
            bp.yandex.getLabel(page.labelId, function (label) {
                hidePreloader();
                generateDownloadLabel(label);
                downloadBtn.setAttribute('data-name', label.label.name);
            }, onAjaxFail);
        } else {
            hidePreloader();
            $('downloadBtn').click();
            $('addBtn').classList.add('disabled');
        }
    });
});
