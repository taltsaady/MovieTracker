const API_KEY = "f2a09b07222e3f21e22deff8a28b6a94";
const OMDB_KEY = "6ebabb8a";

// שמירת המצב הנוכחי של הסרטים המוצגים בזיכרון כדי לאפשר עדכון לוקאלי מיידי
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
  resultsContainer.innerHTML = `
    <div class="loading-state">
      <span class="spinner">⏳</span>
      <p>מחפש סרטים תואמים ברשת...</p>
    </div>
  `;

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
   עיבוד והצגת הסרטים (שימוש ב-Promise.all למניעת Race Conditions ושיפור ביצועים)
   ========================================================================== */
async function displayMovies() {
  const resultsContainer = document.getElementById("results");

  if (!currentMovies.length) {
    resultsContainer.innerHTML = "<p class='no-results'>🤷‍♂️ לא נמצאו תוצאות תואמות.</p>";
    return;
  }

  // הצגת מצב ביניים בזמן השלמת הנתונים מ-OMDB ופרטים מורחבים
  resultsContainer.innerHTML = `
    <div class="loading-state">
      <span class="spinner">🍿</span>
      <p>טוען נתונים מורחבים ודירוגים...</p>
    </div>
  `;

  try {
    // יצירת מערך של פרומיסים המעבדים את כל הסרטים במקביל תוך שמירה מלאה על הסדר המקורי
    const movieCardsHTML = await Promise.all(
      currentMovies.map(async (movie) => {
        try {
          // משיכת פרטי הסרט מ-TMDB כדי להשיג את ה-imdb_id שלו
          const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=he-IL`);
          if (!tmdbRes.ok) throw new Error("נכשל בטעינת פרטים מ-TMDB");
          const details = await tmdbRes.json();

          const saved = JSON.parse(localStorage.getItem(movie.id)) || {};
          const year = movie.release_date ? movie.release_date.slice(0, 4) : "";
          let imdbRating = saved.imdbRating || "לא זמין";

          // משיכת הדירוג מ-OMDB במידה ויש מזהה IMDb ואין לנו אותו שמור עדיין
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
              console.warn(`שגיאה במשיכת דירוג OMDB עבור סרט שמספרו ${movie.id}:`, e);
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
          console.error(`שגיאה בעיבוד סרט בודד ${movie.id}:`, singleErr);
          // כרטיס גיבוי במקרה של שגיאה נקודתית בסרט יחיד כדי שהרשימה כולה לא תקרוס
          return `
            <div class="movie-card">
              <div class="movie-info">
                <h3 class="movie-title">${movie.title || movie.original_title}</h3>
                <p class="movie-overview">אירעה שגיאה בטעינת הפרטים המלאים עבור סרט זה.</p>
              </div>
            </div>
          `;
        }
      })
    );

    // עדכון קובץ ה-HTML פעם אחת בלבד בסיום עיבוד כל הפרומיסים
    resultsContainer.innerHTML = movieCardsHTML.join("");

  } catch (globalErr) {
    console.error("שגיאה גלובלית בהצגת התוצאות:", globalErr);
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
              <label for="rating-${movie.id}">דירוג:</label>
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
   סימון ראיתי / לא ראיתי (שדרוג: מעדכן לוקאלית ללא קריאת רשת מחדש)
   ========================================================================== */
function toggleSeen(id) {
  const data = JSON.parse(localStorage.getItem(id)) || {};

  if (data.seen) {
    localStorage.removeItem(id);
  } else {
    data.seen = true;
    localStorage.setItem(id, JSON.stringify(data));
  }

  // שדרוג ארכיטקטוני: מרעננים את התצוגה ישירות מהזיכרון ללא פנייה כפולה ל-API
  displayMovies();
}

/* ==========================================================================
   דירוג אישי
   ========================================================================== */
function rateMovie(id, rating) {
  if (rating === "") return;

  const numericRating = Number(rating);
  if (numericRating < 1 || numericRating > 10) {
    alert("נא להזין דירוג חוקי בין 1 ל-10");
    return;
  }

  const data = JSON.parse(localStorage.getItem(id)) || {};
  data.seen = true;
  data.rating = numericRating;

  localStorage.setItem(id, JSON.stringify(data));
  displayMovies();
}

/* ==========================================================================
   המלצות חכות - בחירה רנדומלית מתוך רשימת המועדפים ליצירת גיוון
   ========================================================================== */
function findRecommended() {
  const likedMovies = Object.keys(localStorage).filter(id => {
    const movie = JSON.parse(localStorage.getItem(id));
    return movie?.seen && movie.rating >= 7;
  });

  if (!likedMovies.length) {
    alert("סמנו לפחות סרט אחד כ-'ראיתי' ותנו לו ציון 7 ומעלה כדי שנוכל להבין את הטעם שלכם!");
    return;
  }

  const randomMovieId = likedMovies[Math.floor(Math.random() * likedMovies.length)];
  fetchRecommendations(randomMovieId);
}

/* ==========================================================================
   שליפת המלצות חכמות מבוססות ז'אנרים ומילות מפתח
   ========================================================================== */
async function fetchRecommendations(movieId) {
  const resultsContainer = document.getElementById("results");
  resultsContainer.innerHTML = `
    <div class="loading-state">
      <span class="spinner">🧠</span>
      <p>מנתח את העדפות הצפייה שלך ומחולל המלצות מותאמות...</p>
    </div>
  `;

  try {
    const [detailsRes, keywordsRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}`),
      fetch(`https://api.themoviedb.org/3/movie/${movieId}/keywords?api_key=${API_KEY}`)
    ]);

    if (!detailsRes.ok || !keywordsRes.ok) throw new Error("שגיאה במשיכת נתוני המקור");

    const details = await detailsRes.json();
    const keywords = await keywordsRes.json();

    const genres = details.genres.map(g => g.id).join(",");
    const keywordIds = (keywords.keywords || [])
      .slice(0, 5)
      .map(k => k.id)
      .join(",");

    let url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=he-IL&sort_by=vote_average.desc&vote_count.gte=300&with_genres=${genres}`;

    if (keywordIds) {
      url += `&with_keywords=${keywordIds}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("שגיאה בשליפת המלצות");
    const data = await response.json();

    // סינון סרטים שכבר קיימים בסטטוס "ראיתי" של המשתמש
    const recommendations = (data.results || []).filter(movie => {
      const saved = JSON.parse(localStorage.getItem(movie.id));
      return !saved?.seen && movie.vote_average >= 6.0;
    });

    if (!recommendations.length) {
      // אם הסינון המחמיר לא הניב תוצאות, ננסה גיבוי רחב יותר מבוסס פופולריות וז'אנר בלבד
      const backupUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=he-IL&sort_by=popularity.desc&with_genres=${genres}`;
      const backupRes = await fetch(backupUrl);
      const backupData = await backupRes.json();
      
      currentMovies = (backupData.results || []).filter(m => !JSON.parse(localStorage.getItem(m.id))?.seen).slice(0, 12);
    } else {
      currentMovies = recommendations.slice(0, 12);
    }

    if (!currentMovies.length) {
      resultsContainer.innerHTML = "<p class='no-results'>🤷‍♂️ לא הצלחנו למצוא סרטים מומלצים חדשים על סמך סרט זה. נסו לדרג סרטים נוספים!</p>";
      return;
    }

    displayMovies();

  } catch (err) {
    console.error("שגיאה בהפקת המלצות:", err);
    resultsContainer.innerHTML = "<p class='error-msg'>❌ אירעה שגיאה בקבלת ההמלצות החכמות מהשרת.</p>";
  }
}
