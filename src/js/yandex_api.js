/* global utils, storage */
'use strict';

var yandex = {};

yandex.getTrackUrl = function (storageDir, onSuccess, onFail) {
    var url = 'https://storage.mds.yandex.net/download-info/' + storageDir + '/2?format=json';
    utils.ajax(url, 'json', function (json) {
        var md5 = utils.md5('XGRlBW9FXlekgbPrRHuSiA' + json.path.substr(1) + json.s);
        onSuccess('https://' + json.host + '/get-mp3/' + md5 + '/' + json.ts + json.path);
    }, onFail);
};

yandex.getTrack = function (trackId, onSuccess, onFail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/handlers/track.jsx?track=' + trackId;
    utils.ajax(url, 'json', function (json) {
        onSuccess(json.track);
    }, onFail);
};

yandex.getArtist = function (artistId, onSuccess, onFail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/handlers/artist.jsx?artist=' + artistId + '&what=albums';
    utils.ajax(url, 'json', onSuccess, onFail);
};

yandex.getAlbum = function (albumId, onSuccess, onFail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/handlers/album.jsx?album=' + albumId;
    utils.ajax(url, 'json', onSuccess, onFail);
};

yandex.getPlaylist = function (username, playlistId, onSuccess, onFail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/handlers/playlist.jsx?owner=' + username + '&kinds=' + playlistId;
    utils.ajax(url, 'json', function (json) {
        onSuccess(json.playlist);
    }, onFail);
};
