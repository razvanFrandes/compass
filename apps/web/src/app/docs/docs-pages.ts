/*
  The documentation hub's pages: one list for the floating Docs panel, the left navigation, the phone selector,
  the addresses and the page titles. A page that is not in this list has no address.
*/

import type { View } from '../store';

export const DOCS_BASE = '/docs';

export interface DocsPage {
  id: string;
  /** The name in the navigation. */
  label: string;
  /** One line under the name, in the Docs panel and on the index. */
  blurb: string;
  icon: string;
}

export const DOCS_PAGES = [
  { id: 'architecture', label: 'Architecture', blurb: 'One Worker, three durable agents, one read-only database.', icon: 'phosphorTreeStructureLight' },
  { id: 'components', label: 'Components', blurb: 'Every chart, card and control an answer or a board can show.', icon: 'phosphorPuzzlePieceLight' },
  { id: 'design-system', label: 'Design system', blurb: 'The tokens of the theme on screen, read from the page.', icon: 'phosphorPaletteLight' },
  { id: 'kassandra', label: 'Kassandra & agents', blurb: 'How a question is answered, and how an agent waits for you.', icon: 'phosphorRobotLight' },
  { id: 'data', label: 'Data & MCP', blurb: 'The data model, the metrics, the evals and the public MCP server.', icon: 'phosphorDatabaseLight' },
  { id: 'security', label: 'Security', blurb: 'How a public demo with no login stays safe and bounded.', icon: 'phosphorShieldCheckLight' },
  { id: 'decisions', label: 'Decisions', blurb: 'The choices that shaped the product, each with its reason.', icon: 'phosphorSignpostLight' },
  { id: 'about', label: 'About this build', blurb: 'What is real, what is mocked and what comes next.', icon: 'phosphorInfoLight' },
] as const satisfies readonly DocsPage[];

/** `index` is `/docs` itself: the list of pages. */
export type DocsPageId = (typeof DOCS_PAGES)[number]['id'] | 'index';

export const docsPath = (id: DocsPageId): string => (id === 'index' ? DOCS_BASE : `${DOCS_BASE}/${id}`);

/** The docs page an address names: `/docs` → `index`, `/docs/security/` → `security`. Null for any other address. */
export function docsPageOf(pathname: string): DocsPageId | null {
  const path = pathname.replace(/\/+$/, '');
  if (path === DOCS_BASE) return 'index';
  if (!path.startsWith(`${DOCS_BASE}/`)) return null;
  const id = path.slice(DOCS_BASE.length + 1);
  return DOCS_PAGES.find((p) => p.id === id)?.id ?? null;
}

export const docsLabel = (id: DocsPageId): string => DOCS_PAGES.find((p) => p.id === id)?.label ?? 'Docs';

/** "Architecture · Docs · Juyo"; the index is "Docs · Juyo". */
export const docsTitle = (id: DocsPageId): string => (id === 'index' ? 'Docs · Juyo' : `${docsLabel(id)} · Docs · Juyo`);

/** The showcase views the docs point to. They are views of the app, not docs pages; the orb lab loads as a page. */
export const SHOWCASES: readonly { label: string; href: string; view: View | null; note: string }[] = [
  { label: 'Chart catalogue', href: '/catalog', view: 'catalog', note: 'Every chart kind, in each theme, at both densities.' },
  { label: 'Theme lab', href: '/theme-lab', view: 'theme-lab', note: 'The concept theme next to a default one, with a contrast audit.' },
  { label: 'Orb lab', href: '/orb-lab', view: null, note: 'Kassandra’s voice orb on its own, in every state.' },
];

/**
 * The public address of the repository, e.g. `https://github.com/<owner>/compass-mvp`. It is empty until the
 * repository is public: source paths in the docs are then plain text, and become links once this is set.
 */
export const REPO_URL: string = '';

/** A link to a path in the repository on its default branch, or null while the repository is not public. */
export function repoHref(path: string, kind: 'tree' | 'blob' = 'tree', base: string = REPO_URL): string | null {
  const root = base.trim().replace(/\/+$/, '');
  return root ? `${root}/${kind}/main/${path.replace(/^\/+/, '')}` : null;
}
