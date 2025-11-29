// API Configuration
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const METEO_BASE = "https://api.open-meteo.com/v1/forecast";

// Global State
let unit = "metric";
let theme = localStorage.getItem("theme") || "light";
let city = "Jakarta";
let coords = null;
let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

// Weather Code Mapping
const WEATHER_MAP = {
    0: { text: "Cerah", icon: "☀️" },
    1: { text: "Cerah berawan", icon: "🌤️" },
    2: { text: "Berawan sebagian", icon: "⛅" },
    3: { text: "Berawan", icon: "☁️" },
    45: { text: "Berkabut", icon: "🌫️" },
    48: { text: "Berkabut tebal", icon: "🌫️" },
    51: { text: "Gerimis", icon: "🌦️" },
    53: { text: "Gerimis ringan", icon: "🌦️" },
    55: { text: "Gerimis lebat", icon: "🌧️" },
    61: { text: "Hujan", icon: "🌧️" },
    63: { text: "Hujan sedang", icon: "🌧️" },
    65: { text: "Hujan lebat", icon: "🌧️" },
    71: { text: "Salju", icon: "❄️" },
    73: { text: "Salju sedang", icon: "❄️" },
    75: { text: "Salju lebat", icon: "❄️" },
    80: { text: "Hujan ringan", icon: "🌦️" },
    81: { text: "Hujan sedang", icon: "🌧️" },
    82: { text: "Hujan lebat", icon: "🌧️" },
    95: { text: "Badai", icon: "⛈️" },
};

// Utility Functions
function cToF(c) { return (c * 9) / 5 + 32; }

function msToMph(ms) { return ms * 2.23694; }

function displayTemp(c) {
    return unit === "metric" ? `${Math.round(c)}°C` : `${Math.round(cToF(c))}°F`;
}

function displayWind(ms) {
    const speed = unit === "metric" ? ms : msToMph(ms);
    const unitText = unit === "metric" ? "m/s" : "mph";
    return `${speed.toFixed(1)} ${unitText}`;
}

// DOM Elements
const el = {
    cityName: document.getElementById("cityName"),
    coords: document.getElementById("coords"),
    timestamp: document.getElementById("timestamp"),
    temp: document.getElementById("temp"),
    condition: document.getElementById("condition"),
    humidity: document.getElementById("humidity"),
    wind: document.getElementById("wind"),
    error: document.getElementById("error"),
    forecastList: document.getElementById("forecastList"),
    searchInput: document.getElementById("searchInput"),
    suggestions: document.getElementById("suggestions"),
    favoriteList: document.getElementById("favoriteList"),
    favBtn: document.getElementById("favBtn"),
    searchBtn: document.getElementById("searchBtn"),
    unitBtn: document.getElementById("unitBtn"),
    themeBtn: document.getElementById("themeBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
};

// Apply theme on start
if (theme === "dark") {
    document.body.classList.add("dark-theme");
    el.themeBtn.querySelector('.theme-icon').textContent = '☀️';
}

// Initialize Map
let map = L.map("map").setView([-6.2, 106.8], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);
let marker = null;

function updateMap(lat, lon) {
    map.setView([lat, lon], 11);
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lon]).addTo(map)
        .bindPopup(coords.name)
        .openPopup();
}

// Show Error
function showError(message) {
    el.error.textContent = message;
    el.error.classList.add("active");
    setTimeout(() => el.error.classList.remove("active"), 5000);
}

// Fetch City
async function fetchCity() {
    el.error.classList.remove("active");

    try {
        const res = await fetch(`${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=1&country=ID`);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            showError("Kota tidak ditemukan di Indonesia.");
            return;
        }

        const c = data.results[0];
        coords = { lat: c.latitude, lon: c.longitude, name: c.name, country: c.country || "Indonesia" };

        el.cityName.textContent = `${c.name}, ${coords.country}`;
        el.coords.textContent = `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`;

        updateMap(c.latitude, c.longitude);
        fetchWeather();
    } catch (e) {
        showError("Gagal mencari kota. Cek koneksi internet Anda.");
        console.error("Error fetching city:", e);
    }
}

// Fetch Weather
async function fetchWeather() {
    if (!coords) return;

    try {
        const url = `${METEO_BASE}?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
        const res = await fetch(url);

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        const w = data.current_weather;

        // Current Weather
        el.timestamp.textContent = new Date(w.time).toLocaleString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        el.temp.textContent = displayTemp(w.temperature);
        el.wind.textContent = displayWind(w.windspeed);
        el.humidity.textContent = "-";

        const wm = WEATHER_MAP[w.weathercode] || { text: "Unknown", icon: "❔" };
        el.condition.textContent = `${wm.icon} ${wm.text}`;

        // 5-Day Forecast
        el.forecastList.innerHTML = "";
        data.daily.time.slice(0, 5).forEach((date, i) => {
            const weather = WEATHER_MAP[data.daily.weathercode[i]] || { text: "Unknown", icon: "❔" };
            const d = document.createElement("div");
            d.className = "forecast-day";
            d.innerHTML = `
                <strong>${new Date(date).toLocaleDateString("id-ID", { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                <div class="icon">${weather.icon}</div>
                <div class="desc">${weather.text}</div>
                <div class="temps">
                    <span class="temp-max">Max: ${displayTemp(data.daily.temperature_2m_max[i])}</span><br>
                    <span class="temp-min">Min: ${displayTemp(data.daily.temperature_2m_min[i])}</span>
                </div>
            `;
            el.forecastList.appendChild(d);
        });
    } catch (e) {
        showError("Gagal memuat data cuaca.");
        console.error("Error fetching weather:", e);
    }
}

// Favorites
function saveFavorites() {
    localStorage.setItem("favorites", JSON.stringify(favorites));
}

function renderFavorites() {
    el.favoriteList.innerHTML = "";

    if (favorites.length === 0) {
        el.favoriteList.innerHTML = '<p class="no-favorites">Belum ada kota favorit</p>';
        return;
    }

    favorites.forEach((fav) => {
        const div = document.createElement("div");
        div.className = "favorite-item";
        div.innerHTML = `
            <span>⭐ ${fav.name}</span>
            <button class="load-btn" data-city="${fav.name}">Load</button>
            <button class="del-btn" data-city="${fav.name}">❌</button>
        `;
        el.favoriteList.appendChild(div);
    });

    document.querySelectorAll(".load-btn").forEach((btn) => {
        btn.onclick = () => {
            city = btn.dataset.city;
            fetchCity();
        };
    });

    document.querySelectorAll(".del-btn").forEach((btn) => {
        btn.onclick = () => {
            favorites = favorites.filter((x) => x.name !== btn.dataset.city);
            saveFavorites();
            renderFavorites();
        };
    });
}

function addFavorite() {
    if (!coords) {
        showError("Silakan cari kota terlebih dahulu.");
        return;
    }
    if (!favorites.some((f) => f.name === coords.name)) {
        favorites.push({ name: coords.name, lat: coords.lat, lon: coords.lon });
        saveFavorites();
        renderFavorites();
        alert(`${coords.name} ditambahkan ke favorit!`);
    } else {
        alert("Kota sudah ada di favorit.");
    }
}

// Autocomplete
el.searchInput.addEventListener("input", async() => {
    const q = el.searchInput.value.trim();

    if (q.length < 2) {
        el.suggestions.innerHTML = "";
        el.suggestions.classList.remove("active");
        return;
    }

    try {
        const res = await fetch(`${GEOCODING_URL}?name=${q}&count=5&country=ID`);
        const data = await res.json();

        el.suggestions.innerHTML = "";

        if (data.results && data.results.length > 0) {
            el.suggestions.classList.add("active");

            data.results.forEach((s) => {
                const li = document.createElement("li");
                li.textContent = `${s.name}, Indonesia`;
                li.onclick = () => {
                    city = s.name;
                    el.searchInput.value = "";
                    el.suggestions.innerHTML = "";
                    el.suggestions.classList.remove("active");
                    fetchCity();
                };
                el.suggestions.appendChild(li);
            });
        } else {
            el.suggestions.classList.remove("active");
        }
    } catch (e) {
        console.error("Error fetching suggestions:", e);
    }
});

// Close suggestions when clicking outside
document.addEventListener("click", (e) => {
    if (!el.searchInput.contains(e.target) && !el.suggestions.contains(e.target)) {
        el.suggestions.classList.remove("active");
    }
});

// Event Listeners
el.favBtn.onclick = addFavorite;

el.searchBtn.onclick = () => {
    const val = el.searchInput.value.trim();
    if (val) {
        city = val;
        el.suggestions.innerHTML = "";
        el.suggestions.classList.remove("active");
        fetchCity();
    }
};

el.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        el.searchBtn.click();
    }
});

el.unitBtn.onclick = () => {
    unit = unit === "metric" ? "imperial" : "metric";
    el.unitBtn.querySelector('.temp-unit').textContent = unit === "metric" ? '°C / °F' : '°F / °C';
    fetchWeather();
};

el.themeBtn.onclick = () => {
    theme = theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", theme);
    document.body.classList.toggle("dark-theme", theme === "dark");
    el.themeBtn.querySelector('.theme-icon').textContent = theme === "dark" ? '☀️' : '🌙';
};

el.refreshBtn.onclick = () => {
    el.refreshBtn.querySelector('.refresh-icon').classList.add('spinning');
    fetchWeather().then(() => {
        setTimeout(() => {
            el.refreshBtn.querySelector('.refresh-icon').classList.remove('spinning');
        }, 500);
    });
};

// Auto-refresh every 5 minutes
setInterval(fetchWeather, 5 * 60 * 1000);

// Start Application
document.addEventListener('DOMContentLoaded', () => {
    fetchCity();
    renderFavorites();
});