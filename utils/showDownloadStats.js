/* global utils */

'use strict';

utils.ajax('https://api.github.com/repos/egoroof/yandex-music-fisher/releases', 'json', function (releases) {
    var totalDownloadCount = 0;
    releases.forEach(function (release) {
        console.log(release.name, release.assets[0].download_count);
        totalDownloadCount += release.assets[0].download_count;
    });
    console.log('total', totalDownloadCount);
}, function (error, details) {
    console.log(error, details);
});
