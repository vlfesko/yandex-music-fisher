/* global chrome, storage, ga */
'use strict';

var utils = {};

utils.ajax = function (url, type, onSuccess, onFail, onProgress) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = type;
    xhr.onload = function () {
        if (xhr.status === 200) {
            onSuccess(xhr.response);
        } else {
            onFail(xhr.statusText + ' (' + xhr.status + ')', url);
        }
    };
    xhr.onerror = function () {
        onFail('Ошибка при запросе', url);
    };
    if (onProgress) {
        xhr.onprogress = onProgress;
    }
    xhr.send();
    return xhr;
};

utils.getUrlInfo = function (url) {
    var info = {};
    var parts = url.replace(/\?.*/, '').split('/');
    //["http:", "", "music.yandex.ru", "users", "furfurmusic", "playlists", "1000"]
    info.isYandexMusic = (
        parts[2] === 'music.yandex.ru' ||
        parts[2] === 'music.yandex.ua' ||
        parts[2] === 'music.yandex.kz' ||
        parts[2] === 'music.yandex.by'
    );
    if (info.isYandexMusic) {
        storage.current.domain = parts[2].split('.')[2];
    } else {
        return info;
    }
    info.isPlaylist = (parts[3] === 'users' && parts[5] === 'playlists' && !!parts[6]);
    info.isTrack = (parts[3] === 'album' && parts[5] === 'track' && !!parts[6]);
    info.isAlbum = (parts[3] === 'album' && !!parts[4]);
    info.isArtist = (parts[3] === 'artist' && !!parts[4]);
    if (info.isPlaylist) {
        info.username = parts[4];
        info.playlistId = parts[6];
    } else if (info.isTrack) {
        info.trackId = parts[6];
    } else if (info.isAlbum) {
        info.albumId = parts[4];
    } else if (info.isArtist) {
        info.artistId = parts[4];
    }
    return info;
};

utils.parseArtists = function (allArtists, separator) {
    var artists = [];
    var composers = [];
    allArtists.forEach(function (artist) {
        if (artist.composer) { // пример https://music.yandex.ru/album/717747/track/6672611
            composers.push(artist.name);
        } else if (artist.various) { // пример https://music.yandex.ru/album/718010/track/6570232
            artists.push('Various Artists');
        } else {
            artists.push(artist.name);
        }
    });
    return {
        artists: artists.join(separator) || composers.join(separator),
        composers: composers.join(separator)
    };
};

utils.updateTabIcon = function (tab) {
    var page = utils.getUrlInfo(tab.url);
    var iconPath = 'img/black.png';
    if (page.isPlaylist) {
        iconPath = 'img/green.png';
    } else if (page.isTrack) {
        iconPath = 'img/blue.png';
    } else if (page.isAlbum) {
        iconPath = 'img/yellow.png';
    } else if (page.isArtist) {
        iconPath = 'img/pink.png';
    }
    chrome.browserAction.setIcon({
        tabId: tab.id,
        path: iconPath
    });
};

utils.addId3Tag = function (oldArrayBuffer, framesObject) {
    function uint32ToUint8Array(uint32) {
        return [
            uint32 >>> 24,
            (uint32 >>> 16) & 0xff,
            (uint32 >>> 8) & 0xff,
            uint32 & 0xff
        ];
    }

    function uint28ToUint7Array(uint28) {
        return [
            uint28 >>> 21,
            (uint28 >>> 14) & 0x7f,
            (uint28 >>> 7) & 0x7f,
            uint28 & 0x7f
        ];
    }

    function framesObjectToArray(framesObject) {
        var frames = [];
        var frameIterator = Object.keys(framesObject);
        for (var i = 0; i < frameIterator.length; i++) {
            var frameValue = framesObject[frameIterator[i]];
            if (typeof(frameValue) === 'number') {
                frames.push({
                    name: frameIterator[i],
                    value: frameValue,
                    size: 10 + frameValue.toString().length + 1 // заголовок + фрейм + кодировка
                });
            } else if (typeof(frameValue) === 'string') {
                frames.push({
                    name: frameIterator[i],
                    value: frameValue,
                    size: 10 + (frameValue.length * 2) + 1 + 2 // заголовок + фрейм * 2 байта + кодировка + BOM
                });
            } else if (frameIterator[i] === 'APIC') {
                var mimeType = 'image/jpeg';
                frames.push({
                    name: frameIterator[i],
                    value: frameValue,
                    mimeType: mimeType,
                    size: 10 + 1 + mimeType.length + 1 + 1 + 1 + frameValue.byteLength
                    // заголовок + кодировка + MIME type + 0 + тип картинки + 0 + картинка
                });
            }
        }
        return frames;
    }

    var offset = 0;
    var padding = 4096;
    var frames = framesObjectToArray(framesObject);
    var totalFrameSize = frames.reduce(function (totalSize, frame) {
        return totalSize + frame.size;
    }, 0);
    var tagSize = totalFrameSize + padding + 10; // 10 на заголовок тега
    var arrayBuffer = new ArrayBuffer(oldArrayBuffer.byteLength + tagSize);
    var bufferWriter = new Uint8Array(arrayBuffer);
    var coder8 = new TextEncoder('utf-8');
    var coder16 = new TextEncoder('utf-16le');

    var writeBytes = [0x49, 0x44, 0x33, 0x03]; // тег (ID3) и версия (3)
    bufferWriter.set(writeBytes, offset);
    offset += writeBytes.length;

    offset++; // ревизия версии
    offset++; // флаги

    writeBytes = uint28ToUint7Array(tagSize); // размер тега
    bufferWriter.set(writeBytes, offset);
    offset += writeBytes.length;

    frames.forEach(function (frame) {
        writeBytes = coder8.encode(frame.name); // название фрейма
        bufferWriter.set(writeBytes, offset);
        offset += writeBytes.length;

        writeBytes = uint32ToUint8Array(frame.size - 10); // размер фрейма (без заголовка)
        bufferWriter.set(writeBytes, offset);
        offset += writeBytes.length;

        offset += 2; // флаги

        if (typeof(frame.value) === 'number') {
            offset++; // кодировка

            writeBytes = coder8.encode(frame.value); // значение фрейма
            bufferWriter.set(writeBytes, offset);
            offset += writeBytes.length;
        } else if (typeof(frame.value) === 'string') {
            writeBytes = [0x01, 0xff, 0xfe]; // кодировка и BOM
            bufferWriter.set(writeBytes, offset);
            offset += writeBytes.length;

            writeBytes = coder16.encode(frame.value); // значение фрейма
            bufferWriter.set(writeBytes, offset);
            offset += writeBytes.length;
        } else if (frame.name === 'APIC') {
            offset++; // кодировка

            writeBytes = coder8.encode(frame.mimeType); // MIME type
            bufferWriter.set(writeBytes, offset);
            offset += writeBytes.length;

            writeBytes = [0x00, 0x03, 0x00]; // разделитель, тип картинки, разделитель
            bufferWriter.set(writeBytes, offset);
            offset += writeBytes.length;

            bufferWriter.set(new Uint8Array(frame.value), offset); // картинка
            offset += frame.value.byteLength;
        }
    });

    offset += padding; // пустое место для перезаписи фреймов
    bufferWriter.set(new Uint8Array(oldArrayBuffer), offset);
    var blob = new Blob([arrayBuffer], {type: 'audio/mpeg'});
    return window.URL.createObjectURL(blob);
};

utils.bytesToStr = function (bytes) {
    var KiB = 1024;
    var MiB = 1024 * KiB;
    var GiB = 1024 * MiB;
    if (bytes < GiB) {
        return (bytes / MiB).toFixed(2) + ' МиБ';
    } else {
        return (bytes / GiB).toFixed(2) + ' ГиБ';
    }
};

utils.addExtraZeros = function (val, max) {
    var valLength = val.toString().length;
    var maxLength = max.toString().length;
    var diff = maxLength - valLength;
    var zeros = '';
    for (var i = 0; i < diff; i++) {
        zeros += '0';
    }
    return zeros + val;
};

utils.durationToStr = function (duration) {
    var seconds = Math.floor(duration / 1000);
    var minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    var hours = Math.floor(minutes / 60);
    minutes -= hours * 60;
    return hours + ':' + utils.addExtraZeros(minutes, 10) + ':' + utils.addExtraZeros(seconds, 10);
};

utils.clearPath = function (path, isDir) {
    path = path.replace(/"/g, "''"); // двойные кавычки в одинарные
    path = path.replace(/\t/g, ' '); // таб в пробел (https://music.yandex.ru/album/718010/track/6570232)
    path = path.replace(/[\\/:*?<>|~]/g, '_'); // запрещённые символы в винде
    if (isDir) {
        path = path.replace(/(\.| )$/, '_'); // точка или пробел в конце
        // пример папки с точкой в конце https://music.yandex.ru/album/1288439/
        // пример папки с пробелом в конце https://music.yandex.ru/album/62046/
    }
    return path;
};

utils.logError = function (error, details) {
    console.error(error, details);
    ga('send', 'event', 'error', error, details);
};
