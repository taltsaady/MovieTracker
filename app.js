const API_KEY = "f2a09b07222e3f21e22deff8a28b6a94";
const OMDB_KEY = "6ebabb8a";

let currentMovies = [];

/* ==========================================================================
   חיפוש סרט
   ========================================================================== */
function searchMovie() {
  const query = document.getElementById("searchInput").value.trim();

  if (!query) {
    alert("אנא הקלד שם של סרט לחיפוש.");
    return;
  }

  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = `<div class="loading-state"><span class="spinner">⏳</span><p>מחפש סרטים תואמים ברשת...</p></div>`;

  fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&language=he-IL&query=${encodeURIComponent(query)}`)
    .then(res => {
      if (!res.ok) throw new Error("שגיאה בתקשורת עם השרת");
      return res.json();
    })
    .then(data => {
      currentMovies = data.results || [];
      displayMovies();
    })
    .catch(err => {
      console.error(err);
      resultsContainer.innerHTML = "<p class='error-msg'>❌ אירעה שגיאה בחיפוש הסרטים. אנא ודא שהאינטרנט מחובר ונסה שנית.</p>";
    });
}

/* ==========================================================================
   עיבוד והצגת הסרטים 
   ========================================================================== */
async function displayMovies() {
  const resultsContainer = document.getElementById("results");

  if (!currentMovies.length) {
    resultsContainer.innerHTML = "<p class='no-results'>🤷‍♂️ לא נמצאו תוצאות תואמות.</p>";
    return;
  }

  resultsContainer.innerHTML = `<div class="loading-state"><span class="spinner">🍿</span><p>טוען נתונים מורחבים ודירוגים...</p></div>`;

  try {
    const movieCardsHTML = await Promise.all(
      currentMovies.map(async (movie) => {
        try {
          const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=he-IL`);
          if (!tmdbRes.ok) throw new Error("נכשל בטעינת פרטים מ-TMDB");
          const details = await tmdbRes.json();

          let saved = {};
          try {
            saved = JSON.parse(localStorage.getItem(movie.id)) || {};
          } catch(e) {} // הגנה מקריסת JSON

          const year = movie.release_date ? movie.release_date.slice(0, 4) : "";
          let imdbRating = saved.imdbRating || "לא זמין";

          if (details.imdb_id && (!saved.imdbRating || saved.imdbRating === "לא זמין")) {
            try {
              const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${details.imdb_id}`);
              if (omdbRes.ok) {
                const omdb = await omdbRes.json();
                if (omdb.imdbRating && omdb.imdbRating !== "N/A") {
                  imdbRating = Number(omdb.imdbRating);
                  saved.imdbRating = imdbRating;
                  localStorage.setItem(movie.id, JSON.stringify(saved));
                }
              }
            } catch (e) {
              console.warn(`שגיאה במשיכת דירוג OMDB עבור סרט שמספרו ${movie.id}`);
            }
          }

          const overviewText = movie.overview || "אין כרגע תקציר זמין בעברית עבור סרט זה.";
          const posterPath = movie.poster_path 
            ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` 
            : 'https://via.placeholder.com/300x450/1a1d24/ffffff?text=%D7%90%D7%99%D7%9F+%D7%AA%D7%95%D7%95%D7%A9%D7%99';

          return createMovieCardHTML({
            id: movie.id,
            title: movie.title || movie.original_title,
            year,
            overview: overviewText,
            imdbRating,
            posterPath,
            saved
          });

        } catch (singleErr) {
          return `
            <div class="movie-card">
              <div class="movie-info">
                <h3 class="movie-title">${movie.title || movie.original_title}</h3>
                <p class="movie-overview">אירעה שגיאה בטעינת הפרטים.</p>
              </div>
            </div>
          `;
        }
      })
    );

    resultsContainer.innerHTML = movieCardsHTML.join("");

  } catch (globalErr) {
    resultsContainer.innerHTML = "<p class='error-msg'>❌ חלה שגיאה בלתי צפויה בעיבוד הסרטים לתצוגה.</p>";
  }
}

/* ==========================================================================
   בניית מחרוזת ה-HTML לכרטיס סרט
   ========================================================================== */
function createMovieCardHTML(movie) {
  const isSeen = !!movie.saved.seen;
  const userRating = movie.saved.rating || "";

  return `
    <div class="movie-card ${isSeen ? 'seen' : ''}">
      <img src="${movie.posterPath}" alt="${movie.title}" class="movie-poster" loading="lazy">
      <div class="movie-info">
        <div>
          <h3 class="movie-title">${movie.title} ${movie.year ? `<span class="movie-year">(${movie.year})</span>` : ""}</h3>
          <p class="movie-overview">${movie.overview}</p>
        </div>
        
        <div>
          <div class="movie-meta">
            <span class="imdb-badge">⭐ IMDb: ${movie.imdbRating}</span>
          </div>

          <div class="movie-actions">
            <button class="btn-toggle ${isSeen ? 'btn-seen' : 'btn-unseen'}" onclick="toggleSeen(${movie.id})">
              ${isSeen ? "❌ לא ראיתי" : "✔ ראיתי"}
            </button>
            
            <div class="rating-container">
              <label for="rating-${movie.id}">דירוג שלך:</label>
              <input 
                id="rating-${movie.id}"
                type="number" 
                min="1" 
                max="10" 
                step="0.5" 
                placeholder="1-10"
                ${isSeen ? "" : "disabled"} 
                value="${userRating}" 
                onchange="rateMovie(${movie.id}, this.value)"
                class="rating-input"
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   סימון ראיתי / לא ראיתי
   ========================================================================== */
function toggleSeen(id) {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(id)) || {}; } catch(e){}

  if (data.seen) {
    localStorage.removeItem(id);
  } else {
    data.seen = true;
    localStorage.setItem(id, JSON.stringify(data));
  }
  displayMovies();
}

function rateMovie(id, rating) {
  if (rating === "") return;
  const numericRating = Number(rating);
  if (numericRating < 1 || numericRating > 10) {
    alert("נא להזין דירוג חוקי בין 1 ל-10");
    return;
  }
  let data = {};
  try { data = JSON.parse(localStorage.getItem(id)) || {}; } catch(e){}
  data.seen = true;
  data.rating = numericRating;
  localStorage.setItem(id, JSON.stringify(data));
  displayMovies();
}

/* ==========================================================================
   [חדש!] הצגת כל הסרטים שראיתי ודירגתי
   ========================================================================== */
async function showWatchedMovies() {
  const resultsContainer = document.getElementById("results");
  
  // סריקה בטוחה של כל ה-Local Storage
  const watchedIds = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data && data.seen) {
        watchedIds.push(key);
      }
    } catch(e) { /* מתעלם ממפתחות שאינם קשורים לאפליקציה */ }
  }

  if (watchedIds.length === 0) {
    resultsContainer.innerHTML = "<p class='no-results'>📭 עדיין לא סימנת סרטים כ-'ראיתי'. חפשו סרט והתחילו לדרג!</p>";
    return;
  }

  resultsContainer.innerHTML = `<div class="loading-state"><span class="spinner">📁</span><p>טוען את רשימת הסרטים שלך...</p></div>`;

  try {
    // משיכת פרטי הסרטים מ-TMDB עבור כל אלו שסימנו שראינו
    const moviePromises = watchedIds.map(async (id) => {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}&language=he-IL`);
      if (!res.ok) return null;
      return await res.json();
    });

    const moviesData = await Promise.all(moviePromises);
    
    // סינון שגיאות ומעבר לתצוגה המרכזית
    currentMovies = moviesData.filter(m => m !== null);
    
    if (currentMovies.length === 0) {
       resultsContainer.innerHTML = "<p class='error-msg'>❌ לא הצלחנו לטעון את הסרטים שלך כרגע.</p>";
       return;
    }

    displayMovies();
  } catch(err) {
    console.error(err);
    resultsContainer.innerHTML = "<p class='error-msg'>❌ אירעה שגיאה בטעינת רשימת הסרטים.</p>";
  }
}

/* ==========================================================================
   [תוקן!] המלצות חכמות מבוססות על מנוע ההמלצות הרשמי של TMDB
   ========================================================================== */
function findRecommended() {
  const likedMovies = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try {
      const movie = JSON.parse(localStorage.getItem(key));
      if (movie?.seen && movie.rating >= 7) {
        likedMovies.push(key);
      }
    } catch(e){}
  }

  if (!likedMovies.length) {
    alert("סמנו לפחות סרט אחד כ-'ראיתי' ותנו לו ציון 7 ומעלה כדי שנוכל להבין את הטעם שלכם!");
    return;
  }

  const randomMovieId = likedMovies[Math.floor(Math.random() * likedMovies.length)];
  fetchRecommendations(randomMovieId);
}

async function fetchRecommendations(movieId) {
  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = `<div class="loading-state"><span class="spinner">🧠</span><p>מנתח את העדפות הצפייה שלך ומחולל המלצות...</p></div>`;

  try {
    // שלב 1: ניסיון למשוך ממנוע ההמלצות
    let res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/recommendations?api_key=${API_KEY}&language=he-IL`);
    let data = await res.json();
    
    // שלב 2: אם אין המלצות ישירות, נמשוך סרטים "דומים"
    if (!data.results || data.results.length === 0) {
      res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/similar?api_key=${API_KEY}&language=he-IL`);
      data = await res.json();
    }

    // סינון סרטים שהמשתמש כבר ראה
    const recommendations = (data.results || []).filter(movie => {
      try {
        const saved = JSON.parse(localStorage.getItem(movie.id));
        return !saved?.seen;
      } catch(e) { return true; }
    });

    if (!recommendations.length) {
      resultsContainer.innerHTML = "<p class='no-results'>🤷‍♂️ לא מצאנו המלצות חדשות שמבוססות על הסרטים שלך. נסו לדרג סרטים אחרים!</p>";
      return;
    }

    // הצגת 12 ההמלצות הטובות ביותר
    currentMovies = recommendations.slice(0, 12);
    displayMovies();

  } catch (err) {
    console.error("שגיאה בהפקת המלצות:", err);
    resultsContainer.innerHTML = "<p class='error-msg'>❌ אירעה שגיאה בקבלת ההמלצות החכמות מהשרת.</p>";
  }
}
