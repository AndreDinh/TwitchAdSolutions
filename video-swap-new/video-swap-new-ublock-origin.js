(function() {
    if ( /(^|\.)twitch\.tv$/.test(document.location.hostname) === false ) { return; }
    var ourTwitchAdSolutionsVersion = 2;
    if (window.twitchAdSolutionsVersion && window.twitchAdSolutionsVersion >= ourTwitchAdSolutionsVersion) {
        console.log("skipping video-swap-new as there's another script active. ourVersion:" + ourTwitchAdSolutionsVersion + " activeVersion:" + window.twitchAdSolutionsVersion);
        window.twitchAdSolutionsVersion = ourTwitchAdSolutionsVersion;
        return;
    }
    window.twitchAdSolutionsVersion = ourTwitchAdSolutionsVersion;

    function declareOptions(scope) {
        // Modified options to enforce high quality
        scope.OPT_MODE_STRIP_AD_SEGMENTS = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED = true;
        scope.OPT_MODE_NOTIFY_ADS_WATCHED_MIN_REQUESTS = false;
        scope.OPT_BACKUP_PLAYER_TYPE = 'site'; // Changed from 'autoplay' to 'site'
        scope.OPT_BACKUP_PLATFORM = 'web'; // Changed from 'ios' to 'web'
        scope.OPT_REGULAR_PLAYER_TYPE = 'site';
        scope.OPT_ACCESS_TOKEN_PLAYER_TYPE = 'site'; // Added to force high quality
        scope.OPT_SHOW_AD_BANNER = true;
        scope.AD_SIGNIFIER = 'stitched-ad';
        scope.LIVE_SIGNIFIER = ',live';
        scope.CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        scope.StreamInfos = [];
        scope.StreamInfosByUrl = [];
        scope.CurrentChannelNameFromM3U8 = null;
        scope.gql_device_id = null;
        scope.ClientIntegrityHeader = null;
        scope.AuthorizationHeader = null;
    }

    // Modified function to always select highest quality stream
    async function processM3U8(url, textStr, realFetch) {
        var streamInfo = StreamInfosByUrl[url];
        if (streamInfo == null) {
            console.log('Unknown stream url ' + url);
            return textStr;
        }

        if (!OPT_MODE_STRIP_AD_SEGMENTS) {
            return textStr;
        }

        // Always select the highest quality stream
        if (textStr.includes('#EXT-X-STREAM-INF')) {
            const lines = textStr.split('\n');
            let maxBandwidth = 0;
            let highestQualityUrl = '';
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('#EXT-X-STREAM-INF')) {
                    const bandwidth = parseInt(lines[i].match(/BANDWIDTH=(\d+)/)[1]);
                    if (bandwidth > maxBandwidth && lines[i + 1]) {
                        maxBandwidth = bandwidth;
                        highestQualityUrl = lines[i + 1];
                    }
                }
            }
            
            if (highestQualityUrl) {
                const response = await realFetch(highestQualityUrl);
                if (response.status === 200) {
                    return await response.text();
                }
            }
        }

        var haveAdTags = textStr.includes(AD_SIGNIFIER);
        if (streamInfo.UseBackupStream) {
            if (streamInfo.Encodings == null) {
                console.log('Found backup stream but not main stream?');
                streamInfo.UseBackupStream = false;
                postMessage({key:'UboReloadPlayer'});
                return '';
            } else {
                // Select highest quality backup stream
                var streamM3u8Url = streamInfo.Encodings.match(/^https:.*\.m3u8$/m)[0];
                var streamM3u8Response = await realFetch(streamM3u8Url);
                if (streamM3u8Response.status == 200) {
                    var streamM3u8 = await streamM3u8Response.text();
                    // Rest of the backup stream handling...
                    if (!streamM3u8.includes(AD_SIGNIFIER)) {
                        console.log('No more ads on main stream. Triggering player reload to go back to main stream...');
                        streamInfo.UseBackupStream = false;
                        postMessage({key:'UboHideAdBanner'});
                        postMessage({key:'UboReloadPlayer'});
                    }
                }
            }
        } else if (haveAdTags) {
            onFoundAd(streamInfo, textStr, true);
        } else {
            postMessage({key:'UboHideAdBanner'});
        }

        // Always try to get highest quality stream when dealing with ads
        if (haveAdTags && streamInfo.BackupEncodings != null) {
            var streamM3u8Url = streamInfo.BackupEncodings.match(/^https:.*\.m3u8.*$/m)[0];
            var streamM3u8Response = await realFetch(streamM3u8Url);
            if (streamM3u8Response.status == 200) {
                textStr = await streamM3u8Response.text();
            }
        }

        return textStr;
    }

    // Modified function to force high quality settings
    function reloadTwitchPlayer(isSeek, isPausePlay) {
        // ... [previous code remains the same until player state handling]
        
        const lsKeyQuality = 'video-quality';
        // Force highest quality setting
        localStorage.setItem(lsKeyQuality, JSON.stringify({default:'chunked'}));
        
        if (player?.core?.state) {
            localStorage.setItem(lsKeyMuted, JSON.stringify({default:player.core.state.muted}));
            localStorage.setItem(lsKeyVolume, player.core.state.volume);
        }
        
        // Force highest quality in player state
        if (player?.core?.state?.quality) {
            player.core.state.quality.group = 'chunked';
        }
        
        playerState.setSrc({ isNewMediaPlayerInstance: true, refreshAccessToken: true });
        
        // Ensure quality stays at highest after reload
        setTimeout(() => {
            localStorage.setItem(lsKeyQuality, JSON.stringify({default:'chunked'}));
        }, 3000);
    }

    // Rest of the original code...
    // [Include all other functions from the original script]

    window.reloadTwitchPlayer = reloadTwitchPlayer;
    declareOptions(window);
    hookWindowWorker();
    hookFetch();
    if (document.readyState === "complete" || document.readyState === "loaded" || document.readyState === "interactive") {
        onContentLoaded();
    } else {
        window.addEventListener("DOMContentLoaded", function() {
            onContentLoaded();
        });
    }
})();
