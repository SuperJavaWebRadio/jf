const RADIO_NAME = 'Super Java Web Rádio';
const URL_STREAMING = 'https://stream.zeno.fm/ego2eudayomtv';
const url = 'https://zeno.fm';
let showHistory = true;

var isIntentionalPause = false;
var reconnectAttempts = 0;
var lastSongTitle = '';

window.onload = function () {
    var page = new Page();
    page.changeTitlePage();
    page.setVolume();

    var radioName = document.getElementById('radioName');
    if (radioName) radioName.textContent = RADIO_NAME;

    var player = new Player();
    player.play();

    localStorage.removeItem('musicHistory');
    connectToEventSource();
};

var lyricsCache = {};

function fetchLyrics(currentArtist, currentSong) {
    var cacheKey = (currentArtist + ' - ' + currentSong).toLowerCase();
    if (lyricsCache[cacheKey]) {
        return lyricsCache[cacheKey];
    }

    var promise = (async function () {
        var lyric = null;
        try {
            var response = await fetch('https://lyrics.ovh' + encodeURIComponent(currentArtist) + '/' + encodeURIComponent(currentSong));
            var data = await response.json();
            if (data && data.lyrics) lyric = data.lyrics;
        } catch (error) {}

        if (!lyric) {
            try {
                var responseGet = await fetch('https://lrclib.net' + encodeURIComponent(currentArtist) + '&track_name=' + encodeURIComponent(currentSong));
                if (responseGet.ok) {
                    var dataGet = await responseGet.json();
                    lyric = dataGet.plainLyrics || dataGet.syncedLyrics || null;
                }
            } catch (error) {}
        }

        if (!lyric) {
            try {
                var responseSearch = await fetch('https://lrclib.net' + encodeURIComponent(currentSong) + '&artist_name=' + encodeURIComponent(currentArtist));
                if (responseSearch.ok) {
                    var results = await responseSearch.json();
                    var hit = Array.isArray(results) && results.find(function (r) { return r.plainLyrics || r.syncedLyrics; });
                    if (hit) lyric = hit.plainLyrics || hit.syncedLyrics;
                }
            } catch (error) {}
        }

        return lyric;
    })();

    lyricsCache[cacheKey] = promise;
    return promise;
}

class Page {
    constructor() {
        this.changeTitlePage = function (title = RADIO_NAME) {
            document.title = title;
        };

        this.refreshCurrentSong = function (song, artist) {
            var currentSong = document.getElementById('currentSong');
            var currentArtist = document.getElementById('currentArtist');

            if (currentSong && song !== currentSong.innerHTML) {
                currentSong.className = 'animated flipInY text-uppercase';
                currentSong.innerHTML = song;

                if (currentArtist) {
                    currentArtist.className = 'animated flipInY text-capitalize';
                    currentArtist.innerHTML = artist;
                }

                var lyricsSong = document.getElementById('lyricsSong');
                if (lyricsSong) lyricsSong.innerHTML = song + ' - ' + artist;

                setTimeout(function () {
                    currentSong.className = 'text-uppercase';
                    if (currentArtist) currentArtist.className = 'text-capitalize';
                }, 2000);
            }
        };

        this.refreshCover = function (song = '', artist = '') {
            var oldScript = document.getElementById('deezer-jsonp');
            if (oldScript) oldScript.remove();

            const script = document.createElement('script');
            script.id = 'deezer-jsonp';
            script.src = 'https://deezer.com' + encodeURIComponent(artist + ' ' + song) + '&output=jsonp&callback=handleDeezerResponse';
            document.body.appendChild(script);
        };

        this.changeVolumeIndicator = function (volume) {
            var volInd = document.getElementById('volIndicator');
            if (volInd) volInd.innerHTML = volume;

            if (typeof (Storage) !== 'undefined') {
                localStorage.setItem('volume', volume);
            }
        };

        this.setVolume = function () {
            if (typeof (Storage) !== 'undefined') {
                var volumeLocalStorage = (!localStorage.getItem('volume')) ? 80 : localStorage.getItem('volume');
                var volSlider = document.getElementById('volume');
                var volInd = document.getElementById('volIndicator');
                if (volSlider) volSlider.value = volumeLocalStorage;
                if (volInd) volInd.innerHTML = volumeLocalStorage;
            }
        };

        this.refreshLyric = async function (currentSong, currentArtist) {
            var lyric = await fetchLyrics(currentArtist, currentSong);
            var openLyric = document.querySelector('.lyrics');
            if (!openLyric) return;

            if (lyric) {
                var lyricBox = document.getElementById('lyric');
                if (lyricBox) lyricBox.innerHTML = lyric.replace(/\n/g, '<br />');
                openLyric.style.opacity = "1";
                openLyric.setAttribute('data-toggle', 'modal');
            } else {
                openLyric.style.opacity = "0.3";
                openLyric.removeAttribute('data-toggle');

                var modalLyric = document.getElementById('modalLyrics');
                if (modalLyric) {
                    modalLyric.style.display = "none";
                    modalLyric.setAttribute('aria-hidden', 'true');
                }
            }
        };
    }
}

var audio = new Audio(URL_STREAMING);

class Player {
    constructor() {
        this.play = function () {
            isIntentionalPause = false;
            var playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(function () {});
            }

            var volEl = document.getElementById('volume');
            var defaultVolume = volEl ? volEl.value : 80;

            if (typeof (Storage) !== 'undefined' && localStorage.getItem('volume') !== null) {
                audio.volume = intToDecimal(localStorage.getItem('volume'));
            } else {
                audio.volume = intToDecimal(defaultVolume);
            }
            var volInd = document.getElementById('volIndicator');
            if (volInd) volInd.innerHTML = defaultVolume;
        };

        this.pause = function () {
            isIntentionalPause = true;
            audio.pause();
        };
    }
}

function setPlayerIcon(iconClass, label) {
    var botao = document.getElementById('playerButton');
    var bplay = document.getElementById('buttonPlay');
    if (botao) botao.className = iconClass;
    if (bplay && bplay.firstChild) bplay.firstChild.data = label;
}

audio.onplay = function () {
    reconnectAttempts = 0;
    setPlayerIcon('fa fa-pause', 'PAUSAR');
};

audio.onpause = function () {
    if (!isIntentionalPause && reconnectAttempts > 0) return;
    setPlayerIcon('fa fa-play', 'PLAY');
};

function togglePlay() {
    var player = new Player();
    if (audio.paused) {
        audio.src = URL_STREAMING;
        player.play();
    } else {
        player.pause();
    }
}

function intToDecimal(vol) {
    return parseFloat(vol) / 100;
}

document.addEventListener('DOMContentLoaded', function () {
    var volumeControl = document.getElementById('volume');
    if (volumeControl) {
        volumeControl.addEventListener('input', function () {
            var page = new Page();
            audio.volume = intToDecimal(this.value);
            page.changeVolumeIndicator(this.value);
        });
    }
});

function handleDeezerResponse(data) {
    var coverArt = document.getElementById('currentCoverArt');
    var bgCover = document.getElementById('bgCover');
    var coverUrl = 'img/cover.png';

    if (data && data.data && data.data.length > 0 && data.data[0].album) {
        coverUrl = data.data[0].album.cover_xl || data.data[0].album.cover_big || data.data[0].album.cover_medium || 'img/cover.png';
    }

    if (coverArt) coverArt.style.backgroundImage = 'url("' + coverUrl + '")';
    if (bgCover) bgCover.style.backgroundImage = 'url("' + coverUrl + '")';
}

function connectToEventSource() {
    if (typeof (EventSource) === 'undefined') return;

    var source = new EventSource(url);
    source.onmessage = function (event) {
        try {
            var data = JSON.parse(event.data);
            if (!data || !data.streamTitle) return;

            var streamTitle = data.streamTitle.trim();
            if (streamTitle === lastSongTitle) return;
            lastSongTitle = streamTitle;

            var parts = streamTitle.split(' - ');
            var artist = parts.length > 1 ? parts[0].trim() : RADIO_NAME;
            var song = parts.length > 1 ? parts.slice(1).join(' - ').trim() : streamTitle;

            var page = new Page();
            page.refreshCurrentSong(song, artist);
            page.refreshCover(song, artist);
            page.refreshLyric(song, artist);
            page.changeTitlePage(song + ' - ' + artist);

            if (showHistory) {
                updateHistory(song, artist);
            }
        } catch (e) {}
    };

    source.onerror = function () {
        source.close();
        setTimeout(connectToEventSource, 5000);
    };
}

function updateHistory(song, artist) {
    var historicSection = document.querySelector('.historic');
    if (historicSection) historicSection.classList.remove('hidden');

    var history = JSON.parse(localStorage.getItem('musicHistory') || '[]');
    if (history.length > 0 && history[0].song === song && history[0].artist === artist) return;

    history.unshift({ song: song, artist: artist });
