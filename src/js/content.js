/* global chrome */

(()=> {
    'use strict';

    var getCurrentTrackUrl = () => {
        let emptyUrl = '';
        let baseUrl = location.protocol + '//' + location.hostname;
        let linkContainer = document.getElementsByClassName('player-controls__track player-controls__track_shown');
        if (!linkContainer.length) {
            return emptyUrl;
        }
        linkContainer = linkContainer[0];
        let trackPageLink = linkContainer.getElementsByClassName('track__title link');
        if (!trackPageLink.length) {
            return emptyUrl;
        }
        trackPageLink = trackPageLink[0];
        return baseUrl + trackPageLink.getAttribute('href');
    };

    chrome.runtime.onMessage.addListener(function (message, sender, sendResponseCallback) {
        let response = {};
        if (message === 'getCurrentTrackUrl') {
            response.url = getCurrentTrackUrl();
        }
        sendResponseCallback(response);
    });

})();
