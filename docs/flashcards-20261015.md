# Selected-word flashcards — v207

Entry points: standard middle/high/CSAT word selection, personal books, wrong notebook, and school vocabulary selection. Original source records and mastery flags are never changed.

Study: English/meaning direction, optional shuffle, hold-to-peek (pointer/keyboard), decisions available without revealing, known removes from queue, again rotates to back, undo up to 50 decisions, completion/restart, native English speech where available. A browser-local session is saved under the authenticated student ID after each decision. One active session per student per browser; a new session replaces the previous one with an explicit notice. Resume buttons appear in all source screens. No backend requests or experience rewards are added. Cross-device syncing and spaced repetition are out of scope.

Confirmation quiz uses selected words only, unique answer options, accepts alternative answers for duplicate prompts, locks answers, and offers missed-only study. Requires at least two distinct answer values; one-word card study remains available. Quiz results are practice-only and are not persisted as scored exam records.

Validation: existing npm suite plus verify_flashcards.cjs (four adapters, queue transitions, undo, resume, reverse direction, practice/retry, one card, account separation, escaping, source immutability). Chromium real-page CSS fixture verify_flashcards_browser.cjs checks 320x568, 393, 768, 1280 and very long text: controls in viewport, content scrollable, no horizontal overflow. Physical iOS/Android and platform speech voices were not tested.

## v210 compact study
Card reveals the answer immediately while pressed and hides it on release, cancellation, focus loss, or page hiding. No flip animation. Decisions remain available. Exit confirmation retains the queue and allows continuing; failed local saves block exit and offer retry. Practice quiz results remain ephemeral. Compact mobile study groups the card and decisions; long content scrolls above visible controls.

## v211 exam consistency
Practice uses the shared standard word-test CSS, with concise completion and result summaries. Correct answers advance after 600 ms; incorrect answers wait for Next. Exit pauses auto-advance; continuing restores the graded question without scoring twice. Tests cover automatic last-question results, wrong-answer waiting, exit/continue during feedback, and four options on a small viewport.

## v212 settings and outcome panels
Settings, completion, and results use a compact shared panel. Native direction radios are presented as segments, shuffle as a labelled switch. Outcome metrics and actions stay grouped. Headings opt out of automatic icon decoration to prevent injected check icons from shifting alignment. Browser verification includes the real icon decorator and all three screens.
