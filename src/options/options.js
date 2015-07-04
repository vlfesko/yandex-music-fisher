/* global chrome */
'use strict';

var backgroundPage;

String.prototype.insert = function (index, string) {
    if (index > 0) {
        return this.substring(0, index) + string + this.substring(index, this.length);
    } else {
        return string + this;
    }
};

function handleTrackMaskButton(button, buttonMarker) {
    var maskElement = document.getElementById('trackNameMask');
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
        maskElement.value = maskElement.value.insert(maskElementSelectionStart, buttonMarker);
        maskElement.selectionStart = maskElementSelectionStart + buttonMarker.length;
        maskElement.selectionEnd = maskElementSelectionStart + buttonMarker.length;
    }
}

document.getElementById('downloadThreadCount').onchange = function () {
    chrome.storage.local.set({
        downloadThreadCount: parseInt(this.value)
    }, backgroundPage.storage.load);
};

document.getElementById('shouldDownloadCover').onchange = function () {
    chrome.storage.local.set({
        shouldDownloadCover: !!this.value
    }, backgroundPage.storage.load);
};

document.getElementById('albumCoverSize').onchange = function () {
    chrome.storage.local.set({
        albumCoverSize: this.value
    }, backgroundPage.storage.load);
};

document.getElementById('albumCoverSizeId3').onchange = function () {
    chrome.storage.local.set({
        albumCoverSizeId3: this.value
    }, backgroundPage.storage.load);
};

document.getElementById('shouldNumberLists').onchange = function () {
    chrome.storage.local.set({
        shouldNumberLists: !!this.value
    }, backgroundPage.storage.load);
};

document.getElementById('trackNameMaskBtnArtists').onclick = function () {
    handleTrackMaskButton(this, '#ИСПОЛНИТЕЛИ#');
    document.getElementById('trackNameMask').oninput();
};

document.getElementById('trackNameMaskBtnName').onclick = function () {
    handleTrackMaskButton(this, '#НАЗВАНИЕ#');
    document.getElementById('trackNameMask').oninput();
};

document.getElementById('trackNameMask').oninput = function () {
    var issetNameMarker = (this.value.indexOf('#НАЗВАНИЕ#') > -1);
    var issetArtistsMarker = (this.value.indexOf('#ИСПОЛНИТЕЛИ#') > -1);
    var buttonName = document.getElementById('trackNameMaskBtnName');
    var buttonArtists = document.getElementById('trackNameMaskBtnArtists');
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
        chrome.storage.local.set({
            trackNameMask: this.value
        }, backgroundPage.storage.load);
    }
};

document.getElementById('shouldNotifyAboutUpdates').onchange = function () {
    chrome.storage.local.set({
        shouldNotifyAboutUpdates: !!this.value
    }, backgroundPage.storage.load);
};

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
    document.getElementById('downloadThreadCount').value = bp.storage.current.downloadThreadCount;

    if (bp.storage.current.shouldDownloadCover) {
        document.getElementById('shouldDownloadCover').value = 'true';
    } else {
        document.getElementById('shouldDownloadCover').value = '';
    }
    document.getElementById('shouldDownloadCover').onchange();

    document.getElementById('albumCoverSize').value = bp.storage.current.albumCoverSize;
    document.getElementById('albumCoverSizeId3').value = bp.storage.current.albumCoverSizeId3;

    if (bp.storage.current.shouldNumberLists) {
        document.getElementById('shouldNumberLists').value = 'true';
    } else {
        document.getElementById('shouldNumberLists').value = '';
    }

    if (bp.storage.current.shouldNotifyAboutUpdates) {
        document.getElementById('shouldNotifyAboutUpdates').value = 'true';
    } else {
        document.getElementById('shouldNotifyAboutUpdates').value = '';
    }

    document.getElementById('trackNameMask').value = bp.storage.current.trackNameMask;
    document.getElementById('trackNameMask').oninput();
});
