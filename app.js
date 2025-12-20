const API_KEY = "f2a09b07222e3f21e22deff8a28b6a94";
const OMDB_KEY = "6ebabb8a";

/* 🔍 חיפוש סרטים */
function searchMovie() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => showResults(data.results || []));
}

/* 🎬 הצגת תוצאות */
function showResults(movies) {
  const results = document.getElementById("results");
  results.innerHTML = "";

  if (movies.length === 0) {
    results.innerHTML = "<p>לא נמצאו תוצאות</p>";
    return;
  }

  movies.forEach(movie => loadMovie(movie));
}

/* ⬇️ טעינת שם באנגלית + תקציר בעברית + IMDb */
function loadMovie(movie) {
  // שם באנגלית
  fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=en-US`)
    .then(res => res.json())
    .then(enDetails => {

      // תקציר בעברית
      fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=he-IL`)
        .then(res => res.json())
        .then(heDetails => {

          const titleEn = enDetails.title;
          const year = enDetails.release_date
            ? enDetails.release_date.slice(0, 4)
            : "";
          const overviewHe = heDetails.overview || "אין תקציר בעברית";
          const imdbId = enDetails.imdb_id;

          const saved = JSON.parse(localStorage.getItem(movie.id)) || {};

          if (!imdbId) {
            renderMovie(movie.id, titleEn, year, overviewHe, saved, "לא זמין");
            return;
          }

          // IMDb אמיתי מ-OMDb
          fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}`)
            .then(res => res.json())
            .then(omdb => {
              const imdbRating =
                omdb.imdbRating && omdb.imdbRating !== "N/A"
                  ? omdb.imdbRating
                  : "לא זמין";

              renderMovie(movie.id, titleEn, year, overviewHe, saved, imdbRating);
            });
        });
    });
}

/* 🖼️ רינדור סרט */
function renderMovie(id, titleEn, year, overviewHe, saved, imdbRating) {
  const results = document.getElementById("results");

  results.innerHTML += `
    <div class="movie">
      <h3>${titleEn} ${year ? `(${year})` : ""}</h3>

      <p>${overviewHe}</p>

      <p><strong>⭐ IMDb:</strong> ${imdbRating}</p>

      <button onclick="toggleSeen(${id})">
        ${saved.seen ? "❌ לא ראיתי" : "✔ ראיתי"}
      </button>

      <div style="margin-top:8px">
        הדירוג שלך (1–10):
        <input
          type="number"
          min="1"
          max="10"
          step="0.5"
          ${saved.seen ? "" : "disabled"}
          value="${saved.rating || ""}"
          onchange="rateMovie(${id}, this.value)"
        >
      </div>
    </div>
  `;
}

/* ✔ / ❌ ראיתי + UNDO */
function toggleSeen(id) {
  const data = JSON.parse(localStorage.getItem(id)) || {};

  if (data.seen) {
    localStorage.removeItem(id);
  } else {
    data.seen = true;
    localStorage.setItem(id, JSON.stringify(data));
  }

  searchMovie();
}

/* ⭐ דירוג אישי */
function rateMovie(id, rating) {
  const data = JSON.parse(localStorage.getItem(id)) || {};
  data.seen = true;
  data.rating = Number(rating);
  localStorage.setItem(id, JSON.stringify(data));
}

