/* global utils */

(()=> {
    'use strict';

    const githubURL = 'https://api.github.com/repos/egoroof/yandex-music-fisher/releases';
    const bitbucketURL = 'https://bitbucket.org/api/2.0/repositories/egoroof/yandex-music-fisher/downloads';

    let onError = (error, details) => console.log(error, details);

    utils.ajax(githubURL, 'json').then(releases => {
        console.log('GitHub statistics');
        let totalDownloadCount = 0;
        releases.forEach(release => {
            console.log(release.name, release.assets[0].download_count);
            totalDownloadCount += release.assets[0].download_count;
        });
        console.log('total', totalDownloadCount);
    }).catch(onError);

    utils.ajax(bitbucketURL, 'json').then(info => {
        console.log('Bitbucket statistics');
        let totalDownloadCount = 0;
        info.values.forEach(download => {
            console.log(download.name, download.downloads);
            totalDownloadCount += download.downloads;
        });
        console.log('total', totalDownloadCount);
    }).catch(onError);

})();
