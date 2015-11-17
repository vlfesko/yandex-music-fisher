/* global chrome */

(()=> {
    'use strict';

    let $ = document.getElementById.bind(document);
    let backgroundPage;
    let checkboxes = [
        'shouldDownloadCover',
        'enumerateAlbums',
        'enumeratePlaylists',
        'shouldNotifyAboutUpdates',
        'singleClickDownload',
        'backgroundDownload',
        'downloadHighestBitrate'
    ];
    let selects = [
        'downloadThreadCount',
        'albumCoverSize',
        'albumCoverSizeId3'
    ];

    let saveSetting = (setting, value) => {
        let options = {};
        options[setting] = value;
        chrome.storage.local.set(options, backgroundPage.storage.load);
    };

    let afterCheckboxChanged = checkbox => {
        let checked = $(checkbox).checked;
        if (checkbox === 'shouldDownloadCover') {
            if (checked) {
                $('albumCoverSize').removeAttribute('disabled');
            } else {
                $('albumCoverSize').setAttribute('disabled', 'disabled');
            }
        }
        else if (checkbox === 'backgroundDownload') {
            let permissions = {
                permissions: ['background']
            };
            chrome.permissions.contains(permissions, contains => {
                if (chrome.runtime.lastError) { // opera
                    $('backgroundDownload').parentNode.parentNode.parentNode.style.display = 'none';
                }
                if (contains && !checked) { // btnReset
                    chrome.permissions.remove(permissions);
                }
            });
        }
    };

    checkboxes.forEach(checkbox => {
        $(checkbox).addEventListener('click', () => {
            let checked = $(checkbox).checked;
            saveSetting(checkbox, checked);
            afterCheckboxChanged(checkbox);

            if (checkbox === 'backgroundDownload') {
                let permissions = {
                    permissions: ['background']
                };
                if (checked) {
                    chrome.permissions.request(permissions, granted => {
                        if (!granted) {
                            saveSetting(checkbox, false);
                        }
                    });
                } else {
                    chrome.permissions.remove(permissions, removed => {
                        if (!removed) {
                            saveSetting(checkbox, false);
                        }
                    });
                }
            }
        });
    });

    selects.forEach(select => {
        $(select).addEventListener('click', () => {
            let value = $(select).value;
            if (select === 'downloadThreadCount') {
                value = parseInt(value);
            }
            saveSetting(select, value);
        });
    });

    $('btnReset').addEventListener('click', () => {
        backgroundPage.storage.resetAll().then(() => {
            backgroundPage.storage.load();
            location.reload();
        });
    });

    chrome.runtime.getBackgroundPage(bp => {
        backgroundPage = bp;

        checkboxes.forEach(checkbox => {
            $(checkbox).checked = backgroundPage.storage.current[checkbox];
            afterCheckboxChanged(checkbox);
        });

        selects.forEach(select => $(select).value = backgroundPage.storage.current[select]);
    });

})();
