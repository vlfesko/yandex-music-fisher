/* global chrome */
'use strict';

function downloadAlbums(artistName) {
    var albumElems = document.getElementsByClassName('album');
    var compilationElems = document.getElementsByClassName('compilation');
    var allElems = [].slice.call(albumElems);
    allElems = allElems.concat([].slice.call(compilationElems));

    for (var i = 0; i < allElems.length; i++) {
        if (allElems[i].checked) {
            backgroundPage.yandex.getAlbum(allElems[i].value, function (album) {
                backgroundPage.downloader.downloadAlbum(album, artistName);
            }, backgroundPage.logger.addMessage);
        }
    }
}

function generatePopup(artist) {
    var i;
    var content = '<h3>Дискография ' + artist.artist.name + '</h3>';
    content += '<label><input type="checkbox" id="albumCheckbox" checked><b>Альбомы (';
    content += artist.albums.length + ')</b></label><br>';
    for (i = 0; i < artist.albums.length; i++) {
        content += '<label><input type="checkbox" class="album" checked value="';
        content += artist.albums[i].id + '">' + artist.albums[i].title + '</label><br>';
    }
    if (artist.alsoAlbums.length) {
        content += '<br><label><input type="checkbox" id="compilationCheckbox"><b>Сборники (';
        content += artist.alsoAlbums.length + ')</b></label><br>';
    }
    for (i = 0; i < artist.alsoAlbums.length; i++) {
        content += '<label><input type="checkbox" class="compilation" value="';
        content += artist.alsoAlbums[i].id + '">' + artist.alsoAlbums[i].title + '</label><br>';
    }
    content += '<br><button id="download">Скачать выбранное</button>';
    document.getElementById('content').innerHTML = content;
}

function albumCheckboxChange() {
    var elem = document.getElementById('albumCheckbox');
    var albums = document.getElementsByClassName('album');
    for (var i = 0; i < albums.length; i++) {
        albums[i].checked = elem.checked;
    }
}

function compilationCheckboxChange() {
    var elem = document.getElementById('compilationCheckbox');
    var compilations = document.getElementsByClassName('compilation');
    for (var i = 0; i < compilations.length; i++) {
        compilations[i].checked = elem.checked;
    }
}

function resize(tabHeight) {
    var popupHeight = document.getElementById('content').offsetHeight;
    var popupNewHeight = tabHeight - 14;
    if (popupNewHeight < 100) {
        popupNewHeight = 100;
    }
    if (popupHeight > popupNewHeight) { // содержимое не влазит в окно
        document.getElementById('content').style.height = popupNewHeight + 'px';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        var activeTab = tabs[0];
        chrome.runtime.getBackgroundPage(function (bp) {
            backgroundPage = bp;
            var page = backgroundPage.utils.getUrlInfo(activeTab.url);
            if (!page.isYandexMusic || !page.isArtist) {
                return;
            }
            backgroundPage.yandex.getArtist(page.artistId, function (artist) {
                generatePopup(artist);
                resize(activeTab.height);
                document.getElementById('download').addEventListener('click', function () {
                    downloadAlbums(artist.artist.name);
                    chrome.pageAction.hide(activeTab.id);
                    window.close();
                });
                document.getElementById('albumCheckbox').addEventListener('click', albumCheckboxChange);
                var compilationCheckbox = document.getElementById('compilationCheckbox');
                if (compilationCheckbox) {
                    compilationCheckbox.addEventListener('click', compilationCheckboxChange);
                }
            }, function (error) {
                document.getElementById('content').innerHTML = 'Ошибка. Попробуйте позже';
                backgroundPage.logger.addMessage(error);
            });
        });
    });
});

var backgroundPage;
