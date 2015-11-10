/* global chrome */

(()=> {
    'use strict';

    let $ = document.getElementById.bind(document);
    let backgroundPage, updateIntervalId;

    window.onerror = (message, file, line, col, error) => backgroundPage.onerror(message, file, line, col, error);

    let generateListView = entity => {
        let loadedTrackSize = 0;
        let loadedTrackCount = 0;
        let totalTrackSize = entity.size;
        let totalTrackCount = entity.tracks.length;
        let totalStatus = {
            waiting: 0,
            loading: 0,
            finished: 0,
            interrupted: 0
        };
        for (let i = 0; i < totalTrackCount; i++) {
            loadedTrackSize += entity.tracks[i].loadedBytes;
            totalStatus[entity.tracks[i].status]++;
            if (entity.tracks[i].status === backgroundPage.downloader.STATUS.FINISHED) {
                loadedTrackCount++;
            }
        }
        let name = '';
        if (entity.type === backgroundPage.downloader.TYPE.ALBUM) {
            name = 'Альбом <strong>' + entity.artists + ' - ' + entity.title + '</strong>';
        } else if (entity.type === backgroundPage.downloader.TYPE.PLAYLIST) {
            name = 'Плейлист <strong>' + entity.title + '</strong>';
        }

        let status = '';
        let loadedTrackSizeStr = backgroundPage.utils.bytesToStr(loadedTrackSize);
        let totalTrackSizeStr = backgroundPage.utils.bytesToStr(totalTrackSize);
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

        let loadedSizePercent = Math.floor(loadedTrackSize / totalTrackSize * 100);
        let view = '<div class="panel panel-default">';
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
    };

    let generateTrackView = entity => {
        let loadedSize = backgroundPage.utils.bytesToStr(entity.loadedBytes);
        let totalSize = backgroundPage.utils.bytesToStr(entity.track.fileSize);
        let status = '';
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

        let view = '<div class="panel panel-default">';
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
    };

    let updateDownloader = () => {
        let downloads = backgroundPage.downloader.downloads;
        let downloadsLength = downloads.reduce(count => ++count, 0); // отбрасываются загрузки, которые удалили
        let content = '';
        if (!downloadsLength) {
            content += 'Загрузок нет.<br><br>';
            content += 'Для добавления перейдите на страницу трека, альбома, плейлиста или исполнителя на сервисе Яндекс.Музыка';
        }
        for (let i = 0; i < downloads.length; i++) {
            let entity = downloads[i];
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
    };

    let startUpdater = () => {
        if (updateIntervalId) {
            return; // уже запущено обновление загрузчика
        }
        updateDownloader();
        updateIntervalId = setInterval(updateDownloader, 250);
    };

    $('addBtn').addEventListener('click', () => {
        $('downloadBtn').classList.remove('active');
        $('addBtn').classList.add('active');
        $('addContainer').classList.remove('hide');
        $('downloadContainer').classList.add('hide');
    });

    $('downloadBtn').addEventListener('click', () => {
        $('addBtn').classList.remove('active');
        $('downloadBtn').classList.add('active');
        $('addContainer').classList.add('hide');
        $('downloadContainer').classList.remove('hide');
        $('errorContainer').classList.add('hide');
        startUpdater();
    });

    $('downloadFolderBtn').addEventListener('click', () => chrome.downloads.showDefaultFolder());
    $('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

    $('downloadContainer').addEventListener('mousedown', e => {
        let isRemoveBtnClick = e.target.classList.contains('remove-btn');
        let isRestoreBtnClick = e.target.classList.contains('restore-btn');
        let downloadId = e.target.getAttribute('data-id');
        let entity = backgroundPage.downloader.downloads[downloadId];

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
                    for (let i = 0; i < entity.tracks.length; i++) {
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
                    for (let i = 0; i < entity.tracks.length; i++) {
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

    $('startDownloadBtn').addEventListener('click', () => {
        $('downloadBtn').click();
        $('addBtn').classList.add('disabled');
        let downloadType = $('startDownloadBtn').getAttribute('data-type');
        switch (downloadType) {
            case 'track':
                let trackId = $('startDownloadBtn').getAttribute('data-trackId');
                backgroundPage.downloader.downloadTrack(trackId);
                break;
            case 'album':
                let albumId = $('startDownloadBtn').getAttribute('data-albumId');
                backgroundPage.downloader.downloadAlbum(albumId);
                break;
            case 'playlist':
                let username = $('startDownloadBtn').getAttribute('data-username');
                let playlistId = $('startDownloadBtn').getAttribute('data-playlistId');
                backgroundPage.downloader.downloadPlaylist(username, playlistId);
                break;
            case 'artistOrLabel':
                let name = $('startDownloadBtn').getAttribute('data-name');
                let albumElems = document.getElementsByClassName('album');
                let compilationElems = document.getElementsByClassName('compilation');
                let allElems = [].slice.call(albumElems).concat([].slice.call(compilationElems));

                for (let i = 0; i < allElems.length; i++) {
                    if (allElems[i].checked) {
                        backgroundPage.downloader.downloadAlbum(allElems[i].value, name);
                    }
                }
                break;
        }
        startUpdater();
    });

    let hidePreloader = () => {
        $('preloader').classList.add('hide');
        $('addContainer').classList.remove('hide');
        $('downloadBtn').classList.remove('disabled');
    };

    let generateDownloadArtist = artist => {
        let albumContent = '';
        let compilationContent = '';
        if (artist.albums.length) {
            albumContent += '<label><input type="checkbox" id="albumCheckbox" checked><b>Альбомы (';
            albumContent += artist.albums.length + ')</b></label><br>';
        }
        for (let i = 0; i < artist.albums.length; i++) {
            let title = artist.albums[i].title;
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
        for (let i = 0; i < artist.alsoAlbums.length; i++) {
            let title = artist.alsoAlbums[i].title;
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
            $('albumCheckbox').addEventListener('click', () => {
                let toggle = $('albumCheckbox');
                let albums = document.getElementsByClassName('album');
                for (let i = 0; i < albums.length; i++) {
                    albums[i].checked = toggle.checked;
                }
            });
        }
        if (artist.alsoAlbums.length) {
            $('compilationCheckbox').addEventListener('click', () => {
                let toggle = $('compilationCheckbox');
                let compilations = document.getElementsByClassName('compilation');
                for (let i = 0; i < compilations.length; i++) {
                    compilations[i].checked = toggle.checked;
                }
            });
        }
        $('addContainer').style.fontSize = '12px';
    };

    let generateDownloadLabel = label => {
        let albumContent = '';
        if (label.albums.length) {
            albumContent += '<label><input type="checkbox" id="albumCheckbox"><b>Альбомы (';
            albumContent += label.albums.length + ')</b></label><br>';
        }
        for (let i = 0; i < label.albums.length; i++) {
            let title = label.albums[i].title;
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
            $('albumCheckbox').addEventListener('click', () => {
                let toggle = $('albumCheckbox');
                let albums = document.getElementsByClassName('album');
                for (let i = 0; i < albums.length; i++) {
                    albums[i].checked = toggle.checked;
                }
            });
        }
        $('addContainer').style.fontSize = '12px';
    };

    let generateDownloadTrack = track => {
        let artists = backgroundPage.utils.parseArtists(track.artists, ', ').artists;
        let size = backgroundPage.utils.bytesToStr(track.fileSize);
        let duration = backgroundPage.utils.durationToStr(track.durationMs);
        $('name').innerHTML = artists + ' - ' + track.title;
        $('info').innerHTML = 'Трек / ' + size + ' / ' + duration;
    };

    let generateDownloadAlbum = album => {
        let artists = backgroundPage.utils.parseArtists(album.artists, ', ').artists;
        $('name').innerHTML = artists + ' - ' + album.title;
        if (!album.trackCount) {
            $('info').innerHTML = 'Пустой альбом';
            $('startDownloadBtn').style.display = 'none';
            backgroundPage.utils.logError('Пустой альбом', album.id);
            return;
        }

        let size = 0;
        let duration = 0;
        for (let i = 0; i < album.volumes.length; i++) {
            for (let j = 0; j < album.volumes[i].length; j++) {
                let track = album.volumes[i][j];
                if (!track.error) {
                    size += track.fileSize;
                    duration += track.durationMs;
                }
            }
        }
        size = backgroundPage.utils.bytesToStr(size);
        duration = backgroundPage.utils.durationToStr(duration);
        $('info').innerHTML = 'Альбом (' + album.trackCount + ') / ' + size + ' / ' + duration;
    };

    let generateDownloadPlaylist = playlist => {
        $('name').innerHTML = playlist.title;
        if (!playlist.trackCount) {
            $('info').innerHTML = 'Пустой плейлист';
            $('startDownloadBtn').style.display = 'none';
            backgroundPage.utils.logError('Пустой плейлист', playlist.owner.login + '#' + playlist.kind);
            return;
        }

        let size = 0;
        let duration = 0;
        for (let i = 0; i < playlist.tracks.length; i++) {
            let track = playlist.tracks[i];
            if (!track.error) {
                size += track.fileSize;
                duration += track.durationMs;
            }
        }
        size = backgroundPage.utils.bytesToStr(size);
        duration = backgroundPage.utils.durationToStr(duration);
        $('info').innerHTML = 'Плейлист (' + playlist.trackCount + ') / ' + size + ' / ' + duration;
    };

    let onAjaxFail = (error, details) => {
        backgroundPage.utils.logError(error, details);
        hidePreloader();
        $('addContainer').classList.add('hide');
        $('addBtn').classList.add('disabled');
        $('errorContainer').classList.remove('hide');
    };

    let adaptToSmallDeviceHeight = tabHeight => {
        if (tabHeight <= 600) {
            document.getElementsByTagName('body')[0].style.paddingBottom = '75px';
        }
    };

    chrome.runtime.getBackgroundPage(bp => {
        backgroundPage = bp;
        bp.utils.getActiveTab(activeTab => {
            if (!activeTab) {
                return;
            }
            adaptToSmallDeviceHeight(activeTab.height);
            let page = bp.utils.getUrlInfo(activeTab.url);
            let downloadBtn = $('startDownloadBtn');
            if (page.isPlaylist) {
                downloadBtn.setAttribute('data-type', 'playlist');
                downloadBtn.setAttribute('data-username', page.username);
                downloadBtn.setAttribute('data-playlistId', page.playlistId);
                if (bp.storage.current.singleClickDownload) {
                    hidePreloader();
                    downloadBtn.click();
                    return;
                }
                bp.yandex.getPlaylist(page.username, page.playlistId, playlist => {
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
                bp.yandex.getTrack(page.trackId, track => {
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
                bp.yandex.getAlbum(page.albumId, album => {
                    hidePreloader();
                    generateDownloadAlbum(album);
                }, onAjaxFail);
            } else if (page.isArtist) {
                downloadBtn.setAttribute('data-type', 'artistOrLabel');
                bp.yandex.getArtist(page.artistId, artist => {
                    hidePreloader();
                    generateDownloadArtist(artist);
                    downloadBtn.setAttribute('data-name', artist.artist.name);
                }, onAjaxFail);
            } else if (page.isLabel) {
                downloadBtn.setAttribute('data-type', 'artistOrLabel');
                bp.yandex.getLabel(page.labelId, label => {
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

})();
