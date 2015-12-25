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
        let isAlbum = entity.type === backgroundPage.downloader.TYPE.ALBUM;
        let isPlaylist = entity.type === backgroundPage.downloader.TYPE.PLAYLIST;

        entity.tracks.forEach(track => {
            loadedTrackSize += track.loadedBytes;
            totalStatus[track.status]++;
            if (track.status === backgroundPage.downloader.STATUS.FINISHED) {
                loadedTrackCount++;
            }
        });

        let isLoading = totalStatus.loading > 0;
        let isInterrupted = !isLoading && totalStatus.interrupted > 0;
        let isFinished = !isInterrupted && totalStatus.finished === totalTrackCount;
        let isWaiting = !isFinished && totalStatus.waiting > 0;

        let name = '';
        if (isAlbum) {
            name = 'Альбом <strong>' + entity.artists + ' - ' + entity.title + '</strong>';
        } else if (isPlaylist) {
            name = 'Плейлист <strong>' + entity.title + '</strong>';
        }

        let status = '';
        let loadedTrackSizeStr = backgroundPage.utils.bytesToStr(loadedTrackSize);
        let totalTrackSizeStr = backgroundPage.utils.bytesToStr(totalTrackSize);
        if (isLoading) {
            status = '<span class="text-primary">Загрузка [' + loadedTrackSizeStr + ' из ' + totalTrackSizeStr + ']</span>';
        } else if (isInterrupted) {
            status = '<span class="text-danger">Ошибка [скачано ' + loadedTrackSizeStr + ' из ' + totalTrackSizeStr + ']</span>&nbsp;';
            status += '<button type="button" class="btn btn-info btn-xs restore-btn" data-id="' + entity.index + '">';
            status += '<i class="glyphicon glyphicon-repeat restore-btn" data-id="' + entity.index + '"></i></button>';
        } else if (isFinished) {
            status = '<span class="text-success">Сохранён [' + totalTrackSizeStr + ']</span>';
        } else if (isWaiting) {
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
        let isWaiting = entity.status === backgroundPage.downloader.STATUS.WAITING;
        let isLoading = entity.status === backgroundPage.downloader.STATUS.LOADING;
        let isFinished = entity.status === backgroundPage.downloader.STATUS.FINISHED;
        let isInterrupted = entity.status === backgroundPage.downloader.STATUS.INTERRUPTED;

        if (isWaiting) {
            status = '<span class="text-muted">В очереди [' + totalSize + ']</span>';
        } else if (isLoading) {
            status = '<span class="text-primary">Загрузка [' + loadedSize + ' из ' + totalSize + ']</span>';
        } else if (isFinished) {
            status = '<span class="text-success">Сохранён [' + totalSize + ']</span>';
        } else if (isInterrupted) {
            status = '<span class="text-danger">Ошибка [скачано ' + loadedSize + ' из ' + totalSize + ']</span>&nbsp;';
            status += '<button type="button" class="btn btn-info btn-xs restore-btn" data-id="' + entity.index + '">';
            status += '<i class="glyphicon glyphicon-repeat restore-btn" data-id="' + entity.index + '"></i></button>';
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
        downloads.forEach(entity => {
            let isAlbum = entity.type === backgroundPage.downloader.TYPE.ALBUM;
            let isPlaylist = entity.type === backgroundPage.downloader.TYPE.PLAYLIST;
            let isTrack = entity.type === backgroundPage.downloader.TYPE.TRACK;

            if (isTrack) {
                content = generateTrackView(entity) + content;
            } else if (isAlbum || isPlaylist) {
                content = generateListView(entity) + content;
            }
        });
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

        if (!isRemoveBtnClick && !isRestoreBtnClick) {
            return;
        }

        let downloadId = e.target.getAttribute('data-id');
        let entity = backgroundPage.downloader.downloads[downloadId];

        let isAlbum = entity.type === backgroundPage.downloader.TYPE.ALBUM;
        let isCover = isAlbum && entity.cover;
        let isPlaylist = entity.type === backgroundPage.downloader.TYPE.PLAYLIST;
        let isTrack = entity.type === backgroundPage.downloader.TYPE.TRACK;

        if (isRemoveBtnClick) {
            if (isCover && entity.cover.status === backgroundPage.downloader.STATUS.LOADING) {
                backgroundPage.downloader.activeThreadCount--;
            }
            if (isTrack) {
                if (entity.status === backgroundPage.downloader.STATUS.LOADING) {
                    backgroundPage.downloader.activeThreadCount--;
                }
            } else if (isAlbum || isPlaylist) {
                entity.tracks.forEach(track => {
                    if (track.status === backgroundPage.downloader.STATUS.LOADING) {
                        backgroundPage.downloader.activeThreadCount--;
                    }
                });
            }
            delete(backgroundPage.downloader.downloads[downloadId]);
            backgroundPage.downloader.runAllThreads();
        } else if (isRestoreBtnClick) {
            if (isCover && entity.cover.status === backgroundPage.downloader.STATUS.INTERRUPTED) {
                entity.cover.attemptCount = 0;
                entity.cover.status = backgroundPage.downloader.STATUS.WAITING;
                backgroundPage.downloader.download();
            }
            if (isTrack) {
                entity.attemptCount = 0;
                entity.status = backgroundPage.downloader.STATUS.WAITING;
                backgroundPage.downloader.download();
            } else if (isAlbum || isPlaylist) {
                entity.tracks.forEach(track => {
                    if (track.status === backgroundPage.downloader.STATUS.INTERRUPTED) {
                        track.attemptCount = 0;
                        track.status = backgroundPage.downloader.STATUS.WAITING;
                        backgroundPage.downloader.download();
                    }
                });
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

                allElems.forEach(albumElem => {
                    if (albumElem.checked) {
                        backgroundPage.downloader.downloadAlbum(albumElem.value, name);
                    }
                });
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

        let sortedAlbums = artist.albums.sort((a, b) => b.year - a.year);
        if (sortedAlbums.length) {
            albumContent += '<label><input type="checkbox" id="albumCheckbox" checked><b>Альбомы (';
            albumContent += sortedAlbums.length + ')</b></label><br>';
        }
        let year = 0;
        sortedAlbums.forEach(album => {
            if (album.year !== year) {
                year = album.year;
                albumContent += '<br><label class="label-year">' + year + '</label><br>';
            }
            let title = '[' + album.trackCount + '] ' + album.title;
            if (album.version) {
                title += ' (' + album.version + ')';
            }
            albumContent += '<label><input type="checkbox" class="album" checked value="';
            albumContent += album.id + '">' + title + '</label><br>';
        });

        let sortedCompilations = artist.alsoAlbums.sort((a, b) => b.year - a.year);
        if (sortedCompilations.length) {
            compilationContent += '<br><label><input type="checkbox" id="compilationCheckbox"><b>Сборники (';
            compilationContent += sortedCompilations.length + ')</b></label><br>';
        }
        year = 0;
        sortedCompilations.forEach(album => {
            if (album.year !== year) {
                year = album.year;
                compilationContent += '<br><label class="label-year">' + year + '</label><br>';
            }
            let title = '[' + album.trackCount + '] ' + album.title;
            if (album.version) {
                title += ' (' + album.version + ')';
            }
            compilationContent += '<label><input type="checkbox" class="compilation" value="';
            compilationContent += album.id + '">' + title + '</label><br>';
        });
        $('name').innerHTML = artist.artist.name;
        $('info').innerHTML = 'Дискография';
        $('albums').innerHTML = albumContent;
        $('compilations').innerHTML = compilationContent;

        if (sortedAlbums.length) {
            $('albumCheckbox').addEventListener('click', () => {
                let toggle = $('albumCheckbox');
                let albums = document.getElementsByClassName('album');
                for (let i = 0; i < albums.length; i++) {
                    albums[i].checked = toggle.checked;
                }
            });
        }
        if (sortedCompilations.length) {
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
        let sortedAlbums = label.albums.sort((a, b) => b.year - a.year);
        if (sortedAlbums.length) {
            albumContent += '<label><input type="checkbox" id="albumCheckbox"><b>Альбомы (';
            albumContent += sortedAlbums.length + ')</b></label><br>';
        }
        let year = 0;
        sortedAlbums.forEach(album => {
            if (album.year !== year) {
                year = album.year;
                albumContent += '<br><label class="label-year">' + year + '</label><br>';
            }
            let artists = backgroundPage.utils.parseArtists(album.artists).artists.join(', ');
            let title = album.title;
            if (album.version) {
                title += ' (' + album.version + ')';
            }
            albumContent += '<label><input type="checkbox" class="album" value="';
            albumContent += album.id + '">[' + album.trackCount + '] ' +  artists + ' - ' + title + '</label><br>';
        });

        $('name').innerHTML = label.label.name;
        $('info').innerHTML = 'Лейбл';
        $('albums').innerHTML = albumContent;

        if (sortedAlbums.length) {
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
        let artists = backgroundPage.utils.parseArtists(track.artists).artists.join(', ');
        let size = backgroundPage.utils.bytesToStr(track.fileSize);
        let duration = backgroundPage.utils.durationToStr(track.durationMs);
        $('name').innerHTML = artists + ' - ' + track.title;
        $('info').innerHTML = 'Трек / ' + size + ' / ' + duration;
    };

    let generateDownloadAlbum = album => {
        let artists = backgroundPage.utils.parseArtists(album.artists).artists.join(', ');
        $('name').innerHTML = artists + ' - ' + album.title;
        if (!album.trackCount) {
            $('info').innerHTML = 'Пустой альбом';
            $('startDownloadBtn').style.display = 'none';
            backgroundPage.utils.logError({
                message: 'Пустой альбом',
                details: album.id
            });
            return;
        }

        let size = 0;
        let duration = 0;
        album.volumes.forEach(volume => {
            volume.forEach(track => {
                if (!track.error) {
                    size += track.fileSize;
                    duration += track.durationMs;
                }
            });
        });
        size = backgroundPage.utils.bytesToStr(size);
        duration = backgroundPage.utils.durationToStr(duration);
        $('info').innerHTML = 'Альбом (' + album.trackCount + ') / ' + size + ' / ' + duration;
    };

    let generateDownloadPlaylist = playlist => {
        $('name').innerHTML = playlist.title;
        if (!playlist.trackCount) {
            $('info').innerHTML = 'Пустой плейлист';
            $('startDownloadBtn').style.display = 'none';
            backgroundPage.utils.logError({
                message: 'Пустой плейлист',
                details: playlist.owner.login + '#' + playlist.kind
            });
            return;
        }

        let size = 0;
        let duration = 0;
        playlist.tracks.forEach(track => {
            if (!track.error) {
                size += track.fileSize;
                duration += track.durationMs;
            }
        });
        size = backgroundPage.utils.bytesToStr(size);
        duration = backgroundPage.utils.durationToStr(duration);
        $('info').innerHTML = 'Плейлист (' + playlist.trackCount + ') / ' + size + ' / ' + duration;
    };

    let onAjaxFail = error => {
        backgroundPage.utils.logError(error);
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
        bp.utils.getActiveTab().then(activeTab => {
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
                bp.yandex.getPlaylist(page.username, page.playlistId).then(playlist => {
                    hidePreloader();
                    generateDownloadPlaylist(playlist);
                }).catch(onAjaxFail);
            } else if (page.isTrack) {
                downloadBtn.setAttribute('data-type', 'track');
                downloadBtn.setAttribute('data-trackId', page.trackId);
                if (bp.storage.current.singleClickDownload) {
                    hidePreloader();
                    downloadBtn.click();
                    return;
                }
                bp.yandex.getTrack(page.trackId).then(track => {
                    hidePreloader();
                    generateDownloadTrack(track);
                }).catch(onAjaxFail);
            } else if (page.isAlbum) {
                downloadBtn.setAttribute('data-type', 'album');
                downloadBtn.setAttribute('data-albumId', page.albumId);
                if (bp.storage.current.singleClickDownload) {
                    hidePreloader();
                    downloadBtn.click();
                    return;
                }
                bp.yandex.getAlbum(page.albumId).then(album => {
                    hidePreloader();
                    generateDownloadAlbum(album);
                }).catch(onAjaxFail);
            } else if (page.isArtist) {
                downloadBtn.setAttribute('data-type', 'artistOrLabel');
                bp.yandex.getArtist(page.artistId).then(artist => {
                    hidePreloader();
                    generateDownloadArtist(artist);
                    downloadBtn.setAttribute('data-name', artist.artist.name);
                }).catch(onAjaxFail);
            } else if (page.isLabel) {
                downloadBtn.setAttribute('data-type', 'artistOrLabel');
                bp.yandex.getLabel(page.labelId).then(label => {
                    hidePreloader();
                    generateDownloadLabel(label);
                    downloadBtn.setAttribute('data-name', label.label.name);
                }).catch(onAjaxFail);
            } else if (page.isGenre) {
                chrome.tabs.sendMessage(activeTab.id, 'getCurrentTrackUrl', function (response) {
                    if (!response || !response.url) {
                        hidePreloader();
                        $('downloadBtn').click();
                        $('addBtn').classList.add('disabled');
                        return;
                    }
                    let page = bp.utils.getUrlInfo(response.url);
                    downloadBtn.setAttribute('data-type', 'track');
                    downloadBtn.setAttribute('data-trackId', page.trackId);
                    if (bp.storage.current.singleClickDownload) {
                        hidePreloader();
                        downloadBtn.click();
                        return;
                    }
                    bp.yandex.getTrack(page.trackId).then(track => {
                        hidePreloader();
                        generateDownloadTrack(track);
                    }).catch(onAjaxFail);
                });
            } else {
                hidePreloader();
                $('downloadBtn').click();
                $('addBtn').classList.add('disabled');
            }
        }).catch(bp.utils.logError);
    });

})();
