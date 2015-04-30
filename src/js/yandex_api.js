/* global utils */
'use strict';

var yandex = {};

yandex.getTrackUrl = function (storageDir, success, fail) {
    var url = 'https://storage.mds.yandex.net/download-info/' + storageDir;
    url += '/2?format=json&r=' + Math.random();
    utils.ajax(url, function (json) {
        var md5 = utils.md5('XGRlBW9FXlekgbPrRHuSiA' + json.path.substr(1) + json.s);
        success('https://' + json.host + '/get-mp3/' + md5 + '/' + json.ts + json.path);
    }, fail);
};

yandex.getTrack = function (trackId, success, fail) {
    var url = 'https://music.yandex.ru/handlers/track.jsx?track=' + trackId;
    url += '&r=' + Math.random();
    utils.ajax(url, function (json) {
        success(json.track);
    }, fail);
};

yandex.getArtist = function (artistId, success, fail) {
    var url = 'https://music.yandex.ru/handlers/artist.jsx?artist=' + artistId;
    url += '&what=albums&r=' + Math.random();
    utils.ajax(url, success, fail);
};

yandex.getAlbum = function (albumId, success, fail) {
    var url = 'https://music.yandex.ru/handlers/album.jsx?album=' + albumId;
    url += '&r=' + Math.random();
    utils.ajax(url, success, fail);
};

yandex.getPlaylist = function (username, playlistId, success, fail) {
    var url = 'https://music.yandex.ru/handlers/playlist.jsx?owner=' + username;
    url += '&kinds=' + playlistId;
    url += '&r=' + Math.random();
    utils.ajax(url, function (json) {
        success(json.playlist);
    }, fail);
};
