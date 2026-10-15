# Selected-word flashcards — v207

Entry points: standard middle/high/CSAT word selection, personal books, wrong notebook, and school vocabulary selection. Original source records and mastery flags are never changed.

Study: English/meaning direction, optional shuffle, reveal before decision, known removes from queue, again rotates to back, undo up to 50 decisions, completion/restart, native English speech where available. A browser-local session is saved under the authenticated student ID after each decision. One active session per student per browser; a new session replaces the previous one with an explicit notice. Resume buttons appear in all source screens. No backend requests or experience rewards are added. Cross-device syncing and spaced repetition are out of scope.

Confirmation quiz uses selected words only, unique answer options, accepts alternative answers for duplicate prompts, locks answers, and offers missed-only study. Requires at least two distinct answer values; one-word card study remains available. Quiz results are practice-only and are not persisted as scored exam records.

Validation: existing npm suite plus verify_flashcards.cjs (four adapters, queue transitions, undo, resume, reverse direction, practice/retry, one card, account separation, escaping, source immutability). Chromium real-page CSS fixture verify_flashcards_browser.cjs checks 320x568, 393, 768, 1280 and very long text: controls in viewport, content scrollable, no horizontal overflow. Physical iOS/Android and platform speech voices were not tested.
