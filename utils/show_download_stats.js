/* global utils */

'use strict';

var githubURL = 'https://api.github.com/repos/egoroof/yandex-music-fisher/releases';
var bitbucketURL = 'https://bitbucket.org/api/2.0/repositories/egoroof/yandex-music-fisher/downloads';

function onError(error, details) {
    console.log(error, details);
}

function onGithubLoaded(releases) {
    console.log('GitHub statistics');
    var totalDownloadCount = 0;
    releases.forEach(function (release) {
        console.log(release.name, release.assets[0].download_count);
        totalDownloadCount += release.assets[0].download_count;
    });
    console.log('total', totalDownloadCount);
}

function onBitbucketLoaded(info) {
    console.log('Bitbucket statistics');
    var totalDownloadCount = 0;
    info.values.forEach(function (download) {
        console.log(download.name, download.downloads);
        totalDownloadCount += download.downloads;
    });
    console.log('total', totalDownloadCount);
}

utils.ajax(githubURL, 'json', onGithubLoaded, onError);
utils.ajax(bitbucketURL, 'json', onBitbucketLoaded, onError);
