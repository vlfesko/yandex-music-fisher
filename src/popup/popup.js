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

chrome.tabs.query({
    active: true,
    currentWindow: true
}, function (tabs) {
    var activeTab = tabs[0];
    chrome.runtime.getBackgroundPage(function (bp) {
        var page = bp.utils.getUrlInfo(activeTab.url);
        if (page.isPlaylist) {
            bp.yandex.getPlaylist(page.username, page.playlistId, function (playlist) {
                document.getElementById('downloadType').innerHTML = 'Плейлист';
                document.getElementById('downloadName').innerHTML = playlist.title;
                console.log(playlist);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else if (page.isTrack) {
            bp.yandex.getTrack(page.trackId, function (track) {
                document.getElementById('downloadType').innerHTML = 'Трек';
                document.getElementById('downloadName').innerHTML = track.title;
                console.log(track);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else if (page.isAlbum) {
            bp.yandex.getAlbum(page.albumId, function (album) {
                document.getElementById('downloadType').innerHTML = 'Альбом';
                document.getElementById('downloadName').innerHTML = album.title;
                console.log(album);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else if (page.isArtist) {
            bp.yandex.getArtist(page.artistId, function (artist) {
                document.getElementById('downloadType').innerHTML = 'Дискография';
                console.log(artist);
            }, function (error) {
                bp.logger.addMessage(error);
            });
        } else {
            console.log('Nothing to download here');
        }
    });
});
