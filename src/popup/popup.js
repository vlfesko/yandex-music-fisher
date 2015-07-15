/* global chrome */

'use strict';

var backgroundPage, updateIntervalId;

document.getElementById('addBtn').addEventListener('click', function () {
    document.getElementById('downloadBtn').classList.remove('active');
    this.classList.add('active');
    document.getElementById('addContainer').classList.remove('hide');
    document.getElementById('downloadContainer').classList.add('hide');
});

document.getElementById('downloadBtn').addEventListener('click', function () {
    document.getElementById('addBtn').classList.remove('active');
    this.classList.add('active');
    document.getElementById('addContainer').classList.add('hide');
    document.getElementById('downloadContainer').classList.remove('hide');
    document.getElementById('errorContainer').classList.add('hide');
    startUpdater();
});

document.getElementById('downloadFolderBtn').addEventListener('click', function () {
    chrome.downloads.showDefaultFolder();
});

document.getElementById('settingsBtn').addEventListener('click', function () {
    chrome.tabs.create({
        url: '/options/options.html'
    });
});

document.getElementById('downloadContainer').addEventListener('mousedown', function (e) {
    var isRemoveBtnClick = e.target.classList.contains('remove-btn');
    var isRestoreBtnClick = e.target.classList.contains('restore-btn');
    var downloadId = e.target.getAttribute('data-id');
    var entity = backgroundPage.downloader.downloads[downloadId];
    var i;

    if (isRemoveBtnClick) {
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

            entity.cover.status = backgroundPage.downloader.STATUS.WAITING;
            backgroundPage.downloader.download();
        }
        switch (entity.type) {
            case backgroundPage.downloader.TYPE.TRACK:
                entity.status = backgroundPage.downloader.STATUS.WAITING;
                backgroundPage.downloader.download();
                break;
            case backgroundPage.downloader.TYPE.ALBUM:
            case backgroundPage.downloader.TYPE.PLAYLIST:
                for (i = 0; i < entity.tracks.length; i++) {
                    if (entity.tracks[i].status === backgroundPage.downloader.STATUS.INTERRUPTED) {
                        entity.tracks[i].status = backgroundPage.downloader.STATUS.WAITING;
                        backgroundPage.downloader.download();
                    }
                }
                break;
        }
    }
});

document.getElementById('startDownloadBtn').addEventListener('click', function () {
    document.getElementById('downloadBtn').click();
    document.getElementById('addBtn').classList.add('disabled');
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
        case 'artist':
            var artistName = this.getAttribute('data-artistName');
            var albumElems = document.getElementsByClassName('album');
            var compilationElems = document.getElementsByClassName('compilation');
            var allElems = [].slice.call(albumElems).concat([].slice.call(compilationElems));

            for (var i = 0; i < allElems.length; i++) {
                if (allElems[i].checked) {
                    backgroundPage.downloader.downloadAlbum(allElems[i].value, artistName);
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
    document.getElementById('downloadContainer').innerHTML = content;
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
            status = '<span class="text-danger">Ошибка [скачено ' + loadedSize + ' из ' + totalSize + ']</span>&nbsp;';
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
    var totalTrackSize = backgroundPage.utils.bytesToStr(entity.size);
    var totalTrackCount = entity.tracks.length;
    var totalCount = totalTrackCount; // учитывает наличие обложки для альбома
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
    var loadedSizePercent = Math.floor(loadedTrackSize / entity.size * 100);
    loadedTrackSize = backgroundPage.utils.bytesToStr(loadedTrackSize);
    var name = '';
    if (entity.type === backgroundPage.downloader.TYPE.ALBUM) {
        name = 'Альбом <strong>' + entity.artists + ' - ' + entity.title + '</strong>';
        if (entity.cover) {
            totalStatus[entity.cover.status]++;
            totalCount++;
        }
    } else if (entity.type === backgroundPage.downloader.TYPE.PLAYLIST) {
        name = 'Плейлист <strong>' + entity.title + '</strong>';
    }

    var status = '';
    if (totalStatus.loading > 0) {
        status = '<span class="text-primary">Загрузка [' + loadedTrackSize + ' из ' + totalTrackSize + ']</span>';
    } else if (totalStatus.interrupted > 0) {
        status = '<span class="text-danger">Ошибка [скачено ' + loadedTrackSize + ' из ' + totalTrackSize + ']</span>&nbsp;';
        status += '<button type="button" class="btn btn-info btn-xs restore-btn" data-id="' + entity.index + '">';
        status += '<i class="glyphicon glyphicon-repeat restore-btn" data-id="' + entity.index + '"></i></button>';
    } else if (totalStatus.finished === totalCount) {
        status = '<span class="text-success">Сохранён [' + totalTrackSize + ']</span>';
    } else if (totalStatus.waiting > 0) {
        status = '<span class="text-muted">В очереди [' + totalTrackSize + ']</span>';
    }

    var view = '<div class="panel panel-default">';
    view += '<div class="panel-heading">';
    view += name + '<br>';
    view += 'Скачено треков ' + loadedTrackCount + ' из ' + totalTrackCount + ' (' + loadedSizePercent + '%)';
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
    document.getElementById('preloader').classList.add('hide');
    document.getElementById('addContainer').classList.remove('hide');
    document.getElementById('downloadBtn').classList.remove('disabled');
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
    document.getElementById('name').innerHTML = artist.artist.name;
    document.getElementById('info').innerHTML = 'Дискография';
    document.getElementById('albums').innerHTML = albumContent;
    document.getElementById('compilations').innerHTML = compilationContent;

    if (artist.albums.length) {
        document.getElementById('albumCheckbox').addEventListener('click', function () {
            var toggle = document.getElementById('albumCheckbox');
            var albums = document.getElementsByClassName('album');
            for (var i = 0; i < albums.length; i++) {
                albums[i].checked = toggle.checked;
            }
        });
    }
    if (artist.alsoAlbums.length) {
        document.getElementById('compilationCheckbox').addEventListener('click', function () {
            var toggle = document.getElementById('compilationCheckbox');
            var compilations = document.getElementsByClassName('compilation');
            for (var i = 0; i < compilations.length; i++) {
                compilations[i].checked = toggle.checked;
            }
        });
    }
    document.getElementById('addContainer').style.fontSize = '12px';
}

function generateDownloadTrack(track) {
    var artists = backgroundPage.utils.parseArtists(track.artists, ', ').artists;
    var size = backgroundPage.utils.bytesToStr(track.fileSize);
    var duration = backgroundPage.utils.durationToStr(track.durationMs);
    document.getElementById('name').innerHTML = artists + ' - ' + track.title;
    document.getElementById('info').innerHTML = 'Трек / ' + size + ' / ' + duration;
}

function generateDownloadAlbum(album) {
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
    var artists = backgroundPage.utils.parseArtists(album.artists, ', ').artists;
    document.getElementById('name').innerHTML = artists + ' - ' + album.title;
    document.getElementById('info').innerHTML = 'Альбом (' + album.trackCount + ') / ' + size + ' / ' + duration;
}

function generateDownloadPlaylist(playlist) {
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
    document.getElementById('name').innerHTML = playlist.title;
    document.getElementById('info').innerHTML = 'Плейлист (' + playlist.trackCount + ') / ' + size + ' / ' + duration;
}

function generateError() {
    hidePreloader();
    document.getElementById('addContainer').classList.add('hide');
    document.getElementById('addBtn').classList.add('disabled');
    document.getElementById('errorContainer').classList.remove('hide');
}

function adaptToSmallDeviceHeight(tabHeight) {
    if (tabHeight <= 600) {
        document.getElementsByTagName('body')[0].style.paddingBottom = '75px';
    }
}

chrome.tabs.query({
    active: true,
    currentWindow: true
}, function (tabs) {
    var activeTab = tabs[0];
    adaptToSmallDeviceHeight(activeTab.height);
    chrome.runtime.getBackgroundPage(function (bp) {
        backgroundPage = bp;
        var page = bp.utils.getUrlInfo(activeTab.url);
        var downloadBtn = document.getElementById('startDownloadBtn');
        if (page.isPlaylist) {
            bp.yandex.getPlaylist(page.username, page.playlistId, function (playlist) {
                hidePreloader();
                generateDownloadPlaylist(playlist);
                downloadBtn.setAttribute('data-type', 'playlist');
                downloadBtn.setAttribute('data-username', page.username);
                downloadBtn.setAttribute('data-playlistId', page.playlistId);
            }, function (error) {
                bp.console.error(error);
                generateError();
            });
        } else if (page.isTrack) {
            bp.yandex.getTrack(page.trackId, function (track) {
                hidePreloader();
                generateDownloadTrack(track);
                downloadBtn.setAttribute('data-type', 'track');
                downloadBtn.setAttribute('data-trackId', page.trackId);
            }, function (error) {
                bp.console.error(error);
                generateError();
            });
        } else if (page.isAlbum) {
            bp.yandex.getAlbum(page.albumId, function (album) {
                hidePreloader();
                generateDownloadAlbum(album);
                downloadBtn.setAttribute('data-type', 'album');
                downloadBtn.setAttribute('data-albumId', page.albumId);
            }, function (error) {
                bp.console.error(error);
                generateError();
            });
        } else if (page.isArtist) {
            bp.yandex.getArtist(page.artistId, function (artist) {
                hidePreloader();
                generateDownloadArtist(artist);
                downloadBtn.setAttribute('data-type', 'artist');
                downloadBtn.setAttribute('data-artistName', artist.artist.name);
            }, function (error) {
                bp.console.error(error);
                generateError();
            });
        } else {
            hidePreloader();
            document.getElementById('downloadBtn').click();
            document.getElementById('addBtn').classList.add('disabled');
        }
    });
});
