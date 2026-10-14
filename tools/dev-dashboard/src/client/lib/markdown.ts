import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Config as DOMPurifyConfig, DOMPurify as DOMPurifyInstance } from 'dompurify';

// Configure once at module load. GFM keeps tables / fenced code, but
// `breaks: false` means a single newline does NOT become a <br/> — we want
// authored markdown semantics for NEXT ACTION blocks, not chat-style autolinking.
marked.setOptions({ gfm: true, breaks: false });

// Sanitizer profile. DOMPurify defaults already drop <script>, event handlers,
// and dangerous elements; the configured gap is URL schemes, where the default
// allowlist misses exotic ones. Restrict to http(s), mailto, and relative URLs
// — the only schemes PRD prose legitimately uses. Link text survives: a
// `[click](javascript:…)` renders as an inert link, per the Socket gptAnomaly
// remediation.
//
// `class` and `start` stay allowlisted so marked's own table/ol output
// survives; everything class-bearing in this client is our stylesheet.
const SANITIZE_PROFILE: DOMPurifyConfig = {
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'start'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-zA-Z0-9+#-]|[#?])/i,
};

// DOMPurify needs a DOM window. The browser supplies the global; vitest runs
// this module under `@vitest-environment jsdom` (see test/markdown.test.ts),
// which also defines `window`. No Node-only fallback exists: this module is
// client code, and the tests pin that assumption.
function createSanitizer(): DOMPurifyInstance {
  if (typeof window === 'undefined') {
    throw new Error('markdown.ts requires a DOM window (browser or jsdom test env)');
  }
  return DOMPurify(window);
}

// Trust boundary: input is PRD content rendered into `dangerouslySetInnerHTML`
// (checkpoint nextAction / decisions / blockers from `.dev/<feature>/`). That
// content is authored by agents with access to *untrusted* repositories and web
// research, so it is treated as untrusted data: every render passes DOMPurify
// before it reaches the DOM.
let sanitizer: DOMPurifyInstance | null = null;

function sanitize(html: string): string {
  sanitizer ??= createSanitizer();
  // DOMPurify returns string (not TrustedHTML) unless RETURN_TRUSTED_TYPE is set.
  return sanitizer.sanitize(html, SANITIZE_PROFILE) as string;
}

export function render(text: string): string {
  return sanitize(marked.parse(text, { async: false }) as string);
}

export function renderInline(text: string): string {
  return sanitize(marked.parseInline(text, { async: false }) as string);
}
