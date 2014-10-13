function downloadAlbums(artistName) {
    var albumElems = document.getElementsByClassName('album');
    var compilationElems = document.getElementsByClassName('compilation');
    var allElems = [].slice.call(albumElems);
    allElems = allElems.concat([].slice.call(compilationElems));

    for (var i = 0; i < allElems.length; i++) {
        if (allElems[i].checked) {
            backgroundPage.yandex.getAlbum(allElems[i].value, function (album) {
                backgroundPage.downloader.downloadAlbum(album, artistName);
            }, function (error) {
                backgroundPage.console.error(error);
                backgroundPage.log.addMessage(error);
            });
        }
    }
    chrome.pageAction.hide(activeTab.id);
    window.close();
}

function generatePopup(artist) {
    var content = document.getElementById('content');
    content.innerHTML = '<h3>Дискография ' + artist.artist.name
            + '</h3><label><input type="checkbox" id="albumCheckbox" checked><b>Альбомы ('
            + artist.albums.length + ')</b></label><br>';
    for (var i = 0; i < artist.albums.length; i++) {
        content.innerHTML += '<label><input type="checkbox" class="album" checked value="'
                + artist.albums[i].id + '">' + artist.albums[i].title + '</label><br>';
    }
    if (artist.alsoAlbums.length) {
        content.innerHTML += '<br><label><input type="checkbox" id="compilationCheckbox"><b>Сборники ('
                + artist.alsoAlbums.length + ')</b></label><br>';
    }
    for (var i = 0; i < artist.alsoAlbums.length; i++) {
        content.innerHTML += '<label><input type="checkbox" class="compilation" value="'
                + artist.alsoAlbums[i].id + '">' + artist.alsoAlbums[i].title + '</label><br>';
    }
    content.innerHTML += '<br><button id="download">Скачать выбранное</button>';
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

document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        activeTab = tabs[0];
        chrome.runtime.getBackgroundPage(function (bp) {
            backgroundPage = bp;
            var page = backgroundPage.utils.getUrlInfo(activeTab.url);
            if (!page.isYandexMusic || !page.isArtist) {
                return;
            }
            backgroundPage.yandex.getArtist(page.artistId, function (artist) {
                generatePopup(artist);
                document.getElementById('download').addEventListener('click', function () {
                    downloadAlbums(artist.artist.name);
                });
                document.getElementById('albumCheckbox').addEventListener('click', albumCheckboxChange);
                var compilationCheckbox = document.getElementById('compilationCheckbox');
                if (compilationCheckbox) {
                    compilationCheckbox.addEventListener('click', compilationCheckboxChange);
                }
            }, function (error) {
                document.getElementById('content').innerHTML = 'Ошибка. Попробуйте позже';
                backgroundPage.console.error(error);
                backgroundPage.log.addMessage(error);
            });
        });
    });
});

var backgroundPage, activeTab;
