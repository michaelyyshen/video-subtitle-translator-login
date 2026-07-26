'use client';

import { useState } from 'react';

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="accordion">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={`accordion-item ${isOpen ? 'is-open' : ''}`}>
            <button
              className="accordion-head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span>{item.q}</span>
              <span className="accordion-icon">+</span>
            </button>
            <div className="accordion-body">
              <p dangerouslySetInnerHTML={{ __html: item.a }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
