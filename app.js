const API_KEY = "f2a09b07222e3f21e22deff8a28b6a94";

function searchMovie() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&language=he-IL&query=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => showResults(data.results || []));
}

function showResults(movies) {
  const results = document.getElementById("results");
  results.innerHTML = "";

  if (movies.length === 0) {
    results.innerHTML = "<p>לא נמצאו תוצאות</p>";
    return;
  }

  movies.forEach(movie => {
    const saved = JSON.parse(localStorage.getItem(movie.id)) || {};
    const year = movie.release_date ? movie.release_date.slice(0, 4) : "";

    results.innerHTML += `
      <div class="movie">
        <h3>${movie.title} ${year ? `(${year})` : ""}</h3>
        <p>${movie.overview || "אין תקציר בעברית"}</p>

        <button onclick="toggleSeen(${movie.id})">
          ${saved.seen ? "❌ לא ראיתי" : "✔ ראיתי"}
        </button>

        <div style="margin-top:8px">
          דירוג (1–10):
          <input
            type="number"
            min="1"
            max="10"
            step="0.5"
            ${saved.seen ? "" : "disabled"}
            value="${saved.rating || ""}"
            onchange="rateMovie(${movie.id}, this.value)"
          >
        </div>
      </div>
    `;
  });
}

function toggleSeen(id) {
  let data = JSON.parse(localStorage.getItem(id)) || {};

  if (data.seen) {
    // UNDO – לא ראיתי
    localStorage.removeItem(id);
  } else {
    // סימון כראיתי
    data.seen = true;
    localStorage.setItem(id, JSON.stringify(data));
  }

  // רענון תצוגה
  searchMovie();
}

function rateMovie(id, rating) {
  const data = JSON.parse(localStorage.getItem(id)) || {};
  data.seen = true;
  data.rating = Number(rating);
  localStorage.setItem(id, JSON.stringify(data));
}
