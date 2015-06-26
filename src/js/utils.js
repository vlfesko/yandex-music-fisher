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

// источник: http://jquerymy.com/js/md5.js
utils.md5 = (function () {
    function e(e, t) {
        var o = e[0], u = e[1], a = e[2], f = e[3];
        o = n(o, u, a, f, t[0], 7, -680876936);
        f = n(f, o, u, a, t[1], 12, -389564586);
        a = n(a, f, o, u, t[2], 17, 606105819);
        u = n(u, a, f, o, t[3], 22, -1044525330);
        o = n(o, u, a, f, t[4], 7, -176418897);
        f = n(f, o, u, a, t[5], 12, 1200080426);
        a = n(a, f, o, u, t[6], 17, -1473231341);
        u = n(u, a, f, o, t[7], 22, -45705983);
        o = n(o, u, a, f, t[8], 7, 1770035416);
        f = n(f, o, u, a, t[9], 12, -1958414417);
        a = n(a, f, o, u, t[10], 17, -42063);
        u = n(u, a, f, o, t[11], 22, -1990404162);
        o = n(o, u, a, f, t[12], 7, 1804603682);
        f = n(f, o, u, a, t[13], 12, -40341101);
        a = n(a, f, o, u, t[14], 17, -1502002290);
        u = n(u, a, f, o, t[15], 22, 1236535329);
        o = r(o, u, a, f, t[1], 5, -165796510);
        f = r(f, o, u, a, t[6], 9, -1069501632);
        a = r(a, f, o, u, t[11], 14, 643717713);
        u = r(u, a, f, o, t[0], 20, -373897302);
        o = r(o, u, a, f, t[5], 5, -701558691);
        f = r(f, o, u, a, t[10], 9, 38016083);
        a = r(a, f, o, u, t[15], 14, -660478335);
        u = r(u, a, f, o, t[4], 20, -405537848);
        o = r(o, u, a, f, t[9], 5, 568446438);
        f = r(f, o, u, a, t[14], 9, -1019803690);
        a = r(a, f, o, u, t[3], 14, -187363961);
        u = r(u, a, f, o, t[8], 20, 1163531501);
        o = r(o, u, a, f, t[13], 5, -1444681467);
        f = r(f, o, u, a, t[2], 9, -51403784);
        a = r(a, f, o, u, t[7], 14, 1735328473);
        u = r(u, a, f, o, t[12], 20, -1926607734);
        o = i(o, u, a, f, t[5], 4, -378558);
        f = i(f, o, u, a, t[8], 11, -2022574463);
        a = i(a, f, o, u, t[11], 16, 1839030562);
        u = i(u, a, f, o, t[14], 23, -35309556);
        o = i(o, u, a, f, t[1], 4, -1530992060);
        f = i(f, o, u, a, t[4], 11, 1272893353);
        a = i(a, f, o, u, t[7], 16, -155497632);
        u = i(u, a, f, o, t[10], 23, -1094730640);
        o = i(o, u, a, f, t[13], 4, 681279174);
        f = i(f, o, u, a, t[0], 11, -358537222);
        a = i(a, f, o, u, t[3], 16, -722521979);
        u = i(u, a, f, o, t[6], 23, 76029189);
        o = i(o, u, a, f, t[9], 4, -640364487);
        f = i(f, o, u, a, t[12], 11, -421815835);
        a = i(a, f, o, u, t[15], 16, 530742520);
        u = i(u, a, f, o, t[2], 23, -995338651);
        o = s(o, u, a, f, t[0], 6, -198630844);
        f = s(f, o, u, a, t[7], 10, 1126891415);
        a = s(a, f, o, u, t[14], 15, -1416354905);
        u = s(u, a, f, o, t[5], 21, -57434055);
        o = s(o, u, a, f, t[12], 6, 1700485571);
        f = s(f, o, u, a, t[3], 10, -1894986606);
        a = s(a, f, o, u, t[10], 15, -1051523);
        u = s(u, a, f, o, t[1], 21, -2054922799);
        o = s(o, u, a, f, t[8], 6, 1873313359);
        f = s(f, o, u, a, t[15], 10, -30611744);
        a = s(a, f, o, u, t[6], 15, -1560198380);
        u = s(u, a, f, o, t[13], 21, 1309151649);
        o = s(o, u, a, f, t[4], 6, -145523070);
        f = s(f, o, u, a, t[11], 10, -1120210379);
        a = s(a, f, o, u, t[2], 15, 718787259);
        u = s(u, a, f, o, t[9], 21, -343485551);
        e[0] = m(o, e[0]);
        e[1] = m(u, e[1]);
        e[2] = m(a, e[2]);
        e[3] = m(f, e[3]);
    }

    function t(e, t, n, r, i, s) {
        t = m(m(t, e), m(r, s));
        return m(t << i | t >>> 32 - i, n);
    }

    function n(e, n, r, i, s, o, u) {
        return t(n & r | ~n & i, e, n, s, o, u);
    }

    function r(e, n, r, i, s, o, u) {
        return t(n & i | r & ~i, e, n, s, o, u);
    }

    function i(e, n, r, i, s, o, u) {
        return t(n ^ r ^ i, e, n, s, o, u);
    }

    function s(e, n, r, i, s, o, u) {
        return t(r ^ (n | ~i), e, n, s, o, u);
    }

    function o(t) {
        var n = t.length, r = [1732584193, -271733879, -1732584194, 271733878], i;
        for (i = 64; i <= t.length; i += 64) {
            e(r, u(t.substring(i - 64, i)));
        }
        t = t.substring(i - 64);
        var s = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < t.length; i++) {
            s[i >> 2] |= t.charCodeAt(i) << (i % 4 << 3);
        }
        s[i >> 2] |= 128 << (i % 4 << 3);
        if (i > 55) {
            e(r, s);
            for (i = 0; i < 16; i++) {
                s[i] = 0;
            }
        }
        s[14] = n * 8;
        e(r, s);
        return r;
    }

    function u(e) {
        var t = [], n;
        for (n = 0; n < 64; n += 4) {
            t[n >> 2] = e.charCodeAt(n) + (e.charCodeAt(n + 1) << 8) + (e.charCodeAt(n + 2) << 16) + (e.charCodeAt(n + 3) << 24);
        }
        return t;
    }

    function c(e) {
        var t = "", n = 0;
        for (; n < 4; n++) {
            t += a[e >> n * 8 + 4 & 15] + a[e >> n * 8 & 15];
        }
        return t;
    }

    function h(e) {
        for (var t = 0; t < e.length; t++) {
            e[t] = c(e[t]);
        }
        return e.join("");
    }

    function d(e) {
//        return h(o(unescape(encodeURIComponent(e))));
        return h(o(e));
    }

    function m(e, t) {
        return e + t & 4294967295;
    }

    var a = "0123456789abcdef".split("");
    return d;
})();
