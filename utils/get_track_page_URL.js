/* global yandex, utils */

(()=> {
    'use strict';

    let getTrackPageURL = trackId => {
        yandex.getTrack(trackId, track => {
            let artists = utils.parseArtists(track.artists, ', ');
            console.log(artists.artists + ' - ' + track.title);
            if (track.error) {
                console.info(track.error);
                return;
            }
            track.albums.forEach(album => console.log('https://music.yandex.ru/album/' + album.id + '/track/' + trackId));
        }, (error, details) => console.log(error, details));
    };

    getTrackPageURL(10750327);

})();
