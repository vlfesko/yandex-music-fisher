/* global utils, storage, ga */

(() => {
    'use strict';

    let yandex = {};
    window.yandex = yandex;

    yandex.getTrackUrl = (trackId, onSuccess, onFail) => {
        let url = 'https://music.yandex.' + storage.current.domain;
        url += '/api/v2.0/handlers/track/' + trackId + '/download';
        utils.ajax(url, 'json', json => {
            if (json.codec !== 'mp3') {
                ga('send', 'event', 'test', json.codec + ' codec', trackId);
            }
            if (json.gain) {
                ga('send', 'event', 'test', 'gain', trackId);
            }
            utils.ajax(json.src + '&format=json', 'json', json => {
                let salt = 'XGRlBW9FXlekgbPrRHuSiA';
                let md5 = window.md5(salt + json.path.substr(1) + json.s);
                onSuccess('https://' + json.host + '/get-mp3/' + md5 + '/' + json.ts + json.path);
            }, onFail);
        }, onFail);
    };

    yandex.getTrack = (trackId, onSuccess, onFail) => {
        let url = 'https://music.yandex.' + storage.current.domain;
        url += '/handlers/track.jsx?track=' + trackId;
        utils.ajax(url, 'json', json => onSuccess(json.track), onFail);
    };

    yandex.getArtist = (artistId, onSuccess, onFail) => {
        let url = 'https://music.yandex.' + storage.current.domain;
        url += '/handlers/artist.jsx?artist=' + artistId + '&what=albums';
        utils.ajax(url, 'json', onSuccess, onFail);
    };

    yandex.getAlbum = (albumId, onSuccess, onFail) => {
        let url = 'https://music.yandex.' + storage.current.domain;
        url += '/handlers/album.jsx?album=' + albumId;
        utils.ajax(url, 'json', onSuccess, onFail);
    };

    yandex.getPlaylist = (username, playlistId, onSuccess, onFail) => {
        let url = 'https://music.yandex.' + storage.current.domain;
        url += '/handlers/playlist.jsx?owner=' + username + '&kinds=' + playlistId;
        utils.ajax(url, 'json', json => onSuccess(json.playlist), onFail);
    };

    yandex.getLabel = (labelId, onSuccess, onFail) => {
        let url = 'https://music.yandex.' + storage.current.domain;
        url += '/handlers/label.jsx?sort=year&id=' + labelId;
        utils.ajax(url, 'json', onSuccess, onFail);
    };

})();
