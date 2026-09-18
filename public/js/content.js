// DEMO / FALLBACK content only.
//
// In normal use, play.html fetches live content from the server's
// /api/content endpoint, which reads it straight out of your Google Docs
// (see README.md for how that's configured). This file is what the game
// falls back to if that fetch fails — e.g. the server isn't deployed yet,
// or you're opening play.html directly without running the server — so
// there's always something playable to test with. You don't need to edit
// this weekly; edit your Google Doc instead.
//
// Every round in the game pulls ~90% of its questions from `week` and
// ~10% from `course`, so the game is mostly about the newest material
// but never lets older vocab/grammar fully fade. The live content from
// Drive follows this exact same shape (see server/parseContent.js).

export const CONTENT = {
  weekLabel: "Week of 14–18 Sept: Direct & Indirect Communication, Predictions, Digital Nomad Vocab",

  week: {
    // Used by the Matching round, and to build some MCQ/bird-game questions.
    vocabMatch: [
      { term: "Assertive", definition: "Confident about what you want, without being rude" },
      { term: "Blunt", definition: "So honest that it can sound rude" },
      { term: "Straightforward", definition: "Direct and honest — gets straight to the point" },
      { term: "Outspoken", definition: "Willing to share your opinion openly, even if it's unpopular" },
      { term: "Tactful", definition: "Careful and kind when dealing with a difficult topic" },
      { term: "Reserved", definition: "Quiet, and doesn't show feelings easily around new people" },
      { term: "Vague", definition: "Not clear — hard to know exactly what someone means" },
      { term: "Passive-aggressive", definition: "Showing anger or annoyance indirectly, instead of saying it openly" },
    ],

    mcq: [
      {
        q: "Which word describes someone who gets straight to the point, even about difficult topics?",
        options: ["Tactful", "Straightforward", "Vague", "Reserved"],
        correct: 1,
        explain: "Straightforward = direct and honest, without wasting time getting to the point.",
      },
      {
        q: "Ibrahim always says what he wants but never offends people. He is...",
        options: ["Blunt", "Vague", "Assertive", "Passive-aggressive"],
        correct: 2,
        explain: "Assertive = confident about what you want, without being rude.",
      },
      {
        q: "\"You'll always need a person to react to bad weather.\" — this 2003 prediction about self-driving cars turned out to be...",
        options: ["completely correct", "wrong so far — self-driving cars now exist", "impossible to check", "about phones, not cars"],
        correct: 1,
      },
      {
        q: "Complete: In 2019, Marcus was convinced that electric vehicles ___ no future.",
        options: ["have", "had", "will have", "having"],
        correct: 1,
        explain: "Reported past belief → back-shift to 'had' (past perfect not required here, just simple past).",
      },
      {
        q: "\"Attach yourself to a routine and it's hard to leave\" — digital nomads call this being...",
        options: ["tied down", "set aside", "left behind", "get ahead"],
        correct: 0,
      },
      {
        q: "Which word means the opposite of 'reserved' in this context?",
        options: ["Tactful", "Outspoken", "Vague", "Blunt"],
        correct: 1,
        explain: "Reserved (quiet, holds back) is the opposite of outspoken (shares opinions freely).",
      },
      {
        q: "Someone who is passive-aggressive shows anger...",
        options: ["loudly and directly", "indirectly, not openly", "only to strangers", "by apologising immediately"],
        correct: 1,
      },
      {
        q: "\"Focus only on the report until it's finished\" — in the digital nomad reading, this is called...",
        options: ["slacking off", "knuckling down", "piecing together", "getting ahead"],
        correct: 1,
      },
    ],

    gapFill: [
      { sentence: "Someone who is blunt is honest in a way that can sound ___.", answer: "rude", accept: ["rude", "offensive"] },
      { sentence: "If you are outspoken, you are ___ willing to share your opinion.", answer: "very", accept: ["very", "quite"] },
      { sentence: "When someone is vague, it's not very ___ what they mean.", answer: "clear", accept: ["clear", "obvious"] },
      { sentence: "A reserved person doesn't like showing their ___ around new people.", answer: "feelings", accept: ["feelings", "emotions"] },
      { sentence: "In 2009, Camila didn't expect that streaming services ___ become popular.", answer: "would", accept: ["would"] },
      { sentence: "Digital nomads don't have a boss and can set their own ___.", answer: "hours", accept: ["hours", "schedule"] },
      { sentence: "If you want to succeed at work, you need to ___ ahead of deadlines.", answer: "get", accept: ["get"] },
    ],

    errorSpotting: [
      {
        wrong: "My daughter has 14 years old.",
        correct: "My daughter is 14 years old.",
        note: "Use the verb 'to be' with age in English, not 'to have'.",
      },
      {
        wrong: "The electrics cars will not have future because there is not energy stations.",
        correct: "Electric cars won't have a future because there aren't enough charging stations.",
        note: "Adjective order (electric cars, not 'electrics cars'), 'a future', and 'there aren't' for plural nouns.",
      },
      {
        wrong: "She is always trying to justify herself, she don't like to admit mistakes.",
        correct: "She is always trying to justify herself; she doesn't like to admit mistakes.",
        note: "Third person singular needs 'doesn't', not 'don't'.",
      },
      {
        wrong: "I am agree that streaming services are more popular than TV.",
        correct: "I agree that streaming services are more popular than TV.",
        note: "'Agree' is a normal verb in English — never use 'am/is/are' before it.",
      },
    ],

    writing: [
      {
        prompt:
          "You are running for mayor and want to modernise your town with smart technology. Write 3–5 promises to your citizens. Start every sentence with \"I will...\" and give a reason with 'because'.",
        sample:
          "I will install free Wi-Fi in all public areas because everybody deserves a chance to be connected. I will introduce driverless shuttle buses because they reduce traffic and pollution. I will build more green spaces because they improve people's mental health.",
      },
      {
        prompt:
          "Describe a person you know using at least three of this week's words (assertive, blunt, tactful, reserved, outspoken, vague, straightforward, passive-aggressive). Write 3–5 sentences.",
        sample:
          "My colleague is very straightforward — she always tells you exactly what she thinks. She's never blunt about it, though; she's actually quite tactful when the topic is sensitive. She's also fairly outspoken in meetings.",
      },
    ],
  },

  // Smaller pool covering earlier weeks — keeps older material alive without
  // taking over the review.
  course: {
    vocabMatch: [
      { term: "In my opinion", definition: "A phrase used to introduce your personal point of view" },
      { term: "As far as I'm concerned", definition: "A phrase meaning 'from my perspective'" },
      { term: "Knuckle down", definition: "To start focusing seriously on a task" },
      { term: "Set aside", definition: "To reserve or save something for later" },
    ],
    mcq: [
      {
        q: "Which sentence uses 'there is/are' correctly?",
        options: ["There is a lamp on the desk.", "There a lamp is on the desk.", "Is there a lamp on the desk is.", "The desk there is a lamp."],
        correct: 0,
      },
      {
        q: "\"This gadget has the ___ screen of all of them.\" (biggest/most big)",
        options: ["biggest", "most big", "bigger", "more bigger"],
        correct: 0,
      },
      {
        q: "Complete: Have you ___ this film before?",
        options: ["see", "saw", "seen", "seeing"],
        correct: 2,
        explain: "Present perfect: have/has + past participle.",
      },
    ],
    gapFill: [
      { sentence: "___ my opinion, remote work is here to stay.", answer: "In", accept: ["In"] },
      { sentence: "This laptop is much ___ powerful than my old one.", answer: "more", accept: ["more"] },
      { sentence: "I always ___ a break every two hours when I work from home.", answer: "take", accept: ["take"] },
    ],
    errorSpotting: [
      {
        wrong: "This soup have tomatoes in it and I hate it.",
        correct: "This soup has tomatoes in it and I hate it.",
        note: "Third person singular ('soup') needs 'has', not 'have'.",
      },
      {
        wrong: "She is more taller than her brother.",
        correct: "She is taller than her brother.",
        note: "Don't combine 'more' with an '-er' comparative — pick one form.",
      },
    ],
    writing: [
      {
        prompt: "In 3 sentences, give your opinion on a four-day working week. Use at least one opinion phrase (e.g. 'In my opinion...', 'As far as I'm concerned...').",
        sample:
          "In my opinion, a four-day working week would make people more productive, not less. As far as I'm concerned, companies that have tried it have seen happier employees. I think more businesses should experiment with it.",
      },
    ],
  },
};
