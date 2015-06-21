/* global utils, storage */
'use strict';

var yandex = {};

yandex.getTrackUrl = function (storageDir, success, fail) {
    var url = 'https://storage.mds.yandex.net/download-info/' + storageDir;
    url += '/2?format=json';
    utils.ajax(url, 'json', function (json) {
        var md5 = utils.md5('XGRlBW9FXlekgbPrRHuSiA' + json.path.substr(1) + json.s);
        success('https://' + json.host + '/get-mp3/' + md5 + '/' + json.ts + json.path);
    }, fail);
};

yandex.getTrack = function (trackId, success, fail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/handlers/track.jsx?track=' + trackId;
    utils.ajax(url, 'json', function (json) {
        success(json.track);
    }, fail);
};

yandex.getArtist = function (artistId, success, fail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/handlers/artist.jsx?artist=' + artistId;
    url += '&what=albums';
    utils.ajax(url, 'json', success, fail);
};

yandex.getAlbum = function (albumId, success, fail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/handlers/album.jsx?album=' + albumId;
    utils.ajax(url, 'json', success, fail);
};

yandex.getPlaylist = function (username, playlistId, success, fail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/handlers/playlist.jsx?owner=' + username;
    url += '&kinds=' + playlistId;
    utils.ajax(url, 'json', function (json) {
        success(json.playlist);
    }, fail);
};
