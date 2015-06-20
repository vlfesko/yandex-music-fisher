/* global chrome */

'use strict';

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
});

document.getElementById('downloadFolderBtn').addEventListener('click', function () {
    chrome.downloads.showDefaultFolder();
});

document.getElementById('startDownloadBtn').addEventListener('click', function () {
    var downloadType = this.getAttribute('data-type');
    switch (downloadType) {
        case 'track':
            var trackId = this.getAttribute('data-trackId');
            backgroundPage.yandex.getTrack(trackId, function (track) {
                backgroundPage.downloader.downloadTrack(track);
            }, backgroundPage.logger.addMessage);
            break;
        case 'album':
            var albumId = this.getAttribute('data-albumId');
            backgroundPage.yandex.getAlbum(albumId, function (album) {
                backgroundPage.downloader.downloadAlbum(album);
            }, backgroundPage.logger.addMessage);
            break;
        case 'playlist':
            var username = this.getAttribute('data-username');
            var playlistId = this.getAttribute('data-playlistId');
            backgroundPage.yandex.getPlaylist(username, playlistId, function (playlist) {
                backgroundPage.downloader.downloadPlaylist(playlist);
            }, backgroundPage.logger.addMessage);
            break;
        case 'artist':
            var artistName = this.getAttribute('data-artistName');;
            var albumElems = document.getElementsByClassName('album');
            var compilationElems = document.getElementsByClassName('compilation');
            var allElems = [].slice.call(albumElems).concat([].slice.call(compilationElems));

            for (var i = 0; i < allElems.length; i++) {
                if (allElems[i].checked) {
                    backgroundPage.yandex.getAlbum(allElems[i].value, function (album) {
                        backgroundPage.downloader.downloadAlbum(album, artistName);
                    }, backgroundPage.logger.addMessage);
                }
            }
            break;
    }
});

function generateDownloadArtist(artist) {
    // todo: добавить размер и продолжительность треков
    var i;
    var albumContent = '';
    var compilationContent = '';
    albumContent += '<label><input type="checkbox" id="albumCheckbox" checked><b>Альбомы (';
    albumContent += artist.albums.length + ')</b></label><br>';
    for (i = 0; i < artist.albums.length; i++) {
        albumContent += '<label><input type="checkbox" class="album" checked value="';
        albumContent += artist.albums[i].id + '">' + artist.albums[i].title + '</label><br>';
    }
    if (artist.alsoAlbums.length) {
        compilationContent += '<label><input type="checkbox" id="compilationCheckbox"><b>Сборники (';
        compilationContent += artist.alsoAlbums.length + ')</b></label><br>';
    }
    for (i = 0; i < artist.alsoAlbums.length; i++) {
        compilationContent += '<label><input type="checkbox" class="compilation" value="';
        compilationContent += artist.alsoAlbums[i].id + '">' + artist.alsoAlbums[i].title + '</label><br>';
    }
    document.getElementById('name').innerHTML = artist.artist.name;
    document.getElementById('info').innerHTML = 'Дискография';
    document.getElementById('albums').innerHTML = albumContent;
    document.getElementById('compilations').innerHTML = compilationContent;
}

function generateDownloadTrack(track) {
    var artists = backgroundPage.utils.parseArtists(track.artists);
    var size = backgroundPage.utils.bytesToStr(track.fileSize);
    var duration = backgroundPage.utils.durationToStr(track.durationMs);
    document.getElementById('name').innerHTML = artists + ' - ' + track.title;
    document.getElementById('info').innerHTML = 'Трек / ' + size + ' / ' + duration;
}

function generateDownloadAlbum(album) {
    // todo: добавить размер и продолжительность треков
    var artists = backgroundPage.utils.parseArtists(album.artists);
    document.getElementById('name').innerHTML = artists + ' - ' + album.title;
    document.getElementById('info').innerHTML = 'Альбом / треков: ' + album.trackCount;
}

function generateDownloadPlaylist(playlist) {
    // todo: добавить размер и продолжительность треков
    document.getElementById('name').innerHTML = playlist.title;
    document.getElementById('info').innerHTML = 'Плейлист / треков: ' + playlist.trackCount;
}

chrome.tabs.query({
    active: true,
    currentWindow: true
}, function (tabs) {
    var activeTab = tabs[0];
    chrome.runtime.getBackgroundPage(function (bp) {
        backgroundPage = bp;
        var page = bp.utils.getUrlInfo(activeTab.url);
        var downloadBtn = document.getElementById('startDownloadBtn');
        if (page.isPlaylist) {
            bp.yandex.getPlaylist(page.username, page.playlistId, function (playlist) {
                generateDownloadPlaylist(playlist);
                downloadBtn.setAttribute('data-type', 'playlist');
                downloadBtn.setAttribute('data-username', page.username);
                downloadBtn.setAttribute('data-playlistId', page.playlistId);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else if (page.isTrack) {
            bp.yandex.getTrack(page.trackId, function (track) {
                generateDownloadTrack(track);
                downloadBtn.setAttribute('data-type', 'track');
                downloadBtn.setAttribute('data-trackId', page.trackId);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else if (page.isAlbum) {
            bp.yandex.getAlbum(page.albumId, function (album) {
                generateDownloadAlbum(album);
                downloadBtn.setAttribute('data-type', 'album');
                downloadBtn.setAttribute('data-albumId', page.albumId);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else if (page.isArtist) {
            bp.yandex.getArtist(page.artistId, function (artist) {
                generateDownloadArtist(artist);
                downloadBtn.setAttribute('data-type', 'artist');
                downloadBtn.setAttribute('data-artistName', artist.artist.name);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else {
            console.log('Nothing to download here');
        }
    });
});

var backgroundPage;
