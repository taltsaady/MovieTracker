const API_KEY = "f2a09b07222e3f21e22deff8a28b6a94";
const OMDB_KEY = "6ebabb8a";
// הערה: בסביבת פרודקשן אמיתית (Production), מפתחות API צריכים להישמר בשרת ולא בקוד הלקוח.

/* חיפוש סרט */
function searchMovie() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  const results = document.getElementById("results");
  results.innerHTML = "<p>טוען תוצאות... ⏳</p>"; // חיווי טעינה למשתמש

  fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&language=he-IL&query=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => showResults(data.results || []))
    .catch(err => {
      console.error("שגיאה בחיפוש סרט:", err);
      results.innerHTML = "<p>❌ חלה שגיאה בחיפוש. אנא בדוק את החיבור לרשת.</p>";
    });
}

/* הצגת תוצאות - שודרג לאסינכרוני כדי לשמור על סדר התוצאות */
async function showResults(movies) {
  const results = document.getElementById("results");

  if (movies.length === 0) {
    results.innerHTML = "<p>לא נמצאו תוצאות 🤷‍♂️</p>";
    return;
  }

  try {
    // יוצרים מערך של "הבטחות" (Promises) עבור כל סרט
    const moviePromises = movies.map(async (movie) => {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=he-IL`);
      const details = await res.json();

      const imdbId = details.imdb_id;
      const saved = JSON.parse(localStorage.getItem(movie.id)) || {};
      const year = movie.release_date ? movie.release_date.slice(0, 4) : "";
      let imdbRating = "לא זמין";

      if (imdbId) {
        // אם יש מזהה IMDb, נביא את הדירוג מ-OMDB
        const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${imdbId}`);
        const omdb = await omdbRes.json();
        
        if (omdb.imdbRating && omdb.imdbRating !== "N/A") {
          imdbRating = Number(omdb.imdbRating);
          saved.imdbRating = imdbRating;
          localStorage.setItem(movie.id, JSON.stringify(saved));
        }
      }

      // במקום לצייר מיד, אנחנו מחזירים את מחרוזת ה-HTML של הסרט הזה
      return generateMovieHTML(movie.original_title, year, movie.overview, imdbRating, movie.id, saved);
    });

    // מחכים שכל הקריאות (לכל הסרטים) יסתיימו
    const htmlArray = await Promise.all(moviePromises);

    // מעדכנים את המסך פעם אחת בלבד, כשהכל מוכן ובסדר המקורי
    results.innerHTML = htmlArray.join("");

  } catch (err) {
    console.error("שגיאה בטעינת פרטי הסרטים:", err);
    results.innerHTML = "<p>❌ חלה שגיאה בטעינת נתוני הסרטים.</p>";
  }
}

/* יצירת ה-HTML של הסרט (שם הפונקציה שונה מ-renderMovie) */
function generateMovieHTML(title, year, overview, imdbRating, id, saved) {
  return `
    <div class="movie">
      <h3>${title} ${year ? `(${year})` : ""}</h3>
      <p>${overview || "אין תקציר בעברית"}</p>
      <p><strong>⭐ IMDb:</strong> ${imdbRating}</p>

      <button onclick="toggleSeen(${id})">
        ${saved.seen ? "❌ לא ראיתי" : "✔ ראיתי"}
      </button>

      <div style="margin-top:8px">
        הדירוג שלך (1–10):
        <input type="number" min="1" max="10" step="0.5"
          ${saved.seen ? "" : "disabled"}
          value="${saved.rating || ""}"
          onchange="rateMovie(${id}, this.value)">
      </div>
    </div>
  `;
}

/* ראיתי / ביטול */
function toggleSeen(id) {
  const data = JSON.parse(localStorage.getItem(id)) || {};
  if (data.seen) {
    localStorage.removeItem(id);
  } else {
    data.seen = true;
    localStorage.setItem(id, JSON.stringify(data));
  }
  
  // במקום לבצע חיפוש חדש מהרשת, שווה לשקול בעתיד רק לעדכן את כפתור הסרט הספציפי. 
  // בינתיים השארתי את הקריאה ל-searchMovie() כפי שהגדרת.
  searchMovie();
}

/* דירוג אישי */
function rateMovie(id, rating) {
  const data = JSON.parse(localStorage.getItem(id)) || {};
  data.seen = true;
  data.rating = Number(rating);
  localStorage.setItem(id, JSON.stringify(data));
}

/* 🎯 מצא סרטים מומלצים בשבילי */
function findRecommended() {
  const keys = Object.keys(localStorage);
  const liked = [];

  keys.forEach(id => {
    const data = JSON.parse(localStorage.getItem(id));
    if (data?.seen && data.rating >= 7) {
      liked.push(id);
    }
  });

  if (liked.length === 0) {
    alert("אין סרטים שדירגת 7 ומעלה");
    return;
  }

  const results = document.getElementById("results");
  results.innerHTML = "<p>מחשב המלצות... 🧠</p>";

  fetchRecommendedByMovie(liked[0]);
}

/* ז'אנרים + מילות מפתח */
function fetchRecommendedByMovie(movieId) {
  Promise.all([
    fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&language=he-IL`).then(r => r.json()),
    fetch(`https://api.themoviedb.org/3/movie/${movieId}/keywords?api_key=${API_KEY}`).then(r => r.json())
  ])
  .then(([details, keywords]) => {
    const genreIds = details.genres.map(g => g.id).join(",");
    const keywordIds = keywords.keywords.slice(0, 5).map(k => k.id).join(",");
    discoverRecommended(genreIds, keywordIds);
  })
  .catch(err => {
    console.error("שגיאה במשיכת מילות מפתח להמלצות:", err);
    document.getElementById("results").innerHTML = "<p>❌ חלה שגיאה במציאת המלצות.</p>";
  });
}

/* חיפוש חכם – בלי סרטים שכבר ראיתי */
function discoverRecommended(genres, keywords) {
  fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${genres}&with_keywords=${keywords}&language=he-IL`)
    .then(res => res.json())
    .then(data => {
      const filtered = data.results.filter(movie => {
        const saved = JSON.parse(localStorage.getItem(movie.id));
        return movie.vote_average >= 6.5 && !saved?.seen;
      });

      showResults(filtered);
    })
    .catch(err => {
      console.error("שגיאה בחיפוש החכם:", err);
      document.getElementById("results").innerHTML = "<p>❌ לא הצלחנו למצוא סרטים כרגע.</p>";
    });
}
