import { marked } from 'marked';
import purify from 'dompurify';
import type {
  DOMPurify as DOMPurifyInstance,
  UponSanitizeAttributeHook as SanitizeAttrHook,
} from 'dompurify';

// Configure once at module load. GFM keeps tables / fenced code, but
// `breaks: false` means a single newline does NOT become a <br/> — we want
// authored markdown semantics for NEXT ACTION blocks, not chat-style autolinking.
marked.setOptions({ gfm: true, breaks: false });

// DOMPurify needs a DOM window. The browser supplies the global; vitest runs
// this module under `@vitest-environment jsdom` (see test/markdown.test.ts),
// which also defines `window`. No Node-only fallback exists: this module is
// client code, and the tests pin that assumption.
function createSanitizer(): DOMPurifyInstance {
  if (typeof window === 'undefined') {
    throw new Error('markdown.ts requires a DOM window (browser or jsdom test env)');
  }
  return purify(window);
}

// DOMPurify defaults already drop <script>, event handlers, and dangerous
// elements. The remaining gap is URL schemes: the default URI allowlist still
// permits several exotic-but-legit schemes (ftp, tel, sms…). PRD prose
// legitimately carries only http(s), mailto, and relative URLs (page.html,
// docs/x.md, ../up, #anchor, ?q, //host/path — no scheme), so this hook blanks
// the attribute value for any other scheme. Text survives: a
// `[click](javascript:…)` renders as an inert link, per the Socket gptAnomaly
// remediation.
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

const stripExoticSchemes: SanitizeAttrHook = (_node, data) => {
  if (data.attrName !== 'href' && data.attrName !== 'src') return;
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(data.attrValue);
  if (m && !ALLOWED_SCHEMES.has(m[1].toLowerCase())) data.attrValue = '';
};

// Trust boundary: input is PRD content rendered into `dangerouslySetInnerHTML`
// (checkpoint nextAction / decisions / blockers from `.dev/<feature>/`). That
// content is authored by agents with access to *untrusted* repositories and web
// research, so it is treated as untrusted data: every render passes DOMPurify
// before it reaches the DOM.
let sanitizer: DOMPurifyInstance | null = null;

function sanitize(html: string): string {
  sanitizer ??= createSanitizer();
  // DOMPurify returns string unless RETURN_TRUSTED_TYPE is set (it is not).
  return sanitizer.sanitize(html, { uponSanitizeAttribute: stripExoticSchemes }) as string;
}

export function render(text: string): string {
  return sanitize(marked.parse(text, { async: false }) as string);
}

export function renderInline(text: string): string {
  return sanitize(marked.parseInline(text, { async: false }) as string);
}
