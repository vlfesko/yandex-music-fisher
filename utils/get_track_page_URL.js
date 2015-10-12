/* global yandex, utils */

'use strict';

function getTrackPageURL(trackId) {
    yandex.getTrack(trackId, function (track) {
        var artists = utils.parseArtists(track.artists, ', ');
        console.log(artists.artists + ' - ' + track.title);
        if (track.error) {
            console.info(track.error);
            return;
        }
        track.albums.forEach(function (album) {
            console.log('https://music.yandex.ru/album/' + album.id + '/track/' + trackId);
        });
    }, function (error, details) {
        console.log(error, details);
    });
}

getTrackPageURL(10750327);
