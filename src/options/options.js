/* global chrome */
'use strict';

var backgroundPage;

document.getElementById('downloadThreadCount').onchange = function () {
    chrome.storage.local.set({
        downloadThreadCount: parseInt(this.value)
    }, backgroundPage.storage.load);
};

document.getElementById('shouldDownloadCover').onchange = function () {
    var shouldDownloadCover = !!this.value;
    var albumCoverSizeElem = document.getElementById('albumCoverSize');
    if (shouldDownloadCover) {
        albumCoverSizeElem.removeAttribute('disabled');
    } else {
        albumCoverSizeElem.setAttribute('disabled', 'disabled');
    }
    chrome.storage.local.set({
        shouldDownloadCover: shouldDownloadCover
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

    if (bp.storage.current.shouldNotifyAboutUpdates) {
        document.getElementById('shouldNotifyAboutUpdates').value = 'true';
    } else {
        document.getElementById('shouldNotifyAboutUpdates').value = '';
    }
});
