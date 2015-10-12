/* global utils, storage, ga */
'use strict';

var yandex = {};

yandex.getTrackUrl = function (trackId, onSuccess, onFail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/api/v2.0/handlers/track/' + trackId + '/download';
    utils.ajax(url, 'json', function (json) {
        if (json.codec !== 'mp3') {
            ga('send', 'event', 'test', json.codec + ' codec', trackId);
        }
        if (json.gain) {
            ga('send', 'event', 'test', 'gain', trackId);
        }
        utils.ajax(json.src + '&format=json', 'json', function (json) {
            var md5 = window.md5('XGRlBW9FXlekgbPrRHuSiA' + json.path.substr(1) + json.s);
            onSuccess('https://' + json.host + '/get-mp3/' + md5 + '/' + json.ts + json.path);
        }, onFail);
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

yandex.getLabel = function (labelId, onSuccess, onFail) {
    var url = 'https://music.yandex.' + storage.current.domain;
    url += '/handlers/label.jsx?sort=year&id=' + labelId;
    utils.ajax(url, 'json', onSuccess, onFail);
};
