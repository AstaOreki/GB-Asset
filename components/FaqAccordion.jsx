"use client";

import { useState } from "react";

/**
 * Accordion list for the FAQ page. `items` is `[{ question, answer }]`.
 *
 * Each item toggles independently (no "only one open at a time" rule) —
 * simplest to use when scanning several short answers, and nothing in the
 * brief asked for the more restrictive single-open behavior.
 *
 * The expand/collapse animation is pure CSS: `.faq-answer-wrap` is a grid
 * row that transitions from `0fr` to `1fr` (see page.css), which animates
 * to the answer's real height without ever measuring `scrollHeight` in JS.
 * `prefers-reduced-motion` is handled by the site's existing global rule
 * that collapses all transition durations, so no extra work is needed here.
 */
export default function FaqAccordion({ items }) {
  const [openSet, setOpenSet] = useState(() => new Set());

  function toggle(i) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="faq-list">
      {items.map((item, i) => {
        const isOpen = openSet.has(i);
        const qId = `faq-question-${i}`;
        const aId = `faq-answer-${i}`;
        return (
          <div className={`faq-item${isOpen ? " is-open" : ""}`} key={item.question}>
            <h3 className="faq-question-row">
              <button
                aria-controls={aId}
                aria-expanded={isOpen}
                className="faq-question"
                id={qId}
                onClick={() => toggle(i)}
                type="button"
              >
                <span>{item.question}</span>
                <span aria-hidden="true" className="faq-icon"></span>
              </button>
            </h3>
            <div className="faq-answer-wrap">
              <div className="faq-answer-inner">
                <div aria-labelledby={qId} className="faq-answer" id={aId} role="region">
                  <p>{item.answer}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
