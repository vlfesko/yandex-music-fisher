/* global chrome */
'use strict';

var $ = document.getElementById.bind(document);
var backgroundPage;
var checkboxes = [
    'shouldDownloadCover',
    'enumerateAlbums',
    'enumeratePlaylists',
    'shouldNotifyAboutUpdates',
    'singleClickDownload',
    'backgroundDownload'
];
var selects = [
    'downloadThreadCount',
    'albumCoverSize',
    'albumCoverSizeId3'
];

function saveSetting(setting, value) {
    var options = {};
    options[setting] = value;
    chrome.storage.local.set(options, backgroundPage.storage.load);
}

checkboxes.forEach(function (checkbox) {
    $(checkbox).onchange = function () {
        var checked = !!this.value;
        saveSetting(checkbox, checked);

        switch (checkbox) {
            case 'shouldDownloadCover':
                if (checked) {
                    $('albumCoverSize').removeAttribute('disabled');
                } else {
                    $('albumCoverSize').setAttribute('disabled', 'disabled');
                }
                break;
            case 'backgroundDownload':
                var permissions = {
                    permissions: ['background']
                };
                if (checked) {
                    chrome.permissions.contains(permissions, function (contains) {
                        if (!contains) {
                            chrome.permissions.request(permissions, function (granted) {
                                if (!granted) {
                                    saveSetting(checkbox, false);
                                }
                            });
                        }
                    });
                } else {
                    chrome.permissions.contains(permissions, function (contains) {
                        if (contains) {
                            chrome.permissions.remove(permissions, function (removed) {
                                if (!removed) {
                                    saveSetting(checkbox, false);
                                }
                            });
                        }
                    });
                }
                break;
        }
    };
});

selects.forEach(function (select) {
    $(select).onchange = function () {
        var value = this.value;
        if (select === 'downloadThreadCount') {
            value = parseInt(value);
        }
        saveSetting(select, value);
    };
});

$('btnReset').addEventListener('click', function () {
    backgroundPage.storage.resetAll(function () {
        backgroundPage.storage.load();
        location.reload();
    });
});

chrome.runtime.getBackgroundPage(function (bp) {
    backgroundPage = bp;

    checkboxes.forEach(function (checkbox) {
        var value = ''; // конвертируется в false
        if (backgroundPage.storage.current[checkbox]) {
            value = 'true';
        }
        $(checkbox).value = value;
        $(checkbox).onchange();
    });

    selects.forEach(function (select) {
        $(select).value = backgroundPage.storage.current[select];
    });
});
