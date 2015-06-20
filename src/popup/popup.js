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
        if (page.isPlaylist) {
            bp.yandex.getPlaylist(page.username, page.playlistId, function (playlist) {
                console.log(playlist);
                generateDownloadPlaylist(playlist);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else if (page.isTrack) {
            bp.yandex.getTrack(page.trackId, function (track) {
                console.log(track);
                generateDownloadTrack(track);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else if (page.isAlbum) {
            bp.yandex.getAlbum(page.albumId, function (album) {
                console.log(album);
                generateDownloadAlbum(album);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else if (page.isArtist) {
            bp.yandex.getArtist(page.artistId, function (artist) {
                console.log(artist);
                generateDownloadArtist(artist);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else {
            console.log('Nothing to download here');
        }
    });
});

var backgroundPage;
