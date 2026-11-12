(() => {
  const DAY = 86400000;
  const year = 2026;
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year, 11, 31);
  const firstWeekday = new Date(start).getUTCDay();
  const formatDate = new Intl.DateTimeFormat("en", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });

  function drawMonths(row) {
    for (let month = 0; month < 12; month++) {
      const date = new Date(Date.UTC(year, month, 1));
      const label = document.createElement("span");
      label.textContent = date.toLocaleString("en", { month: "short", timeZone: "UTC" });
      label.style.gridColumn = `${Math.floor(((date.getTime() - start) / DAY + firstWeekday) / 7) + 1} / span 4`;
      label.style.gridRow = "1";
      row.append(label);
    }
  }

  function drawCalendar(id, days, through, label, moviesByDay = null, onMovieDate = null) {
    const grid = document.getElementById(id);
    const fragment = document.createDocumentFragment();
    for (let cell = 0; cell < 53 * 7; cell++) {
      const time = start + (cell - firstWeekday) * DAY;
      const square = document.createElement("span");
      square.className = "log-day";
      if (time < start || time > end) {
        square.classList.add("padding");
        square.setAttribute("aria-hidden", "true");
      } else {
        const date = new Date(time);
        const isoDate = date.toISOString().slice(0, 10);
        const future = isoDate > through;
        const active = days.has(isoDate) && !future;
        const titles = moviesByDay?.get(isoDate) || [];
        const description = future ? "Future date" : active ? (titles.length ? titles.join("; ") : label) : "No entry";
        const accessibleLabel = `${formatDate.format(date)}: ${description}`;
        square.classList.toggle("active", active);
        square.classList.toggle("future", future);
        square.title = accessibleLabel;
        square.setAttribute("aria-label", accessibleLabel);
        square.tabIndex = cell === firstWeekday ? 0 : -1;
        if (active && moviesByDay && titles.length) {
          square.setAttribute("role", "button");
          const showMovies = () => onMovieDate?.(date, titles);
          square.addEventListener("mouseenter", showMovies);
          square.addEventListener("focus", showMovies);
          square.addEventListener("click", showMovies);
        }
        square.addEventListener("keydown", event => {
          if (active && moviesByDay && titles.length && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onMovieDate?.(date, titles);
            return;
          }
          const move = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[event.key];
          if (!move) return;
          event.preventDefault();
          const next = grid.children[cell + move];
          if (next && !next.classList.contains("padding")) {
            square.tabIndex = -1;
            next.tabIndex = 0;
            next.focus();
          }
        });
      }
      fragment.append(square);
    }
    grid.replaceChildren(fragment);
  }

  async function render() {
    const response = await fetch(`activity-logs.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load log data.");
    const data = await response.json();
    const movieDays = new Set(data.letterboxd.days);
    const moviesByDay = new Map();
    for (const movie of data.letterboxd.movies || []) {
      if (!moviesByDay.has(movie.date)) moviesByDay.set(movie.date, []);
      moviesByDay.get(movie.date).push(movie.title);
    }
    const calligraphyDays = new Set(data.calligraphy.days);
    const movieDetail = document.getElementById("movie-detail");
    const showMovieDate = (date, titles) => {
      movieDetail.textContent = `${formatDate.format(date)}: ${titles.join("; ")}`;
      movieDetail.hidden = false;
    };
    document.getElementById("movie-day-count").textContent = movieDays.size;
    document.querySelectorAll("[data-months]").forEach(drawMonths);
    drawCalendar("movie-log", movieDays, data.through, "Film watched", moviesByDay, showMovieDate);
    drawCalendar("calligraphy-log", calligraphyDays, data.calligraphy.through, "Practice uploaded (sample)");
  }

  render().catch(error => console.error("Unable to render activity logs.", error));
})();
