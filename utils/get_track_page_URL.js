/* global yandex, utils */

(()=> {
    'use strict';

    let getTrackPageURL = trackId => {
        const urlPattern = 'https://music.yandex.ru/album/%albumId%/track/%trackId%';
        yandex.getTrack(trackId).then(track => {
            let artists = utils.parseArtists(track.artists).artists.join(', ');
            console.log(artists + ' - ' + track.title);
            if (track.error) {
                console.info(track.error);
                return;
            }
            track.albums.forEach(album => console.log(urlPattern
                .replace('%albumId%', album.id)
                .replace('%trackId%', trackId)
            ));
        }).catch(error => console.log(error));
    };
    window.getTrackPageURL = getTrackPageURL;

    getTrackPageURL(4790215);

})();
