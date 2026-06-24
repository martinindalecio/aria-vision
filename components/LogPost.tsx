"use client";

import ReactMarkdown from "react-markdown";

export default function LogPost({ body }: { body: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p
            className="mb-4 leading-relaxed"
            style={{ fontFamily: "'Newsreader', Georgia, serif", color: "var(--dust)", fontSize: "17px", lineHeight: "1.65" }}
          >
            {children}
          </p>
        ),
        em: ({ children }) => (
          <em className="italic" style={{ color: "var(--dust)" }}>{children}</em>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-hud">{children}</strong>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-6 font-mono text-sm tracking-widest text-hud-dim">
            {children}
          </h2>
        ),
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
