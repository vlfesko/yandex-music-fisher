/* global yandex, utils */

'use strict';

function getTrackPageURLs(trackId) {
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

function getTracksPageURLs(startId, stopId) {
    /* jshint nocomma: false */
    for (var trackId = startId, i = 0; trackId <= stopId; trackId++, i += 1000) {
        /*jshint validthis:true */
        setTimeout(getTrackPageURLs.bind(this, trackId), i);
    }
}

getTracksPageURLs(12345, 12346);
