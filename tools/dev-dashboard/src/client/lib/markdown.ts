import { marked } from 'marked';

// Configure once at module load. GFM keeps tables / fenced code, but
// `breaks: false` means a single newline does NOT become a <br/> — we want
// authored markdown semantics for NEXT ACTION blocks, not chat-style autolinking.
marked.setOptions({ gfm: true, breaks: false });

// Trust boundary: input is local PRD content authored by the user (checkpoint
// nextAction / decisions / blockers from `.dev/<feature>/checkpoint.md`).
// No DOMPurify needed today. If the surface ever extends to remote or
// multi-user content (shared dashboards, web fetch, untrusted webhooks),
// layer DOMPurify here before the HTML reaches `dangerouslySetInnerHTML`.
export function render(text: string): string {
  return marked.parse(text, { async: false }) as string;
}

export function renderInline(text: string): string {
  return marked.parseInline(text, { async: false }) as string;
}
