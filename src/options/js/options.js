String.prototype.insert = function (index, string) {
    if (index > 0) {
        return this.substring(0, index) + string + this.substring(index, this.length);
    } else {
        return string + this;
    }
};

function handleTrackMaskButton(button, buttonMarker) {
    var maskElement = document.getElementById('track-name-mask');
    var maskElementSelectionStart = maskElement.selectionStart;
    var isButtonActive = button.classList.contains('active');
    var markerPositionStart = maskElement.value.indexOf(buttonMarker);
    var markerPositionEnd = markerPositionStart + buttonMarker.length - 1;
    var maskContainsMarker = (markerPositionStart > -1);

    button.classList.toggle('active');
    maskElement.focus();
    if (isButtonActive && maskContainsMarker) { // удаление маркера
        maskElement.value = maskElement.value.replace(buttonMarker, '');

        if (maskElementSelectionStart > markerPositionEnd) { // правее маркера
            maskElement.selectionStart = maskElementSelectionStart - buttonMarker.length;
            maskElement.selectionEnd = maskElementSelectionStart - buttonMarker.length;
        } else if (maskElementSelectionStart > markerPositionStart) { // внутри маркера
            maskElement.selectionStart = markerPositionStart;
            maskElement.selectionEnd = markerPositionStart;
        } else { // левее маркера
            maskElement.selectionStart = maskElementSelectionStart;
            maskElement.selectionEnd = maskElementSelectionStart;
        }
    }
    if (!isButtonActive && !maskContainsMarker) { // добавление маркера
        // todo: запрет добавления внутрь другого маркера
        maskElement.value = maskElement.value.insert(maskElementSelectionStart, buttonMarker);
        maskElement.selectionStart = maskElementSelectionStart + buttonMarker.length;
        maskElement.selectionEnd = maskElementSelectionStart + buttonMarker.length;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    chrome.runtime.getBackgroundPage(function (bp) {
        backgroundPage = bp;
        var threadCount = backgroundPage.storage.get('downloadThreadCount');
        var shouldDownloadCover = backgroundPage.storage.get('shouldDownloadCover');
        var albumCoverSize = backgroundPage.storage.get('albumCoverSize');
        var trackNameMask = backgroundPage.storage.get('trackNameMask');
        if (threadCount) {
            document.getElementById('download-thread-count').value = threadCount;
        }
        if (shouldDownloadCover) {
            document.getElementById('should-download-cover').value = shouldDownloadCover;
            document.getElementById('should-download-cover').onchange();
        }
        if (albumCoverSize) {
            document.getElementById('album-cover-size').value = albumCoverSize;
        }
        if (trackNameMask) {
            document.getElementById('track-name-mask').value = trackNameMask;
            document.getElementById('track-name-mask').oninput();
        }
    });
});

document.getElementById('download-thread-count').onchange = function () {
    if (this.value > 10) {
        this.value = 10;
    } else if (this.value < 1) {
        this.value = 1;
    }
    backgroundPage.storage.set('downloadThreadCount', this.value);
};

document.getElementById('should-download-cover').onchange = function () {
    var albumCoverSizeElement = document.getElementById('album-cover-size');
    if (this.value === 'yes') {
        albumCoverSizeElement.disabled = false;
    } else {
        albumCoverSizeElement.disabled = true;
    }
    backgroundPage.storage.set('shouldDownloadCover', this.value);
};

document.getElementById('album-cover-size').onchange = function () {
    backgroundPage.storage.set('albumCoverSize', this.value);
};

document.getElementById('track-name-mask-btn-artists').onclick = function () {
    handleTrackMaskButton(this, '#ИСПОЛНИТЕЛИ#');
    document.getElementById('track-name-mask').oninput();
};

document.getElementById('track-name-mask-btn-name').onclick = function () {
    handleTrackMaskButton(this, '#НАЗВАНИЕ#');
    document.getElementById('track-name-mask').oninput();
};

document.getElementById('track-name-mask').oninput = function () {
    var issetNameMarker = (this.value.indexOf('#НАЗВАНИЕ#') > -1);
    var issetArtistsMarker = (this.value.indexOf('#ИСПОЛНИТЕЛИ#') > -1);
    var buttonName = document.getElementById('track-name-mask-btn-name');
    var buttonArtists = document.getElementById('track-name-mask-btn-artists');
    if (issetNameMarker) {
        buttonName.classList.add('active');
    } else {
        buttonName.classList.remove('active');
    }
    if (issetArtistsMarker) {
        buttonArtists.classList.add('active');
    } else {
        buttonArtists.classList.remove('active');
    }
    if (this.value) {
        backgroundPage.storage.set('trackNameMask', this.value);
    }
};

document.getElementById('btn-log').onclick = function () {
    chrome.tabs.create({
        url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(backgroundPage.log.string)
    });
};

document.getElementById('btn-reset').onclick = function () {
    if (confirm('Вы уверены, что хотите сбросить все настройки?')) {
        backgroundPage.storage.resetAll();
        location.reload();
    }
};

var backgroundPage;
