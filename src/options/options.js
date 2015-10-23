/* global chrome */
'use strict';

var backgroundPage;
var checkboxes = ['shouldDownloadCover', 'enumerateAlbums', 'enumeratePlaylists', 'shouldNotifyAboutUpdates', 'singleClickDownload'];
var selects = ['downloadThreadCount', 'albumCoverSize', 'albumCoverSizeId3'];

checkboxes.forEach(function (checkbox) {
    document.getElementById(checkbox).onchange = function () {
        var value = !!this.value;
        var options = {};
        options[checkbox] = value;
        chrome.storage.local.set(options, backgroundPage.storage.load);

        if (checkbox === 'shouldDownloadCover') {
            var albumCoverSizeElem = document.getElementById('albumCoverSize');
            if (value) {
                albumCoverSizeElem.removeAttribute('disabled');
            } else {
                albumCoverSizeElem.setAttribute('disabled', 'disabled');
            }
        }
    };
});

selects.forEach(function (select) {
    document.getElementById(select).onchange = function () {
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

document.getElementById('btnReset').onclick = function () {
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
        document.getElementById(checkbox).value = value;
        document.getElementById(checkbox).onchange();
    });

    selects.forEach(function (select) {
        document.getElementById(select).value = backgroundPage.storage.current[select];
    });
});
