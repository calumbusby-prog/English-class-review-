import { startBirdGame } from "./bird.js";

const WEEK_WEIGHT = 0.9;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks `n` items from weekArr/courseArr at roughly a 90/10 rate, without
// repeats (unless a pool is smaller than what's being asked for).
function pickWeighted(weekArr, courseArr, n) {
  const week = shuffle(weekArr || []);
  const course = shuffle(courseArr || []);
  const picks = [];
  let wi = 0;
  let ci = 0;
  for (let i = 0; i < n; i++) {
    const useCourse = course.length > 0 && (week.length === 0 || Math.random() > WEEK_WEIGHT);
    if (useCourse && ci < course.length) {
      picks.push({ item: course[ci++], source: "course" });
    } else if (wi < week.length) {
      picks.push({ item: week[wi++], source: "week" });
    } else if (ci < course.length) {
      picks.push({ item: course[ci++], source: "course" });
    } else {
      // Pools exhausted — start recycling rather than shrinking the round.
      wi = 0;
      ci = 0;
      if (week.length) picks.push({ item: week[wi++], source: "week" });
      else if (course.length) picks.push({ item: course[ci++], source: "course" });
    }
  }
  return picks.map((p) => p.item);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

const CATEGORIES = ["vocabMatch", "mcq", "gapFill", "errorSpotting", "writing"];

// Fills in any category a live-fetched doc didn't have tags for, so the
// rest of the engine never has to null-check `content.week.mcq` etc.
function normalizeContent(content) {
  const safe = { weekLabel: content?.weekLabel || "This week's review", week: {}, course: {} };
  for (const cat of CATEGORIES) {
    safe.week[cat] = content?.week?.[cat] || [];
    safe.course[cat] = content?.course?.[cat] || [];
  }
  return safe;
}

export class GameEngine {
  constructor(root, content, options = {}) {
    this.root = root;
    this.content = normalizeContent(content);
    this.usingDemo = Boolean(options.usingDemo);
    this.score = 0;
    this.total = 0;
  }

  renderProgress(label) {
    return el("div", { class: "progress-label" }, label);
  }

  awardPoint(correct) {
    this.total++;
    if (correct) this.score++;
  }

  async run() {
    await this.introScreen();
    await this.mcqRound();
    await this.gapFillRound();
    await this.matchingRound();
    await this.errorRound();
    await this.writingRound();
    await this.summaryScreen();
    await this.birdFinale();
  }

  clear() {
    this.root.innerHTML = "";
  }

  waitForClick(button) {
    return new Promise((resolve) => {
      button.addEventListener("click", () => resolve(), { once: true });
    });
  }

  introScreen() {
    this.clear();
    const btn = el("button", { class: "btn btn-primary" }, "Start review");
    this.root.appendChild(
      el("div", { class: "card center" }, [
        el("h1", {}, "Weekly Review"),
        el("p", { class: "muted" }, this.content.weekLabel),
        el("p", {}, "5 quick rounds, then a final challenge. Let's go!"),
        this.usingDemo
          ? el("p", { class: "muted demo-note" }, "⚠ Couldn't reach this week's document — playing with sample content instead.")
          : null,
        btn,
      ])
    );
    return this.waitForClick(btn);
  }

  async mcqRound() {
    const items = pickWeighted(this.content.week.mcq, this.content.course.mcq, 5);
    for (let i = 0; i < items.length; i++) {
      await this.mcqQuestion(items[i], i + 1, items.length);
    }
  }

  mcqQuestion(item, index, count) {
    this.clear();
    const feedback = el("div", { class: "feedback" });
    const optionsWrap = el("div", { class: "options" });
    const nextBtn = el("button", { class: "btn btn-primary hidden" }, "Continue");

    item.options.forEach((opt, i) => {
      const b = el("button", { class: "option" }, opt);
      b.addEventListener("click", () => {
        if (optionsWrap.dataset.answered) return;
        optionsWrap.dataset.answered = "1";
        const correct = i === item.correct;
        this.awardPoint(correct);
        b.classList.add(correct ? "correct" : "incorrect");
        if (!correct) {
          optionsWrap.children[item.correct].classList.add("correct");
        }
        feedback.textContent = correct
          ? "Correct!"
          : item.explain
          ? `Not quite. ${item.explain}`
          : "Not quite — see the highlighted answer.";
        feedback.classList.add(correct ? "good" : "bad");
        nextBtn.classList.remove("hidden");
      });
      optionsWrap.appendChild(b);
    });

    this.root.appendChild(
      el("div", { class: "card" }, [
        this.renderProgress(`Multiple choice — question ${index} of ${count}`),
        el("h2", {}, item.q),
        optionsWrap,
        feedback,
        nextBtn,
      ])
    );
    return this.waitForClick(nextBtn);
  }

  async gapFillRound() {
    const items = pickWeighted(this.content.week.gapFill, this.content.course.gapFill, 5);
    for (let i = 0; i < items.length; i++) {
      await this.gapFillQuestion(items[i], i + 1, items.length);
    }
  }

  gapFillQuestion(item, index, count) {
    this.clear();
    const input = el("input", { class: "text-input", type: "text", placeholder: "Type the missing word..." });
    const submitBtn = el("button", { class: "btn btn-primary" }, "Check");
    const nextBtn = el("button", { class: "btn btn-primary hidden" }, "Continue");
    const feedback = el("div", { class: "feedback" });
    const parts = item.sentence.split("___");

    const submit = () => {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      const val = input.value.trim().toLowerCase();
      const accepted = (item.accept || [item.answer]).map((a) => a.toLowerCase());
      const correct = accepted.includes(val);
      this.awardPoint(correct);
      input.classList.add(correct ? "correct" : "incorrect");
      feedback.textContent = correct ? "Correct!" : `Not quite — the answer was "${item.answer}".`;
      feedback.classList.add(correct ? "good" : "bad");
      submitBtn.classList.add("hidden");
      nextBtn.classList.remove("hidden");
    };
    submitBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    this.root.appendChild(
      el("div", { class: "card" }, [
        this.renderProgress(`Gap fill — question ${index} of ${count}`),
        el("p", { class: "sentence" }, [parts[0], input, parts[1]]),
        submitBtn,
        feedback,
        nextBtn,
      ])
    );
    setTimeout(() => input.focus(), 0);
    return this.waitForClick(nextBtn);
  }

  matchingRound() {
    const pairs = shuffle(pickWeighted(this.content.week.vocabMatch, this.content.course.vocabMatch, 6));
    if (!pairs.length) return Promise.resolve();
    return new Promise((resolve) => {
      this.clear();
      const terms = shuffle(pairs.map((p, i) => ({ text: p.term, id: i })));
      const defs = shuffle(pairs.map((p, i) => ({ text: p.definition, id: i })));
      let matched = 0;
      let selectedTerm = null;

      const termsWrap = el("div", { class: "match-col" });
      const defsWrap = el("div", { class: "match-col" });
      const feedback = el("div", { class: "feedback" });
      const nextBtn = el("button", { class: "btn btn-primary hidden" }, "Continue");

      const termButtons = new Map();
      const defButtons = new Map();

      terms.forEach((t) => {
        const b = el("button", { class: "option match-item" }, t.text);
        b.addEventListener("click", () => {
          if (b.classList.contains("matched")) return;
          for (const btn of termButtons.values()) btn.classList.remove("selected");
          selectedTerm = t;
          b.classList.add("selected");
        });
        termButtons.set(t.id, b);
        termsWrap.appendChild(b);
      });

      defs.forEach((d) => {
        const b = el("button", { class: "option match-item" }, d.text);
        b.addEventListener("click", () => {
          if (b.classList.contains("matched") || !selectedTerm) return;
          const correct = selectedTerm.id === d.id;
          if (correct) {
            b.classList.add("matched", "correct");
            termButtons.get(selectedTerm.id).classList.add("matched", "correct");
            matched++;
            selectedTerm = null;
            if (matched === pairs.length) {
              this.score += pairs.length;
              this.total += pairs.length;
              feedback.textContent = "All matched! Nice work.";
              feedback.classList.add("good");
              nextBtn.classList.remove("hidden");
            }
          } else {
            b.classList.add("incorrect");
            setTimeout(() => b.classList.remove("incorrect"), 400);
          }
        });
        defButtons.set(d.id, b);
        defsWrap.appendChild(b);
      });

      this.root.appendChild(
        el("div", { class: "card" }, [
          this.renderProgress("Matching — pair each word with its meaning"),
          el("div", { class: "match-grid" }, [termsWrap, defsWrap]),
          feedback,
          nextBtn,
        ])
      );

      nextBtn.addEventListener("click", () => resolve(), { once: true });
    });
  }

  async errorRound() {
    const items = pickWeighted(this.content.week.errorSpotting, this.content.course.errorSpotting, 4);
    for (let i = 0; i < items.length; i++) {
      await this.errorQuestion(items[i], i + 1, items.length);
    }
  }

  errorQuestion(item, index, count) {
    this.clear();
    const input = el("textarea", { class: "text-input", rows: "2", placeholder: "Rewrite the sentence correctly..." });
    const submitBtn = el("button", { class: "btn btn-primary" }, "Check");
    const nextBtn = el("button", { class: "btn btn-primary hidden" }, "Continue");
    const feedback = el("div", { class: "feedback" });

    const normalize = (s) => s.toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();

    submitBtn.addEventListener("click", () => {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      const correct = normalize(input.value) === normalize(item.correct);
      this.awardPoint(correct);
      feedback.innerHTML = "";
      feedback.appendChild(
        el("p", {}, correct ? "Correct!" : "Close — here's the corrected sentence:")
      );
      if (!correct) feedback.appendChild(el("p", { class: "correct-answer" }, item.correct));
      feedback.appendChild(el("p", { class: "muted" }, item.note));
      feedback.classList.add(correct ? "good" : "bad");
      submitBtn.classList.add("hidden");
      nextBtn.classList.remove("hidden");
    });

    this.root.appendChild(
      el("div", { class: "card" }, [
        this.renderProgress(`Spot & fix the error — ${index} of ${count}`),
        el("p", { class: "sentence-wrong" }, `"${item.wrong}"`),
        input,
        submitBtn,
        feedback,
        nextBtn,
      ])
    );
    return this.waitForClick(nextBtn);
  }

  async writingRound() {
    const items = pickWeighted(this.content.week.writing, this.content.course.writing, 1);
    if (!items.length) return;
    await this.writingPrompt(items[0]);
  }

  writingPrompt(item) {
    this.clear();
    const textarea = el("textarea", { class: "text-input", rows: "5", placeholder: "Write your response here..." });
    const submitBtn = el("button", { class: "btn btn-primary" }, "See a sample answer");
    const nextBtn = el("button", { class: "btn btn-primary hidden" }, "Continue");
    const sampleBox = el("div", { class: "feedback hidden" });

    submitBtn.addEventListener("click", () => {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      this.awardPoint(textarea.value.trim().length > 0);
      sampleBox.classList.remove("hidden");
      sampleBox.innerHTML = "";
      sampleBox.appendChild(el("p", { class: "muted" }, "One possible answer:"));
      sampleBox.appendChild(el("p", {}, item.sample));
      submitBtn.classList.add("hidden");
      nextBtn.classList.remove("hidden");
    });

    this.root.appendChild(
      el("div", { class: "card" }, [
        this.renderProgress("Write a response"),
        el("h2", {}, item.prompt),
        textarea,
        submitBtn,
        sampleBox,
        nextBtn,
      ])
    );
    return this.waitForClick(nextBtn);
  }

  summaryScreen() {
    this.clear();
    const pct = this.total ? Math.round((this.score / this.total) * 100) : 0;
    const btn = el("button", { class: "btn btn-primary" }, "Start the final challenge");
    this.root.appendChild(
      el("div", { class: "card center" }, [
        el("h1", {}, "Round complete!"),
        el("p", { class: "big-score" }, `${this.score} / ${this.total} (${pct}%)`),
        el("p", {}, "One last challenge: fly the bird through the correct answer to reach 200 points."),
        btn,
      ])
    );
    return this.waitForClick(btn);
  }

  buildDuelPool() {
    const duels = [];

    const mcqAll = [...this.content.week.mcq, ...this.content.course.mcq];
    for (const m of mcqAll) {
      const wrongIdx = [...m.options.keys()].filter((i) => i !== m.correct);
      const wrong = m.options[wrongIdx[Math.floor(Math.random() * wrongIdx.length)]];
      duels.push({ prompt: m.q, correct: m.options[m.correct], wrong, weight: 3 });
    }

    const vocabAll = [...this.content.week.vocabMatch, ...this.content.course.vocabMatch];
    for (const v of vocabAll) {
      const distractorPool = vocabAll.filter((o) => o.term !== v.term);
      if (!distractorPool.length) continue;
      const distractor = distractorPool[Math.floor(Math.random() * distractorPool.length)];
      duels.push({
        prompt: `"${v.term}" means...`,
        correct: v.definition,
        wrong: distractor.definition,
        weight: 3,
      });
    }

    const errAll = [...this.content.week.errorSpotting, ...this.content.course.errorSpotting];
    for (const e of errAll) {
      duels.push({ prompt: "Which sentence is correct?", correct: e.correct, wrong: e.wrong, weight: 2 });
    }

    // Weight toward richer question types by repeating higher-weight duels.
    const weighted = [];
    for (const d of duels) for (let i = 0; i < d.weight; i++) weighted.push(d);
    return shuffle(weighted);
  }

  birdFinale() {
    this.clear();
    const container = el("div", { class: "bird-wrap" });
    this.root.appendChild(container);
    const pool = this.buildDuelPool();
    return new Promise((resolve) => {
      startBirdGame(container, pool, () => {
        this.finalScreen();
        resolve();
      });
    });
  }

  finalScreen() {
    this.clear();
    const btn = el("button", { class: "btn btn-primary" }, "Play again");
    this.root.appendChild(
      el("div", { class: "card center" }, [
        el("h1", {}, "You reached 200 points!"),
        el("p", {}, "Great review session. Come back next week for new material."),
        btn,
      ])
    );
    btn.addEventListener("click", () => location.reload());
  }
}
