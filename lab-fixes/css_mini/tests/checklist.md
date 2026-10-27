# QA checklist

Run on desktop Chrome, a phone and one other browser (Firefox or Edge) at 6:00. Manvith runs it again on `dist/index.html`
before freezing. The automated parts are covered by `node tests/e2e.js` (97 checks); this list is for what a human must see.

## Student journey
- [ ] Page opens from `file://` with no console errors and makes no network requests (DevTools -> Network is empty)
- [ ] Before You Begin shows objective + 9 guidelines; Start is disabled until the checkbox is ticked; View Theory works
- [ ] Theory shows TCP, the handshake (animation plays and replays), SYN flood, availability and the analogy
- [ ] Stepper shows Locked / Ready / In progress / Completed correctly at every stage
- [ ] Step 2 baseline: handshakes animate, server stays Healthy, baseline values recorded; flood controls stay locked until it finishes
- [ ] Step 3 Low / Medium / High each give a visibly different result (Under Pressure / Degraded / Unavailable)
- [ ] Queue grid fills with attack slots; pending, CPU and response time rise; availability falls; legit packets are rejected once the queue is full
- [ ] A notification appears when the server becomes Degraded or Unavailable
- [ ] Stop halts everything instantly and the results stay on screen
- [ ] Each mitigation has an explanation and a limitation; rerunning with defences improves availability; no text claims 100% protection
- [ ] Comparison table shows baseline / attack / mitigated with a correct automatic explanation
- [ ] Quiz gives feedback per answer and explains wrong answers; score is shown
- [ ] Completion popup shows the three availability values, score and status, and only appears after everything is done
- [ ] Log entries reflect what actually happened, with timestamps

## Robustness and quality
- [ ] Rapidly clicking Start / Stop / Reset / changing level never throws or creates two running simulations
- [ ] Reset asks for confirmation when results exist, then returns everything to the start state
- [ ] Restart Lab returns to Before You Begin
- [ ] Same settings twice give the same numbers (deterministic)
- [ ] Everything is reachable and usable with the keyboard; the focus ring is visible
- [ ] Readable with no horizontal scroll at 360 px; looks right at 768 px and 1440 px
- [ ] Dark mode looks right; the reduced-motion setting stops packet animation
- [ ] Every number on the dashboard is labelled "Simulated data"

## Definition of done
Every box ticked on `dist/index.html`; `node tests/engine.test.js`, `node tests/smoke.test.js` and `node tests/e2e.js` pass; the
three-file `dist/` is zipped; demo video, README and slides are ready.
