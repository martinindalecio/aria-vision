"use client";

import ReactMarkdown from "react-markdown";

export default function LogPost({ body }: { body: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="mb-4 leading-relaxed opacity-90">{children}</p>
        ),
        em: ({ children }) => <em className="italic opacity-75">{children}</em>,
        strong: ({ children }) => (
          <strong className="font-bold text-hud">{children}</strong>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-6 text-sm tracking-widest opacity-60">
            {children}
          </h2>
        ),
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
