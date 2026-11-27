"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal]";

export function Reveal() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new WeakSet<Element>();
    const observer = reduce
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.classList.add("is-revealed");
              observer?.unobserve(entry.target);
            }
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
        );

    const add = (element: Element) => {
      if (seen.has(element)) return;
      seen.add(element);
      if (observer) observer.observe(element);
      else element.classList.add("is-revealed");
    };

    const register = (root: ParentNode) => {
      root.querySelectorAll(SELECTOR).forEach(add);
    };

    register(document);

    const mutation = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches(SELECTOR)) add(node);
          register(node);
        }
      }
    });
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutation.disconnect();
    };
  }, []);

  return null;
}
