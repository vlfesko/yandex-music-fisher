/* global utils, storage, ga */

(() => {
    'use strict';

    let yandex = {};
    window.yandex = yandex;

    yandex.getTrackUrl = trackId => {
        let url = 'https://music.yandex.%domain%/api/v2.0/handlers/track/%id%/download'
            .replace('%domain%', storage.current.domain)
            .replace('%id%', trackId);
        return utils.ajax(url, 'json').then(json => {
            if (json.codec !== 'mp3') {
                ga('send', 'event', 'test', json.codec + ' codec', trackId);
            }
            if (json.gain) {
                ga('send', 'event', 'test', 'gain', trackId);
            }
            return utils.ajax(json.src + '&format=json', 'json');
        }).then(json => {
            let salt = 'XGRlBW9FXlekgbPrRHuSiA';
            let md5 = window.md5(salt + json.path.substr(1) + json.s);
            return 'https://' + json.host + '/get-mp3/' + md5 + '/' + json.ts + json.path;
        });
    };

    yandex.getTrackOldUrl = storageDir => {
        let url = 'https://storage.mds.yandex.net/download-info/%storage%/2?format=json'
            .replace('%storage%', storageDir);
        return utils.ajax(url, 'json').then(json => {
            let salt = 'XGRlBW9FXlekgbPrRHuSiA';
            var md5 = window.md5(salt + json.path.substr(1) + json.s);
            return 'https://' + json.host + '/get-mp3/' + md5 + '/' + json.ts + json.path;
        });
    };

    yandex.getTrack = trackId => {
        let url = 'https://music.yandex.%domain%/handlers/track.jsx?track=%id%'
            .replace('%domain%', storage.current.domain)
            .replace('%id%', trackId);
        return utils.ajax(url, 'json')
            .then(json => json.track);
    };

    yandex.getArtist = artistId => {
        let url = 'https://music.yandex.%domain%/handlers/artist.jsx?artist=%id%&what=albums'
            .replace('%domain%', storage.current.domain)
            .replace('%id%', artistId);
        return utils.ajax(url, 'json');
    };

    yandex.getAlbum = albumId => {
        let url = 'https://music.yandex.%domain%/handlers/album.jsx?album=%id%'
            .replace('%domain%', storage.current.domain)
            .replace('%id%', albumId);
        return utils.ajax(url, 'json');
    };

    yandex.getPlaylist = (username, playlistId) => {
        let url = 'https://music.yandex.%domain%/handlers/playlist.jsx?owner=%user%&kinds=%id%'
            .replace('%domain%', storage.current.domain)
            .replace('%user%', username)
            .replace('%id%', playlistId);
        return utils.ajax(url, 'json')
            .then(json => json.playlist);
    };

    yandex.getLabel = labelId => {
        let url = 'https://music.yandex.%domain%/handlers/label.jsx?sort=year&id=%id%'
            .replace('%domain%', storage.current.domain)
            .replace('%id%', labelId);
        return utils.ajax(url, 'json');
    };

})();
