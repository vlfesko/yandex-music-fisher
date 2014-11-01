var logger = {
    string: ''
};

logger.addMessage = function (msg, ignoreConsole) {
    logger.string += msg + "\r\n";
    if (!ignoreConsole) {
        console.error(msg);
    }
};

logger.download = function () {
    chrome.downloads.download({
        url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(logger.string),
        filename: 'log.txt'
    });
};

chrome.runtime.getPlatformInfo(function (platformInfo) {
    logger.addMessage('Yandex Music Fisher ' + chrome.runtime.getManifest().version, true);
    logger.addMessage(new Date(), true);
    logger.addMessage('Operating system: ' + platformInfo.os, true);
    logger.addMessage('Architecture: ' + platformInfo.arch, true);
});
