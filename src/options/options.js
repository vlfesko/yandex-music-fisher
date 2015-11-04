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

function afterCheckboxChanged(checkbox) {
    var checked = $(checkbox).checked;
    if (checkbox === 'shouldDownloadCover') {
        if (checked) {
            $('albumCoverSize').removeAttribute('disabled');
        } else {
            $('albumCoverSize').setAttribute('disabled', 'disabled');
        }
    }
    else if (checkbox === 'backgroundDownload') {
        var permissions = {
            permissions: ['background']
        };
        chrome.permissions.contains(permissions, function (contains) {
            if (chrome.runtime.lastError) { // opera
                $('backgroundDownload').parentNode.parentNode.parentNode.style.display = 'none';
            }
            if (contains && !checked) { // btnReset
                chrome.permissions.remove(permissions);
            }
        });
    }
}

checkboxes.forEach(function (checkbox) {
    $(checkbox).addEventListener('click', function () {
        var checked = this.checked;
        saveSetting(checkbox, checked);
        afterCheckboxChanged(checkbox);

        if (checkbox === 'backgroundDownload') {
            var permissions = {
                permissions: ['background']
            };
            if (checked) {
                chrome.permissions.request(permissions, function (granted) {
                    if (!granted) {
                        saveSetting(checkbox, false);
                    }
                });
            } else {
                chrome.permissions.remove(permissions, function (removed) {
                    if (!removed) {
                        saveSetting(checkbox, false);
                    }
                });
            }
        }
    });
});

selects.forEach(function (select) {
    $(select).addEventListener('click', function () {
        var value = this.value;
        if (select === 'downloadThreadCount') {
            value = parseInt(value);
        }
        saveSetting(select, value);
    });
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
        $(checkbox).checked = backgroundPage.storage.current[checkbox];
        afterCheckboxChanged(checkbox);
    });

    selects.forEach(function (select) {
        $(select).value = backgroundPage.storage.current[select];
    });
});
