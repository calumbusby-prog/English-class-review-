// Final challenge: a flappy-bird-style game. A wall with two gaps scrolls
// toward the bird; each gap is labeled with an answer option pulled from
// `pool` (built fresh from content.js each session, so the questions are
// whatever material is loaded that week — nothing here is topic-specific).
//
// Flying through the gap labeled with the correct answer scores 10 points.
// Flying through the wrong gap, or hitting the wall itself, scores nothing
// but the game keeps going — there's no fail state, just a target of 200
// points. Speed increases and gaps shrink as the score climbs.

const WIDTH_RATIO = 16 / 9;
const MAX_HEIGHT = 480;
const TARGET_SCORE = 200;
const POINTS_PER_CORRECT = 10;

export function startBirdGame(container, pool, onFinish) {
  if (!pool.length) {
    container.appendChild(Object.assign(document.createElement("p"), { textContent: "Not enough content loaded for the final challenge." }));
    onFinish();
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "bird-canvas-wrap";
  const canvas = document.createElement("canvas");
  const hud = document.createElement("div");
  hud.className = "bird-hud";
  wrap.appendChild(hud);
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  const instructions = document.createElement("p");
  instructions.className = "muted center";
  instructions.textContent = "Tap, click, or press Space to flap. Fly through the gap with the CORRECT answer.";
  container.appendChild(instructions);

  const ctx = canvas.getContext("2d");
  let width, height, dpr;

  function resize() {
    const cssWidth = Math.min(wrap.clientWidth || 640, 720);
    width = cssWidth;
    height = Math.min(width / WIDTH_RATIO, MAX_HEIGHT);
    dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const bird = { x: 0, y: 0, vy: 0, r: 16 };
  let score = 0;
  let running = true;
  let poolIndex = 0;
  let shuffledPool = shuffle(pool);
  let wall = null; // { x, gapTop: {y0,y1,text,isCorrect}, gapBottom: {...}, resolved, thickness }
  let flashUntil = 0;
  let flashGood = true;

  // Debug/test hook only — lets an automated test read live game state
  // without affecting gameplay. Harmless to leave in.
  window.__birdDebug = () => ({ bird: { ...bird }, wall, score, height, width });

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function nextQuestion() {
    if (poolIndex >= shuffledPool.length) {
      shuffledPool = shuffle(pool);
      poolIndex = 0;
    }
    return shuffledPool[poolIndex++];
  }

  function difficulty() {
    const t = Math.min(score / TARGET_SCORE, 1);
    return {
      speed: lerp(2.1, 4.6, t),
      gapHeight: lerp(height * 0.34, height * 0.2, t),
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function spawnWall() {
    const { gapHeight } = difficulty();
    const margin = 24;
    const usable = height - margin * 2;
    // Split usable space into a top region and bottom region for the two
    // gaps, each `gapHeight` tall, with a solid divider between them.
    const gapY1 = margin + Math.random() * (usable - gapHeight * 2 - 20) ;
    const gapY2 = gapY1 + gapHeight + 20;

    const q = nextQuestion();
    const correctOnTop = Math.random() < 0.5;

    wall = {
      x: width + 40,
      thickness: 30,
      resolved: false,
      prompt: q.prompt,
      top: { y0: gapY1, y1: gapY1 + gapHeight, text: correctOnTop ? q.correct : q.wrong, isCorrect: correctOnTop },
      bottom: { y0: gapY2, y1: gapY2 + gapHeight, text: correctOnTop ? q.wrong : q.correct, isCorrect: !correctOnTop },
    };
  }

  function reset() {
    bird.x = width * 0.22;
    bird.y = height / 2;
    bird.vy = 0;
    score = 0;
    spawnWall();
  }

  function flap() {
    if (!running) return;
    bird.vy = -7.4;
  }

  function onKey(e) {
    if (e.code === "Space") {
      e.preventDefault();
      flap();
    }
  }
  function onPointer(e) {
    e.preventDefault();
    flap();
  }
  window.addEventListener("keydown", onKey);
  canvas.addEventListener("pointerdown", onPointer);

  function update() {
    const { speed } = difficulty();
    bird.vy += 0.34;
    bird.y += bird.vy;
    if (bird.y - bird.r < 0) {
      bird.y = bird.r;
      bird.vy = 0;
    }
    if (bird.y + bird.r > height) {
      bird.y = height - bird.r;
      bird.vy = 0;
    }

    if (wall) {
      wall.x -= speed;
      const birdLeft = bird.x - bird.r;
      const birdRight = bird.x + bird.r;
      const wallLeft = wall.x;
      const wallRight = wall.x + wall.thickness;

      if (!wall.resolved && birdRight > wallLeft && birdLeft < wallRight) {
        const inTop = bird.y + bird.r > wall.top.y0 && bird.y - bird.r < wall.top.y1;
        const inBottom = bird.y + bird.r > wall.bottom.y0 && bird.y - bird.r < wall.bottom.y1;
        if (!inTop && !inBottom) {
          // Hit the solid wall — bounce back, no points, keep flying.
          bird.vy = 2.5;
          wall.x += speed + 4;
        } else if (birdLeft > wallLeft + wall.thickness / 2) {
          // Passed the midpoint inside a gap — resolve the question.
          const chose = inTop ? wall.top : wall.bottom;
          wall.resolved = true;
          if (chose.isCorrect) {
            score = Math.min(TARGET_SCORE, score + POINTS_PER_CORRECT);
            flashGood = true;
          } else {
            flashGood = false;
          }
          flashUntil = performance.now() + 500;
        }
      }

      if (wall.x + wall.thickness < 0) {
        spawnWall();
      }
    }

    if (score >= TARGET_SCORE) {
      finish();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#bfe7ff");
    grad.addColorStop(1, "#eaf9ff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    if (wall) {
      ctx.fillStyle = "#5b7ea8";
      ctx.fillRect(wall.x, 0, wall.thickness, wall.top.y0);
      ctx.fillRect(wall.x, wall.top.y1, wall.thickness, wall.bottom.y0 - wall.top.y1);
      ctx.fillRect(wall.x, wall.bottom.y1, wall.thickness, height - wall.bottom.y1);

      drawLabel(wall.top, wall.x);
      drawLabel(wall.bottom, wall.x);
    }

    // bird
    ctx.font = `${bird.r * 2.2}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(Math.max(-0.5, Math.min(0.9, bird.vy / 12)));
    ctx.fillText("🐦", 0, 0);
    ctx.restore();

    if (performance.now() < flashUntil) {
      ctx.fillStyle = flashGood ? "rgba(70,200,120,0.25)" : "rgba(220,80,80,0.25)";
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawLabel(gap, wallX) {
    const midY = (gap.y0 + gap.y1) / 2;
    const boxWidth = Math.min(width * 0.42, 260);
    const x = Math.min(wallX + 45, width - boxWidth - 10);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const boxHeight = 34;
    roundRect(ctx, x, midY - boxHeight / 2, boxWidth, boxHeight, 8);
    ctx.fill();
    ctx.fillStyle = "#1a2b3c";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(gap.text, 34), x + 10, midY, boxWidth - 20);
  }

  function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawHud() {
    hud.innerHTML = "";
    const scoreEl = document.createElement("div");
    scoreEl.className = "bird-score";
    scoreEl.textContent = `${score} / ${TARGET_SCORE}`;
    const bar = document.createElement("div");
    bar.className = "bird-progress";
    const fill = document.createElement("div");
    fill.className = "bird-progress-fill";
    fill.style.width = `${(score / TARGET_SCORE) * 100}%`;
    bar.appendChild(fill);
    const prompt = document.createElement("div");
    prompt.className = "bird-prompt";
    prompt.textContent = wall ? wall.prompt : "";
    hud.appendChild(scoreEl);
    hud.appendChild(bar);
    hud.appendChild(prompt);
  }

  let rafId;
  function loop() {
    if (!running) return;
    update();
    draw();
    drawHud();
    rafId = requestAnimationFrame(loop);
  }

  function cleanup() {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("pointerdown", onPointer);
  }

  function finish() {
    cleanup();
    setTimeout(onFinish, 400);
  }

  reset();
  loop();
}
