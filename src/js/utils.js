/* global chrome, storage */
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
            onFail('HTTP код: ' + xhr.status + '. URL: ' + url);
        }
    };
    xhr.onerror = function (e) {
        onFail('Ошибка AJAX. HTTP код: ' + e.target.status + ', URL: ' + url);
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

utils.parseArtists = function (artists) {
    return artists.map(function (artist) {
        return artist.name;
    }).join(', ');
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

utils.addId3Tag = function (oldArrayBuffer, frames) {
    var uint32ToUint8Array = function (uint32) {
        return [
            uint32 >>> 24,
            (uint32 >>> 16) & 0xff,
            (uint32 >>> 8) & 0xff,
            uint32 & 0xff
        ];
    };
    var i;
    var offset = 0;
    var frameSize = 0;
    var frameIterator = Object.keys(frames);
    for (i = 0; i < frameIterator.length; i++) {
        frames[frameIterator[i]] = frames[frameIterator[i]].toString();
        frameSize += frames[frameIterator[i]].length + 11; // 10 на заголовок + 1 на кодировку
    }
    var tagSize = frameSize + 10; // 10 на заголовок
    var arrayBuffer = new ArrayBuffer(oldArrayBuffer.byteLength + tagSize);
    var bufferWriter = new Uint8Array(arrayBuffer);

    var writeBytes = utils.stringToWin1251Array('ID3'); // тег
    writeBytes.push(3); // версия

    bufferWriter.set(writeBytes, offset);
    offset += writeBytes.length;

    offset++; // ревизия версии
    offset++; // флаги

    writeBytes = uint32ToUint8Array(tagSize); // размер тега
    bufferWriter.set(writeBytes, offset);
    offset += writeBytes.length;

    for (i = 0; i < frameIterator.length; i++) {
        writeBytes = utils.stringToWin1251Array(frameIterator[i]); // название фрейма
        bufferWriter.set(writeBytes, offset);
        offset += writeBytes.length;

        writeBytes = uint32ToUint8Array(frames[frameIterator[i]].length + 1); // размер фрейма
        bufferWriter.set(writeBytes, offset);
        offset += writeBytes.length;

        offset += 2; // флаги
        offset++; // кодировка

        writeBytes = utils.stringToWin1251Array(frames[frameIterator[i]]); // значение фрейма
        bufferWriter.set(writeBytes, offset);
        offset += writeBytes.length;
    }

    bufferWriter.set(new Uint8Array(oldArrayBuffer), offset);
    var blob = new Blob([arrayBuffer], {type: 'audio/mpeg'});
    return window.URL.createObjectURL(blob);
};

utils.stringToWin1251Array = function (string) {
    // todo: расширить карту, добавив преобразования ('é' в 'е' и подобные)
    var win1251Array = [];
    var map = {
        0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
        11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19,
        20: 20, 21: 21, 22: 22, 23: 23, 24: 24, 25: 25, 26: 26, 27: 27, 28: 28,
        29: 29, 30: 30, 31: 31, 32: 32, 33: 33, 34: 34, 35: 35, 36: 36, 37: 37,
        38: 38, 39: 39, 40: 40, 41: 41, 42: 42, 43: 43, 44: 44, 45: 45, 46: 46,
        47: 47, 48: 48, 49: 49, 50: 50, 51: 51, 52: 52, 53: 53, 54: 54, 55: 55,
        56: 56, 57: 57, 58: 58, 59: 59, 60: 60, 61: 61, 62: 62, 63: 63, 64: 64,
        65: 65, 66: 66, 67: 67, 68: 68, 69: 69, 70: 70, 71: 71, 72: 72, 73: 73,
        74: 74, 75: 75, 76: 76, 77: 77, 78: 78, 79: 79, 80: 80, 81: 81, 82: 82,
        83: 83, 84: 84, 85: 85, 86: 86, 87: 87, 88: 88, 89: 89, 90: 90, 91: 91,
        92: 92, 93: 93, 94: 94, 95: 95, 96: 96, 97: 97, 98: 98, 99: 99,
        100: 100, 101: 101, 102: 102, 103: 103, 104: 104, 105: 105, 106: 106,
        107: 107, 108: 108, 109: 109, 110: 110, 111: 111, 112: 112, 113: 113,
        114: 114, 115: 115, 116: 116, 117: 117, 118: 118, 119: 119, 120: 120,
        121: 121, 122: 122, 123: 123, 124: 124, 125: 125, 126: 126, 127: 127,
        1027: 129, 8225: 135, 1046: 198, 8222: 132, 1047: 199, 1168: 165,
        1048: 200, 1113: 154, 1049: 201, 1045: 197, 1050: 202, 1028: 170,
        160: 160, 1040: 192, 1051: 203, 164: 164, 166: 166, 167: 167, 169: 169,
        171: 171, 172: 172, 173: 173, 174: 174, 1053: 205, 176: 176, 177: 177,
        1114: 156, 181: 181, 182: 182, 183: 183, 8221: 148, 187: 187, 1029: 189,
        1056: 208, 1057: 209, 1058: 210, 8364: 136, 1112: 188, 1115: 158,
        1059: 211, 1060: 212, 1030: 178, 1061: 213, 1062: 214, 1063: 215,
        1116: 157, 1064: 216, 1065: 217, 1031: 175, 1066: 218, 1067: 219,
        1068: 220, 1069: 221, 1070: 222, 1032: 163, 8226: 149, 1071: 223,
        1072: 224, 8482: 153, 1073: 225, 8240: 137, 1118: 162, 1074: 226,
        1110: 179, 8230: 133, 1075: 227, 1033: 138, 1076: 228, 1077: 229,
        8211: 150, 1078: 230, 1119: 159, 1079: 231, 1042: 194, 1080: 232,
        1034: 140, 1025: 168, 1081: 233, 1082: 234, 8212: 151, 1083: 235,
        1169: 180, 1084: 236, 1052: 204, 1085: 237, 1035: 142, 1086: 238,
        1087: 239, 1088: 240, 1089: 241, 1090: 242, 1036: 141, 1041: 193,
        1091: 243, 1092: 244, 8224: 134, 1093: 245, 8470: 185, 1094: 246,
        1054: 206, 1095: 247, 1096: 248, 8249: 139, 1097: 249, 1098: 250,
        1044: 196, 1099: 251, 1111: 191, 1055: 207, 1100: 252, 1038: 161,
        8220: 147, 1101: 253, 8250: 155, 1102: 254, 8216: 145, 1103: 255,
        1043: 195, 1105: 184, 1039: 143, 1026: 128, 1106: 144, 8218: 130,
        1107: 131, 8217: 146, 1108: 186, 1109: 190
    };

    for (var i = 0; i < string.length; i++) {
        var code = string.charCodeAt(i);
        if (code in map) {
            win1251Array.push(map[code]);
        } else { // символ не поддерживается кодировкой win1251
            win1251Array.push('_'.charCodeAt(0));
        }
    }
    return win1251Array;
};

utils.bytesToStr = function (bytes) {
    var KiB = 1024;
    var MiB = 1024 * KiB;
    var GiB = 1024 * MiB;
    if (bytes < KiB) {
        return bytes + ' Б';
    } else if (bytes < MiB) {
        return (bytes / KiB).toFixed(2) + ' КиБ';
    } else if (bytes < GiB) {
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

utils.clearPath = function (path) {
    // пример: https://music.yandex.ru/album/1404751/track/12931197
    var clearedPath = path.replace(/[\\/:*?"<>|]/g, '_'); // Windows path illegals
    return clearedPath.replace(/\.$/, '_'); // точка в конце
};
