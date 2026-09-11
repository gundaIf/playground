/* Shared Kochi sky. Sets data-season and data-theme, fires weatherchange. */
(function (global) {
  var root = document.documentElement;
  var KEY_THEME = 'playground-theme';
  var KEY_PIN = 'season-pin';
  var KEY_CACHE = 'weather-cache';

  function applyTheme() {
    var chosen = null;
    try { chosen = localStorage.getItem(KEY_THEME); } catch (e) {}
    var dark = chosen ? chosen === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  function applySeason(season, storm) {
    root.setAttribute('data-season', season || 'clear');
    if (storm) root.setAttribute('data-storm', 'true');
    else root.removeAttribute('data-storm');
    try { global.dispatchEvent(new CustomEvent('weatherchange')); } catch (e) {}
    var word = document.getElementById('sky-word');
    if (word) {
      word.textContent = season === 'monsoon' ? (storm ? 'storm' : 'grey') : 'clear skies';
    }
  }

  function codeToSeason(code) {
    if (typeof code !== 'number') return { season: 'clear', storm: false };
    if (code >= 95) return { season: 'monsoon', storm: true };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
      return { season: 'monsoon', storm: false };
    }
    return { season: 'clear', storm: false };
  }

  function fetchSky() {
    var pin = null;
    try { pin = localStorage.getItem(KEY_PIN); } catch (e) {}
    if (pin) { applySeason(pin, pin === 'monsoon'); return; }

    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(KEY_CACHE) || 'null'); } catch (e) {}
    if (cached && cached.season && Date.now() - cached.t < 30 * 60 * 1000) {
      applySeason(cached.season, cached.storm);
    } else {
      applySeason('clear', false);
    }

    fetch('https://api.open-meteo.com/v1/forecast?latitude=9.9312&longitude=76.2673&current=weather_code&timezone=Asia%2FKolkata')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var code = d && d.current && d.current.weather_code;
        var mood = codeToSeason(code);
        try {
          localStorage.setItem(KEY_CACHE, JSON.stringify({
            season: mood.season, storm: mood.storm, t: Date.now()
          }));
        } catch (e) {}
        applySeason(mood.season, mood.storm);
      })
      .catch(function () {});
  }

  function toggleTheme() {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY_THEME, next); } catch (e) {}
  }

  applyTheme();
  fetchSky();

  global.Sky = {
    season: function () { return root.getAttribute('data-season') || 'clear'; },
    storm: function () { return root.getAttribute('data-storm') === 'true'; },
    toggleTheme: toggleTheme,
    ink: function () { return getComputedStyle(root).getPropertyValue('--ink').trim() || '28, 31, 38'; },
    bg: function () { return getComputedStyle(root).getPropertyValue('--bg').trim(); }
  };
})(window);
