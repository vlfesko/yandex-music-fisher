/* global utils */
'use strict';

var yandex = {};

yandex.getTrackUrl = function (storageDir, success, fail) {
    var url = '/api/v1.4/jsonp.xml?action=getTrackSrc&p=download-info/';
    url += storageDir + '/2.mp3&r=' + Math.random();
    utils.ajax(url, function (jsonp) {
        var json;
        jsonp = jsonp.replace('Ya.Music.Jsonp.', '');
        var f = new Function('callback', jsonp);
        try {
            f(function (requestId, parsedJson) {
                json = parsedJson[0];
            });
        } catch (e) {
            fail('Не удалось распарсить jsonp. storageDir: ' + storageDir);
            return;
        }
        var hosts = json['regional-hosts'];
        hosts.push(json.host);
        if (!hosts.length) {
            fail('Не найдены хранилища трека. storageDir: ' + storageDir);
            return;
        }

        var md5 = utils.md5('XGRlBW9FXlekgbPrRHuSiA' + json.path.substr(1) + json.s);
        var urlBody = '/get-mp3/' + md5 + '/' + json.ts + json.path;
        var links = hosts.map(function (host) {
            return 'http://' + host + urlBody;
        });
        success(links[0]);
    }, fail);
};

yandex.getTrack = function (trackId, success, fail) {
    var url = '/handlers/track.jsx?track=' + trackId;
    url += '&r=' + Math.random();
    utils.ajax(url, function (json) {
        success(json.track);
    }, fail);
};

yandex.getArtist = function (artistId, success, fail) {
    var url = '/handlers/artist.jsx?artist=' + artistId;
    url += '&what=albums&r=' + Math.random();
    utils.ajax(url, success, fail);
};

yandex.getAlbum = function (albumId, success, fail) {
    var url = '/handlers/album.jsx?album=' + albumId;
    url += '&r=' + Math.random();
    utils.ajax(url, success, fail);
};

yandex.getPlaylist = function (username, playlistId, success, fail) {
    var url = '/handlers/playlist.jsx?owner=' + username;
    url += '&kinds=' + playlistId;
    url += '&r=' + Math.random();
    utils.ajax(url, function (json) {
        success(json.playlist);
    }, fail);
};
