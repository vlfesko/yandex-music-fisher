/* global chrome */

(()=> {
    'use strict';

    let genreActiveTrack = {};
    window.genreActiveTrack = genreActiveTrack;

    genreActiveTrack.getUrl = () => {
        let emptyUrl = "";
        let url = "";
        let baseUrl = window.location.protocol + '//' + window.location.hostname;
        let linkContainer = document
            .getElementsByClassName("player-controls__track player-controls__track_shown");
        if (linkContainer.length != 1) {
            return emptyUrl;
        }
        linkContainer = linkContainer[0];
        let trackPageLink = linkContainer.getElementsByClassName("track__title link");
        if (trackPageLink.length != 1) {
            return emptyUrl;
        }
        trackPageLink = trackPageLink[0];
        return baseUrl + trackPageLink.getAttribute("href");
    };

    chrome.runtime.onMessage.addListener(
       function (request, sender, sendResponseCallback) {
           let response = {};
           switch (request.command) {
               case "getActiveTrackUrl":
                   response["url"] = genreActiveTrack.getUrl();
                   break;
           }
           response["url"] = genreActiveTrack.getUrl();
           sendResponseCallback(response);
       }
    );

})();
