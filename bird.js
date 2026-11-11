(() => {
  const root = document.documentElement;
  const page = document.querySelector(".page");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SCALE = 4;

  // Original pixel sprites, facing right. One is picked at random per visit. "." is empty.
  // b body, d wing/dark, l belly, e eye, k beak, f feet,
  // c cap/crest, m mask.
  const BIRDS = {
    cardinal: {
      name: "Cardinal",
      sprite: [
        ".......c.....",
        "......cc.....",
        ".....bbbbb...",
        "....bbbmmekk.",
        "....bbbbmmk..",
        "bb..bbbbbb...",
        ".bbbdddbbbb..",
        "..bbddddbbb..",
        "...bbbbbbb...",
        ".....f.f.....",
        "....ff.ff....",
      ],
      blink: { 3: "....bbbmmmkk." },
      // Song: clear whistles that slide downward, "cheer cheer cheer".
      song: [[0, 0.17, 3800, 2200], [0.22, 0.17, 3700, 2150], [0.44, 0.17, 3600, 2100]],
      warm: { b: "#a33d2c", c: "#a33d2c", d: "#7e2a1e", m: "#252420", e: "#f2eee5", k: "#d9a24f", f: "#6a655d" },
      dark: { b: "#ec7a62", c: "#ec7a62", d: "#b9533f", m: "#141210", e: "#ede8e0", k: "#d9a24f", f: "#a0988d" },
    },
    bluetit: {
      name: "Blue tit",
      sprite: [
        ".............",
        ".....ccc.....",
        "....ccccc....",
        "...cceccckk..",
        "...bbbbbbk...",
        "dd.bblllbb...",
        ".dddbllllbb..",
        "..ddbllllbb..",
        "...bbbbbbb...",
        ".....f.f.....",
        "....ff.ff....",
      ],
      blink: { 3: "...cccccckk.." },
      // Song: thin, very high "tsee-tsee" notes, then a quick trill.
      song: [[0, 0.07, 6500, 6900, 0.6], [0.1, 0.07, 6500, 6900, 0.6],
        ...[0, 1, 2, 3, 4].map((i) => [0.22 + i * 0.045, 0.035, 4800, 4300, 0.5])],
      warm: { c: "#3f6f8f", b: "#5b86a3", d: "#2f5470", l: "#d8b23a", e: "#f2eee5", k: "#45423c", f: "#6a655d" },
      dark: { c: "#7aa9c8", b: "#8db4cc", d: "#5a87a6", l: "#e6c556", e: "#141210", k: "#cbc4ba", f: "#a0988d" },
    },
  };

  // A different bird may visit each time.
  const names = Object.keys(BIRDS);
  const kind = names[Math.floor(Math.random() * names.length)];

  const bird = document.createElement("div");
  bird.className = "bird";
  bird.setAttribute("role", "img");
  bird.title = "Drag me";
  const sc = document.createElement("canvas");
  const note = document.createElement("span");
  note.className = "bird-note";
  note.textContent = "♪";
  bird.append(sc, note);
  page.append(bird);

  let W = 0, H = 0;
  function paint(closed = false) {
    const spec = BIRDS[kind];
    const rows = spec.sprite.map((row, i) => (closed && spec.blink[i]) || row);
    sc.width = rows[0].length;
    sc.height = rows.length;
    W = sc.width * SCALE;
    H = sc.height * SCALE;
    bird.style.width = `${W}px`;
    bird.style.height = `${H}px`;
    bird.setAttribute("aria-label", `A small pixel ${spec.name.toLowerCase()} you can drag around`);
    const colors = spec[root.dataset.theme === "dark" ? "dark" : "warm"];
    const g = sc.getContext("2d");
    g.clearRect(0, 0, sc.width, sc.height);
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === ".") return;
      g.fillStyle = colors[c];
      g.fillRect(x, y, 1, 1);
    }));
  }
  paint();
  new MutationObserver(() => paint()).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  // ---------- position, in page coordinates ----------
  let x = 0, y = 0; // top-left of the bird
  const place = () => {
    bird.style.left = `${x}px`;
    bird.style.top = `${y}px`;
  };

  // Every visible horizontal border inside the page is a perch.
  function perches() {
    const origin = page.getBoundingClientRect();
    const out = [];
    for (const el of page.querySelectorAll("*")) {
      if (bird.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      const left = r.left - origin.left, right = r.right - origin.left;
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none")
        out.push({ y: r.top - origin.top, left, right });
      if (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none")
        out.push({ y: r.bottom - origin.top, left, right });
    }
    out.push({ y: page.scrollHeight, left: -Infinity, right: Infinity }); // floor
    return out;
  }

  function landingFor(feet) {
    const cx = x + W / 2;
    let best = Infinity;
    for (const p of perches())
      if (p.y >= feet - 0.5 && cx >= p.left && cx <= p.right && p.y < best) best = p.y;
    return best;
  }

  // ---------- gravity ----------
  let vy = 0, falling = false;
  function fall(initialVy = 0) {
    vy = initialVy;
    if (reduced && initialVy === 0) {
      y = landingFor(y + H) - H;
      place();
      return;
    }
    if (falling) return;
    falling = true;
    bird.classList.add("falling");
    let last = performance.now();
    let target = landingFor(y + H);
    const step = (now) => {
      if (!falling) return;
      const dt = Math.min((now - last) / 16.7, 3);
      last = now;
      vy = Math.min(vy + 0.8 * dt, 20);
      y += vy * dt;
      if (vy < 0) target = landingFor(y + H); // still rising after a hop
      if (vy >= 0 && y + H >= target) {
        y = target - H;
        place();
        falling = false;
        bird.classList.remove("falling", "landed");
        void bird.offsetWidth;
        bird.classList.add("landed");
        return;
      }
      place();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Start perched on the facts box.
  function perchStart() {
    const origin = page.getBoundingClientRect();
    const box = document.querySelector(".facts").getBoundingClientRect();
    x = Math.max(0, box.right - origin.left - W - 18);
    y = box.top - origin.top - H;
    place();
  }
  perchStart();

  // ---------- dragging and clicking ----------
  let drag = null;
  bird.addEventListener("pointerdown", (e) => {
    falling = false;
    bird.classList.remove("falling");
    bird.setPointerCapture(e.pointerId);
    drag = { dx: e.clientX - x, dy: e.clientY - y, sx: e.clientX, sy: e.clientY, moved: false };
    bird.classList.add("dragging");
  });
  bird.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3) drag.moved = true;
    x = Math.min(Math.max(e.clientX - drag.dx, -W / 2), page.clientWidth - W / 2);
    y = e.clientY - drag.dy;
    place();
  });
  const release = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    bird.classList.remove("dragging");
    if (moved) fall();
    else { chirp(); fall(reduced ? 0 : -6); } // a click is a little hop
  };
  bird.addEventListener("pointerup", release);
  bird.addEventListener("pointercancel", release);

  // ---------- song ----------
  // Generated tones, no audio file. Plays only when the bird is clicked.
  let audio = null;
  function sing() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const t0 = audio.currentTime + 0.02;
      for (const [start, dur, f0, f1, level = 1] of BIRDS[kind].song) {
        const t = t0 + start;
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12 * level, t + Math.min(0.02, dur / 4));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + dur + 0.02);
      }
    } catch {}
  }

  function chirp() {
    note.classList.remove("show");
    void note.offsetWidth;
    note.classList.add("show");
    sing();
  }

  // ---------- blinking ----------
  // A random blink every 2 to 6 seconds, sometimes twice. Skipped while the
  // bird is held or falling, when the tab is hidden, or with reduced motion.
  function blinkOnce(then) {
    paint(true);
    setTimeout(() => { paint(); if (then) setTimeout(then, 160); }, 140);
  }
  function scheduleBlink() {
    setTimeout(() => {
      if (!reduced && !document.hidden && !drag && !falling)
        blinkOnce(Math.random() < 0.2 ? () => blinkOnce() : null);
      scheduleBlink();
    }, 2000 + Math.random() * 4000);
  }
  scheduleBlink();

  // Layout can move the lines; let the bird settle again.
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      x = Math.min(x, page.clientWidth - W);
      fall();
    }, 150);
  });
})();
