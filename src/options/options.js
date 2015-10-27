/* global chrome */
'use strict';

var $ = document.getElementById.bind(document);
var backgroundPage;
var checkboxes = [
    'shouldDownloadCover',
    'enumerateAlbums',
    'enumeratePlaylists',
    'shouldNotifyAboutUpdates',
    'singleClickDownload'
];
var selects = [
    'downloadThreadCount',
    'albumCoverSize',
    'albumCoverSizeId3'
];

checkboxes.forEach(function (checkbox) {
    $(checkbox).onchange = function () {
        var value = !!this.value;
        var options = {};
        options[checkbox] = value;
        chrome.storage.local.set(options, backgroundPage.storage.load);

        if (checkbox === 'shouldDownloadCover') {
            if (value) {
                $('albumCoverSize').removeAttribute('disabled');
            } else {
                $('albumCoverSize').setAttribute('disabled', 'disabled');
            }
        }
    };
});

selects.forEach(function (select) {
    $(select).onchange = function () {
        var value = this.value;
        var options = {};
        if (select === 'downloadThreadCount') {
            options[select] = parseInt(value);
        } else {
            options[select] = value;
        }
        chrome.storage.local.set(options, backgroundPage.storage.load);
    };
});

$('btnReset').onclick = function () {
    if (confirm('Вы уверены, что хотите сбросить все настройки?')) {
        backgroundPage.storage.resetAll(function () {
            backgroundPage.storage.load();
            location.reload();
        });
    }
};

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
