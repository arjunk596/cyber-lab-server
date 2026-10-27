/* ==========================================================================
   quiz.js — OWNER: Manvith Karkera
   Purpose: quiz rendering and scoring (Lab.Quiz, CONTRACT §5.8).
   Shows ONE question at a time with four radio-style option buttons, a Submit
   button, immediate feedback (.is-correct / .is-wrong plus the explanation; a
   wrong answer also shows the right option and why), a Next button and a
   "Question 2 of 6" progress label. At the end it shows the score in
   #quiz-score and calls onFinished({ score, total }) exactly once.
   Accessibility: fieldset + legend, a radiogroup with arrow-key navigation,
   focus moves to the feedback after Submit and to the next question after Next.
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  var container = null;
  var questions = [];
  var onFinishedCb = null;
  var index = 0;
  var score = 0;
  var finishedFired = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function scoreEl() { return document.getElementById('quiz-score'); }

  function clearScore() {
    var s = scoreEl();
    if (s) s.textContent = '';
  }

  function renderQuestion() {
    var q = questions[index];
    container.textContent = '';

    var progress = el('p', 'quiz-progress', 'Question ' + (index + 1) + ' of ' + questions.length);
    var bar = el('div', 'quiz-progress__track');
    bar.setAttribute('aria-hidden', 'true');
    var fill = el('div', 'quiz-progress__bar');
    fill.style.width = (index / questions.length * 100) + '%';
    bar.appendChild(fill);

    var fieldset = el('fieldset', 'quiz-question');
    var legend = el('legend', null, q.question);
    legend.id = 'quiz-legend-' + q.id;
    fieldset.appendChild(legend);

    var group = el('div', 'quiz-options');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-labelledby', legend.id);

    var options = [];
    var selected = -1;

    function select(i) {
      selected = i;
      options.forEach(function (btn, k) {
        btn.setAttribute('aria-checked', k === i ? 'true' : 'false');
        btn.tabIndex = k === i ? 0 : -1;
        btn.classList.toggle('is-selected', k === i);
      });
      submit.disabled = false;
    }

    q.options.forEach(function (text, i) {
      var btn = el('button', 'quiz-option');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.tabIndex = i === 0 ? 0 : -1;                                // roving tabindex: one tab stop for the group
      var letter = el('span', 'quiz-option__key', String.fromCharCode(65 + i));
      letter.setAttribute('aria-hidden', 'true');
      btn.appendChild(letter);
      btn.appendChild(el('span', 'quiz-option__text', text));
      btn.addEventListener('click', function () { select(i); });
      btn.addEventListener('keydown', function (e) {
        var next = -1;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % options.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + options.length) % options.length;
        if (next >= 0) { e.preventDefault(); options[next].focus(); select(next); }
      });
      options.push(btn);
      group.appendChild(btn);
    });
    fieldset.appendChild(group);

    var feedback = el('div', 'quiz-feedback');
    feedback.tabIndex = -1;
    feedback.setAttribute('role', 'status');

    var actions = el('div', 'quiz-actions');
    var submit = el('button', 'btn btn--primary', 'Submit answer');
    submit.type = 'button';
    submit.disabled = true;
    var next = el('button', 'btn btn--primary', index === questions.length - 1 ? 'See my score' : 'Next question');
    next.type = 'button';
    next.hidden = true;
    actions.appendChild(submit);
    actions.appendChild(next);

    submit.addEventListener('click', function () {
      if (selected < 0) return;
      var correct = q.answer;
      var right = selected === correct;
      if (right) score++;
      options.forEach(function (btn, k) {
        btn.disabled = true;                                           // answered: no more changes
        if (k === correct) btn.classList.add('is-correct');
        if (k === selected && !right) btn.classList.add('is-wrong');
      });
      feedback.textContent = '';
      feedback.appendChild(el('strong', null, right ? 'Correct. ' : 'Not quite. '));
      if (!right) feedback.appendChild(document.createTextNode('The right answer is “' + q.options[correct] + '”. '));
      feedback.appendChild(document.createTextNode(q.explanation));
      submit.hidden = true;
      next.hidden = false;
      feedback.focus();
    });

    next.addEventListener('click', function () {
      index++;
      if (index < questions.length) {
        renderQuestion();
        var first = container.querySelector('.quiz-option');
        if (first) first.focus();
      } else {
        showResult();
      }
    });

    container.appendChild(progress);
    container.appendChild(bar);
    container.appendChild(fieldset);
    container.appendChild(feedback);
    container.appendChild(actions);
  }

  function showResult() {
    var total = questions.length;
    var percent = Math.round(score / total * 100);
    container.textContent = '';
    var summary = el('div', 'quiz-result');
    summary.tabIndex = -1;
    summary.appendChild(el('p', 'quiz-result__score', score + ' / ' + total));
    summary.appendChild(el('p', null, percent >= 67
      ? 'Well done! You understand how a SYN flood works and how defences help.'
      : 'Good effort. Review the theory and the comparison table, then reset the lab to try again.'));
    container.appendChild(summary);

    var s = scoreEl();
    if (s) s.textContent = 'Quiz score: ' + score + ' / ' + total + ' (' + percent + '%)';
    summary.focus();

    if (!finishedFired) {
      finishedFired = true;
      if (typeof onFinishedCb === 'function') onFinishedCb({ score: score, total: total });
    }
  }

  Lab.Quiz = {
    init: function (containerEl, qs, onFinished) {
      container = containerEl;
      questions = qs || [];
      onFinishedCb = onFinished;
      index = 0;
      score = 0;
      finishedFired = false;
      clearScore();
      if (!container) return;
      if (!questions.length) { container.textContent = ''; return; }
      renderQuestion();
    },

    reset: function () {
      index = 0;
      score = 0;
      finishedFired = false;
      if (container) container.textContent = '';
      clearScore();
    }
  };
})(window.Lab);
