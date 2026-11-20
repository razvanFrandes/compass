# Boards overview and mobile excellence: research and rulebook

Researched 2026-11-20. Sources are Mobbin screens (each one opened and looked at, not judged from metadata), Apple HIG (read from Apple's own JSON doc endpoints), Google's Android/Compose docs, NN/g and W3C. Lines marked **[our call]** are decisions we derived from the sources. No guideline states them as rules.

Source gaps:
- m3.material.io renders client-side and could not be fetched, so Material guidance comes from developer.android.com and Google Accessibility Help. The M3 navigation-bar height could not be confirmed from a primary source, so this doc gives no dp height for it.
- Mobbin has no ThoughtSpot, Tableau, Power BI or Robinhood screens matching these queries. Their places are taken by Mixpanel, Amplitude, Hex, Zoho Analytics, HubSpot, Shopify, Steep, Mercury, and on iOS Stocks, Yahoo Finance, TradingView, Stake and Finimize.

---

## TL;DR

**Boards (Part A)**
1. **Show Boards as list rows, not a thumbnail grid.** Each row carries a live headline number, its delta and a sparkline, like a Stocks watchlist row. Every analytics and BI product we looked at lists its dashboards as rows. Thumbnail grids only appear in visual-design tools (Figma, Framer, MagicPath), and NN/g says to use thumbnails only when the image helps people choose.
2. **Put Pinned boards first**, then all boards sorted by last opened. Mixpanel, Hex, Amplitude, Notion, Asana, Toggl and Mercury all have a favorites, pinned or bookmarks layer.
3. **"New board" is secondary.** Most boards get created from an AI answer ("Save to board"). In the overview, put the create button top-right on desktop (Zoho, Klaviyo, HubSpot, Shopify, Steep, Hex) and as a `+` in the header on iPhone (Linear, Apple Notes, Stocks). Avoid a FAB that fights with the composer.

**Mobile (Part B)**
4. **Targets:** 44×44 pt on iOS, 48×48 dp with 8 dp gaps on Material. The WCAG 2.5.8 AA floor is 24×24 CSS px. For Compass: **44 px minimum, with 8 px between targets.**
5. **Body text 17 pt by default, never below 11 pt.** It must scale with text size up to 200%.
6. **Use a bottom tab bar with 3 to 5 labelled destinations.** Keep it visible except under modals.
7. **The composer docks at the bottom and rides on top of the keyboard.** It holds `+`, a text field that grows, and mic/send. Show a stop button while streaming and a scroll-to-latest arrow.
8. **Charts:** the whole plot area is the scrub target, with a vertical rule and a value readout. Use 3 to 5 y-ticks on the trailing side, time-range chips under the chart, and put a one-sentence takeaway above every chart.
9. **Tables:** use card rows when there are 4 or fewer columns of mixed data. Use horizontal scroll with a frozen first column, sticky header and a visibly cut-off column when the data is a real matrix.
10. **Approvals:** use a bottom sheet with a summary of rows, a before → after diff, one primary button and an explicit Cancel or X. Never stack a second sheet.

---

# Part A: Boards and dashboards overview

## A1. What the top products do

### Desktop / web

| Product | Layout | Metadata shown | Favorites / pin | Create placement | Link |
|---|---|---|---|---|---|
| Mixpanel (Home) | "Your Recents" row of **small thumbnail cards** (mini chart previews) + "See All"; "Top Boards" list with owner avatar | Name, owner avatar | Sidebar sections **Favorites / Pinned / Your Boards** | Global "+ Create New" top-left of sidebar | [Mixpanel home](https://mobbin.com/screens/4decbe7b-abda-4a6a-8ad8-8fdb723f8135) |
| Mixpanel (Board) | Board page with Spark AI suggested-question panel inline, "+ Add content" | Board title + description | — | "+ Add content" at bottom of board | [Mixpanel board + Spark](https://mobbin.com/screens/b1b2093c-54f8-4c27-a70c-41c27e868ebb) |
| Amplitude | **List rows**: type icon, name, editor avatars | Type (icon colour), editors | Top nav "Favorites", "Spaces", "Recent" | Global "Create" top-left | [Amplitude Favorites](https://mobbin.com/screens/3f77c411-c5af-432c-8f81-0cfd2a194643) |
| Hex (Projects) | **Table**, with a list/grid toggle | Title (★), Status (In development / Certified), Categories, Owner, Last viewed by you, **App views with trend arrow**, App last published | Sidebar "Favorite projects / collections / data" | "+ New project" top-right | [Hex projects](https://mobbin.com/screens/6aa08e33-4ae8-4468-a85e-ba367cc78dbe) |
| Hex (Home) | "Jump back in" recent list (name, who, time) + "Popular projects" card with a **chart thumbnail** | Owner, relative time, views, status | Favorites in sidebar | Header "New project" | [Hex home](https://mobbin.com/screens/e3760fe9-10f3-457e-b350-587bbb03858e) |
| Zoho CRM Analytics | **Table**, with a List/Grid view toggle | ★, Name, Description, Created by/time, Modified by/time, **Last accessed** | Star column; "Favorites" filter | "Create Dashboard" primary top-right; "Recently Deleted" link | [Zoho dashboards](https://mobbin.com/screens/0ea28fbd-04d8-4812-92c2-613315910202), [favorites filter](https://mobbin.com/screens/6931938f-8328-4488-bf8a-48c00a479a95) |
| Klaviyo | **Table** | Name, "View only" badge, Created, Updated, overflow ⋮ | — | "Create Dashboard" top-right | [Klaviyo dashboards](https://mobbin.com/screens/cb6c1405-14ee-46fc-b52c-a3dc3031e22b) |
| Shopify | **Table** | Name, Category chip, **Last viewed**, Created by | — | "New exploration" top-right | [Shopify reports](https://mobbin.com/screens/60c99ad3-212d-4383-9a10-afe66d0facfa) |
| Steep | **Table** + tabs All / My / Shared with me / Team | Name, Created by, **Access (Private / Everyone)**, Last updated | — | "+ New report" top-right | [Steep reports](https://mobbin.com/screens/87b9f9b9-99eb-4055-8359-241d3655961d) |
| HubSpot | **Table** + left filter tree | ☆, name, count, owner, updated | Star column | "Create report" top-right | [HubSpot reports](https://mobbin.com/screens/7e657ea9-7050-4c9e-87b1-fede3df4db39) |
| Toggl Track | **Table** | Name + subtitle, Creator, Scheduling, Sharing, Link, **Pin** | Pin column; sidebar shows "Pin your reports here" | "+ New report" top-right | [Toggl reports](https://mobbin.com/screens/3a609fc7-8d34-4ca9-868d-fc439e4ca80b) |
| Fresha | **Card-rows** (icon, title, one-line description, ☆) + category tabs | Description | Left nav: All 52 / Favourites / **Dashboards 2** / Standard / Custom / Folders, with counts | "Add" top-right | [Fresha reports](https://mobbin.com/screens/d26c22ac-8443-4dbf-9eb7-54dd3d9ae801) |
| Linear (Views) | **List rows** grouped "Personal views · Only visible to you" / "Workspace" | Name + one-line description, owner | ☆ on view header | "+" in page header | [Linear views](https://mobbin.com/screens/0eb0ef0f-7e0f-4507-a314-86e7924b2b21) |
| Linear (Projects) | **Table** | Health ("On track · 6d"), priority, lead, target date, **status % with mini progress line** | — | "+" in header | [Linear projects](https://mobbin.com/screens/3d3a4fae-d824-440a-961b-001c6b715a4a) |
| Mercury (Insights) | One insights page with a **"Saved views" dropdown → "+ Create view"**; bookmark icon next to the title | AI text insights beside the chart, plus the note "Trends are generated and may include inaccuracies." | Sidebar **Bookmarks** section | "Create view" inside the dropdown | [Mercury insights](https://mobbin.com/screens/f6fbe6f0-e531-4833-9c59-61f4d575b38a), [create view state](https://mobbin.com/screens/45195749-04f0-4ab5-95ee-7c909102992f) |
| Figma | **Thumbnail grid** with grid/list toggle | Title, "Edited 19 hours ago" | — | Top bar product buttons | [Figma recents](https://mobbin.com/screens/96b29ae0-3c65-48b8-8ddd-d1088fd645ff) |
| MagicPath / Recraft | Thumbnail grid, **first tile is "Create new"** (dashed) | Title, edited time | — | First grid tile + header button | [MagicPath](https://mobbin.com/screens/77bb103c-dca2-4181-b1b3-a60d7cd0f96b), [Recraft](https://mobbin.com/screens/bc3882d2-7f53-4b80-b580-f785905ef428) |
| Clay | Table with tabs All / Recents / Favorites | ★, tags, created, last opened by me, owner, access | Favorites tab + star column | "+ New" top-right, row ⋯ menu (Rename, Add to favorites, Duplicate, Move, Delete) | [Clay files](https://mobbin.com/screens/00e199d9-1b2f-410e-ac59-38edc5b30bdf) |

### iOS

| Product | Layout | What's in the row | Create | Link |
|---|---|---|---|---|
| Apple Stocks | Plain list, "My Symbols" switcher | Symbol + name · **sparkline** · price · **coloured delta pill** | "…" menu top-right | [Stocks](https://mobbin.com/screens/8f5b7049-5eab-40d3-b9de-aeb21d749c95) |
| Yahoo Finance / N26 / Coinbase / Copilot Money | Same watchlist row | Logo, name, sparkline, value, delta | Header "+" (N26) | [Yahoo](https://mobbin.com/screens/6038b18e-23f5-4d11-8b82-0b33ad605ca1), [N26](https://mobbin.com/screens/bb1d2f6a-084e-4562-b1f2-333c51d0f5cd), [Copilot holdings](https://mobbin.com/screens/044cf550-311d-45fb-9af1-92bec809b145) |
| Apple Notes | Inset grouped list "Folders" | Icon, name, **count**, chevron | Folder+ icon top; compose button bottom-right beside search | [Notes folders](https://mobbin.com/screens/6a0eb785-daad-49db-be8d-b0866ebc7f5c), [Notes list](https://mobbin.com/screens/280ad161-f02e-4ae2-9775-33061dd044c1) |
| Notion | **Recents as a horizontal row of cards**, then Favorites list, then Private list; bottom bar Search · Ask AI · Compose | Icon + title | Compose button bottom-right | [Notion home](https://mobbin.com/screens/e7689c02-0bc0-49f7-bc5c-71f516844d33) |
| Things 3 | Plain list of smart lists + Areas | Icon, name, **badge count** | Blue "+" FAB → menu (New To-Do / Project / Area) | [Things lists](https://mobbin.com/screens/70077bc2-0d33-4247-845d-3b656f8fb324), [create menu](https://mobbin.com/screens/15d22b07-2bcd-4f3f-a582-5a4b2a6d411e) |
| Asana Portfolios | List rows, Recents / Starred tabs | Coloured folder icon, name, "1 project" | "+ New portfolio" FAB bottom-right | [Asana](https://mobbin.com/screens/5d550d38-98a8-4efd-af05-b348073998a4) |
| ClickUp | List rows, "Sort by: Recents" | Icon, name, type | — | [ClickUp dashboards](https://mobbin.com/screens/bbe281f0-eb97-4f38-9468-13764e719467) |
| Deel | Full-width "Create report" button on top, then search, then report cards with View/Delete | Name, ☆, type tag | Top full-width button | [Deel reports](https://mobbin.com/screens/facc7dbc-44ff-4c8c-81e5-b65bfbc33f76) |
| Revolut Business | Stacked **chart cards**: title ›, big number, period, mini chart, filter/download icons | Big number + chart | — | [Revolut Business analytics](https://mobbin.com/screens/575fa52d-b28a-4293-81e6-48c1970c744c) |
| Quicken | Watchlist **cards** with 3 to 6 metrics each | Monthly avg, YTD, spent so far, projected, target | "+" header | [Quicken watchlists](https://mobbin.com/screens/0b15db92-85f1-46b7-baed-38840a9239c1) |
| Mercury | Accounts list with **sparkline at the trailing edge**; "Updated" toast after a refresh | Name, masked number, balance, sparkline | "+" top-right | [Mercury accounts](https://mobbin.com/screens/a91adb8e-d40d-43ea-b24b-5615f37efabb) |

## A2. What the evidence says

**Cards with thumbnails vs list rows**
- **Analytics and BI collections use rows.** Mixpanel, Amplitude, Hex, Zoho, Klaviyo, Shopify, Steep, HubSpot, Toggl, Linear and Clay list dashboards as rows. Hex and Zoho offer a grid toggle, but rows are the default.
- **Thumbnails appear where the artifact is visual and the thumbnail can be read:** Figma, Framer, MagicPath, Recraft and Runway. In analytics, thumbnails show up only as a small "Recents" strip (Mixpanel, Notion iOS) or a single featured card (Hex "Popular projects").
- **NN/g rule:** keep a thumbnail only if users "could choose using only the image". Text-led choices default to a list. Visual-first content can go to a grid ([NN/g, Mobile list thumbnails](https://www.nngroup.com/articles/mobile-list-thumbnail/)). A shrunken dashboard of 6 widgets at 160 px wide fails that test. Mixpanel's recents thumbnails are already hard to read on desktop.
- **On iOS the "collection of live numbers" pattern is the watchlist row** (Stocks, Yahoo, N26, Coinbase, Copilot, Mercury): a sparkline plus value plus delta. It is information-rich, fits 7 to 9 rows per screen, and the sparkline *is* the preview.

**Metadata seen (and how often)**
- Last updated / modified / **last viewed by you**: almost everywhere (Zoho, Klaviyo, Shopify, Steep, Hex, Figma, Clay).
- Owner / creator: in multi-user tools (Amplitude, Hex, Zoho, Steep, Shopify, Toggl, Linear).
- Favorite or pin: star column (Zoho, HubSpot, Hex, Clay), pin column (Toggl), sidebar sections (Mixpanel, Hex, Mercury Bookmarks).
- Access or sharing: Steep (Private / Everyone), Klaviyo ("View only"), Toggl (Public / Private), Linear ("Only visible to you").
- Status or health: Hex (In development / Certified), Linear (On track + % with mini line).
- **Live data in the row:** Stocks-type rows (sparkline + value + delta), Linear's status line, Hex's view trend. Nobody in the set shows a "widget count". Fresha shows counts per *category*.
- Description: Zoho, Fresha, Linear, Steep (subtitle).

**Create placement**
- Desktop: a primary button top-right of the list is the dominant pattern (Zoho, Klaviyo, HubSpot, Shopify, Steep, Toggl, Hex, Clay, Fresha). A global "Create" in the sidebar is the other one (Mixpanel, Amplitude). Design tools use a "Create new" first tile.
- iOS: a header "+" or compose icon (Linear, Notes, N26, Quicken), a FAB (Things, Asana), or a full-width top button (Deel).
- Mercury puts "Create view" *inside* the saved-views dropdown, so creation happens from the thing you're looking at. That is the closest analogue to Compass's "save an AI answer to a board".

## A3. Recommendation for Compass: "Watchlist rows + Pinned"

**Pattern:** a single Boards list, **Pinned** section first, then **All boards** (sort: last opened by you). Each row works like a Stocks watchlist row adapted to a board:

```
[icon]  Board name                          €128.40  ▁▂▃▅▆▇  +4.2%
        Primary KPI · Updated 6 min ago · 7 charts           ★
```

| Element | Decision | Source |
|---|---|---|
| Row, not thumbnail card | Text and number decide which board to open. A rendered mini-dashboard is unreadable at phone width. | NN/g thumbnails; every analytics product in A1 |
| Headline KPI + delta + sparkline | One "hero" metric per board (the first KPI widget, or one the user picks), with trailing value and a coloured delta. This is the "live preview". | Stocks, Yahoo, N26, Copilot, Mercury accounts |
| Second line | Primary KPI name · "Updated X ago" · chart count. Add owner and access **only when the board is shared**. | Zoho/Hex/Shopify "last viewed", Steep/Klaviyo access. **[our call]** to keep chart count: nobody shows it, but it's cheap and tells an empty board from a full one. |
| Pinned / favorite | Star toggle on the row (44 px hit area). Pinned group at the top on phone, and pinned boards in the sidebar on desktop. | Hex, Mixpanel, Amplitude, Toggl, Mercury Bookmarks, Notion Favorites |
| Desktop (≥ 840 px) | The same rows as a table with sortable columns (Name, Hero KPI, Δ, Updated, Owner, Charts, ★). No grid toggle in v1. | Hex, Zoho, Steep, Shopify. **[our call]** to skip grid. |
| Phone (< 600 px) | Rows full-width, 16 px side margins, row height ≥ 64 px (two lines), sparkline ~56×24 px, no column headers. Tapping the row opens the board (push, back chevron). | Stocks, Notes, Linear iOS pattern |
| Create | Main path: **"Save to board"** on any AI chart (sheet: pick board or "New board"). In the overview: desktop "New board" top-right, phone "+" in the large-title header. **No FAB**: it would collide with the composer and tab bar. | Mercury "Create view" in context; header "+" in Linear/Notes/N26. **[our call]** to avoid a FAB. |
| Empty state | Explain that boards come from answers. Show one CTA, "Ask Compass", and 2 to 3 suggested starter boards. | Hex "Get started" with templates ([Hex](https://mobbin.com/screens/53f4bd04-15fc-422d-8e34-3b312449cce0)) |
| Row actions | Swipe or long-press on phone, a ⋯ menu on desktop: Pin, Rename, Duplicate, Share, Delete (with Undo toast). | Clay row ⋯ menu; Zoho "Recently Deleted" |
| Inside a board | Stack chart cards vertically on phone (title ›, big number, period, mini chart), like Revolut Business. Offer an "Ask about this board" entry, as Mixpanel does with Spark inline. | [Revolut Business](https://mobbin.com/screens/575fa52d-b28a-4293-81e6-48c1970c744c), [Mixpanel Spark](https://mobbin.com/screens/b1b2093c-54f8-4c27-a70c-41c27e868ebb) |

Why not cards with thumbnails? GMs on phones need to know "is ADR up or down?" before tapping. A KPI + delta + sparkline row answers that in the list itself and fits about 7 boards per screen. A 2-column thumbnail grid fits about 4, and at that size the thumbnails can't be read.

---

# Part B: Mobile excellence for an AI analytics app

## B1. Official numbers

| Topic | Rule | Source |
|---|---|---|
| Touch target, iOS | Default **44×44 pt**, minimum 28×28 pt. "A button needs a hit region of at least 44x44 pt." | [HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) |
| Touch target, Android/Material | "Consider making touch targets at least **48x48dp**, separated by **8dp** of space or more." | [Google Accessibility Help](https://support.google.com/accessibility/android/answer/7101858) |
| Touch target, WCAG 2.2 AA (2.5.8) | At least **24×24 CSS px**, or spacing so that 24 px circles centred on targets don't overlap. Exceptions: equivalent control, inline, user-agent, essential. | [W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Text size, iOS | Default **17 pt**, minimum **11 pt**. "Ideally, give people the option to enlarge text by at least 200 percent." | [HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) |
| Dynamic Type, Large (default) | Large Title 34/41 · Title1 28/34 · Title2 22/28 · Title3 20/25 · Headline 17/22 semibold · Body 17/22 · Callout 16/21 · Subhead 15/20 · Footnote 13/18 · Caption1 12/16 · Caption2 11/13 (size/leading, pt) | [HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography) |
| Text that grows | "Horizontally adjacent views may need to stack vertically… table rows… may need to grow in height so that text isn't cropped." | [HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout) |
| Contrast | 4.5:1 for text up to 17 pt; 3:1 for 18 pt+ or bold (the HIG adopts WCAG AA). | [HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) |
| Safe areas | "Respecting the safe area is essential to make sure system UI and hardware features like the Dynamic Island don't obstruct content and controls." | [HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout) |
| Web safe area | `viewport-fit=cover`: "highly recommended to use the safe area inset variables". Use `interactive-widget=resizes-content` to make layout resize with the keyboard. | [MDN viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport) |
| Tab bar, iOS | "Use a tab bar to support navigation, not to provide actions." Keep it visible (except under modals). Avoid overflow "More". Don't hide or disable tabs. Include labels ("single words"). Use badges only for critical info. | [HIG Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) |
| Navigation bar, Material | Use for "**three to five destinations** of equal importance", compact windows, consistent destinations. | [Android Compose navigation bar](https://developer.android.com/develop/ui/compose/components/navigation-bar) |
| Breakpoints | Compact < 600 dp · Medium 600–839 · Expanded 840–1199 · Large 1200–1599 · XL ≥ 1600 | [Android window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes) |
| Tabs vs hamburger | ">5 options… hard to fit them in a tab bar"; hamburger "makes the navigation options least discoverable". | [NN/g mobile navigation patterns](https://www.nngroup.com/articles/mobile-navigation-patterns/) |
| Sheets, iOS | Detents: medium ≈ half, large = full. Show **one sheet at a time**. Pair Done with Cancel (Cancel leading, Done trailing). For complex flows, consider full-screen instead. | [HIG Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) |
| Bottom sheets, NN/g | For short contextual tasks only. **Visible close button**, not just swipe or grab handle. Back gesture dismisses. **No stacked sheets.** Don't use one to replace a detail page. | [NN/g Bottom sheets](https://www.nngroup.com/articles/bottom-sheet/) |
| Charts | Keep simple and reveal detail on demand. Add a descriptive headline. "Don't require interaction to reveal critical information". "Consider expanding the hit target to include the **entire plot area**, letting people scrub". "In a compact environment, maximize the width of the plot area", keep y-labels short and move units to the title. Consider moving the y-axis to the trailing side. Use familiar tick sequences (0, 5, 10). Bars start at 0. Every chart needs accessibility labels and a summary. | [HIG Charts](https://developer.apple.com/design/human-interface-guidelines/charts), [HIG Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data) |
| Mobile tables | Sticky column headers. Horizontal scroll only for large tables. **Lock the left column.** Signal more content with "arrows or cut-off elements". Let users hide or show columns. Rotation is a last resort. | [NN/g Mobile tables](https://www.nngroup.com/articles/mobile-tables/) |
| Haptics | Use system patterns for their documented meanings, consistently, as a *complement* to visual feedback. Don't overuse. Short haptics for discrete events. **Make them optional.** | [HIG Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) |

## B2. What iOS AI assistants do (composer, keyboard, answers)

| Pattern | Observed | Links |
|---|---|---|
| **Composer docked at the bottom**, floating pill/card above the home indicator | ChatGPT: `+` · "Ask ChatGPT" · mic · voice. Claude: card with `+`, model chip, mic, send. Perplexity: "Ask a follow up…" + mic + new-thread button. | [ChatGPT](https://mobbin.com/screens/8cf567ec-633b-4d0b-81b8-4e05de5fdb9c), [Claude](https://mobbin.com/screens/7f9374bd-79d3-4552-9fe0-bd26e76c94f9), [Perplexity](https://mobbin.com/screens/fe1aa2bb-e46b-45b2-ac6f-e2cb4916cbf1) |
| **Keyboard open: composer sits right on the keyboard**, content above stays scrollable, field grows to multiple lines | Claude, Perplexity, Gemini, Meta AI, GitHub Copilot | [Claude kb](https://mobbin.com/screens/0c723473-1bab-4bba-8786-10abe4b1d5a2), [Perplexity kb](https://mobbin.com/screens/19564c10-6ef1-4b5e-81b8-657d35b9ef25), [Gemini kb](https://mobbin.com/screens/14c6b403-0f06-482b-8d2e-6c7a32d8a433), [Meta AI multi-line](https://mobbin.com/screens/689f27d1-f469-4105-854a-1fec0490e7a4) |
| **Stop button while streaming** (square replaces send) | Claude | [Claude streaming](https://mobbin.com/screens/42340550-73a5-46d0-973d-21316812ae5c) |
| **Scroll-to-latest arrow** above the composer | Claude, ChatGPT, Public | [Claude](https://mobbin.com/screens/42340550-73a5-46d0-973d-21316812ae5c), [ChatGPT](https://mobbin.com/screens/83260479-a59e-491b-b190-07c2aa218333), [Public](https://mobbin.com/screens/90c5158a-0e7e-48de-962f-4f041871c69c) |
| **Per-answer action row**: copy, read aloud, 👍/👎, share, ⋯, Sources | ChatGPT, Claude (copy, share, play, 👍/👎, retry), Perplexity | [ChatGPT](https://mobbin.com/screens/8cf567ec-633b-4d0b-81b8-4e05de5fdb9c), [Claude](https://mobbin.com/screens/7f9374bd-79d3-4552-9fe0-bd26e76c94f9) |
| **Quote-to-follow-up**: select text in the answer → "Ask follow up" → the quote chip appears in the composer | Perplexity | [select](https://mobbin.com/screens/21dc6907-06d6-4730-87a4-a265e74e9fb9), [quoted chip](https://mobbin.com/screens/181b0438-4252-4c71-a36c-acb69bcda63d) |
| **Suggested follow-ups** as a list of ↳ rows under the answer | Perplexity | [Perplexity](https://mobbin.com/screens/fe1aa2bb-e46b-45b2-ac6f-e2cb4916cbf1) |
| **"Notify me when done"** for long answers | Claude ("Turn On Response Notifications") | [Claude](https://mobbin.com/screens/42340550-73a5-46d0-973d-21316812ae5c) |
| **AI disclaimer, small and persistent** | Claude "Claude is AI and can make mistakes"; Mercury "Trends are generated and may include inaccuracies" | [Claude](https://mobbin.com/screens/7f9374bd-79d3-4552-9fe0-bd26e76c94f9), [Mercury](https://mobbin.com/screens/f6fbe6f0-e531-4833-9c59-61f4d575b38a) |
| **Data answers in finance AI**: one-sentence answer first, then structured data | Lloyds: "You've spent £737.67… across 58 transactions" + transaction card list + "Show more". Public: tool-use line "Used 1 tool" + a 4-column table that wraps. | [Lloyds](https://mobbin.com/screens/04bb2a10-2599-44a9-8463-b58bf39d319e), [Public](https://mobbin.com/screens/90c5158a-0e7e-48de-962f-4f041871c69c) |
| **Bad example**: a wide table in chat with no frozen column. Raw snake_case headers ("goals_conceded") and the first column cut off. | MLS | [MLS](https://mobbin.com/screens/e48df8e8-d5e8-4c56-970b-d5b34ffbc2d8) |

## B3. Charts on small screens

| Pattern | Observed | Links |
|---|---|---|
| **Big number + delta above the chart**, chart under it, **time-range chips below** (1D 1W 1M 6M 1Y 5Y Max) | Finimize, Stake, TradingView, Yahoo | [Finimize](https://mobbin.com/screens/984065ba-bbe8-417c-a706-11c888996e17), [Stake](https://mobbin.com/screens/59c75168-6a94-4b07-ae5d-dfab600033f0), [TradingView](https://mobbin.com/screens/ce385e50-cdef-482b-986a-96f8f31a182b) |
| **Scrub**: vertical dotted rule + dot on the line + value/date readout (the headline number updates, or a tooltip appears) | Finimize (dotted rule + dot), TradingView (tooltip: price, change, timestamp), Acorns (vertical handle + "$140,911 at age 66"), Perplexity Finance | [Finimize](https://mobbin.com/screens/984065ba-bbe8-417c-a706-11c888996e17), [TradingView](https://mobbin.com/screens/b986d82f-f23e-4275-98b9-78aa707b19b0), [Acorns](https://mobbin.com/screens/37e7555a-7236-4791-a702-c906b133704c) |
| **Simplified axes**: 3 to 5 y-ticks on the **trailing** side, 3 to 5 x-labels, light grid | Finimize (40–80, right side), TradingView (3 ticks), Revolut Business (min/max only), Mercury iOS (no axes, just the line) | [Revolut Business](https://mobbin.com/screens/575fa52d-b28a-4293-81e6-48c1970c744c), [Mercury iOS](https://mobbin.com/screens/646c4676-c9c8-403d-86aa-fe93e411daf0) |
| **Reference line** (prior period / 24h ago) labelled inline | Perplexity Finance "24H ago: $223.03" dashed line | [Perplexity Finance](https://mobbin.com/screens/f1671b97-33eb-4fe9-8df0-5bbb72bf331c) |
| **Advanced chart is a separate full-screen view**, not crammed inline | Yahoo "Advanced Chart"; Revolut full-screen candles | [Yahoo](https://mobbin.com/screens/264cf8d7-236e-4fc9-821d-2902eab0e404), [Revolut](https://mobbin.com/screens/9b1bba89-8230-4caa-b51e-6577c4655751) |

## B4. Tables on mobile

| Approach | When | Observed |
|---|---|---|
| **Card / list rows** (label + value per row, "Show more") | Records with ≤ 4 fields, where the user scans one record at a time | Lloyds transactions ([link](https://mobbin.com/screens/04bb2a10-2599-44a9-8463-b58bf39d319e)) |
| **Fits-width compact table** | ≤ 4 short numeric columns | Yahoo historical data: Date / Open / High / Low ([link](https://mobbin.com/screens/fa745f5a-0868-4dd3-bf97-9f06f47ca226)) |
| **Horizontal scroll + frozen first column + visibly cut-off next column** | Real matrices (periods × metrics) | Stake financials: frozen "Breakdown" column, Q1 column cut off as the scroll cue ([link](https://mobbin.com/screens/77320dc0-6981-4a9d-933b-c7866fd098ae)); Binance ([link](https://mobbin.com/screens/46ef7cee-e6ef-4e71-ad25-b9a68cd9b674)) |

This matches NN/g: lock the left column, sticky headers, a cut-off cue, and horizontal scroll only for large tables ([NN/g](https://www.nngroup.com/articles/mobile-tables/)).

## B5. Approval / confirm sheets

| Pattern | Observed | Link |
|---|---|---|
| Destructive confirm: grabber + X, icon, "Are you sure?", consequence sentence, primary + secondary full-width buttons | Klarna | [Klarna](https://mobbin.com/screens/c5fad812-d83c-4f7a-a411-23ca3da6ecf1) |
| **Review sheet with summary rows** (From / To / How often / Fee / Total), info note, one primary | PayPal | [PayPal](https://mobbin.com/screens/d5ae7a12-992c-47a8-8ab6-4a5f5cae8b09) |
| **Before → after diff** (55% → 54%), reassurance note, Back + Confirm | Acorns | [Acorns](https://mobbin.com/screens/fb0b77bd-7f78-4a4b-b268-b785e14a8044) |
| Review with chart + editable settings rows (›), sticky primary at the bottom | Copilot Money | [Copilot](https://mobbin.com/screens/6c9d0fdf-e9b1-4e1f-860c-8c7adfcf607f) |
| Primary label names the action ("Confirm & create goal"), with legal text above | Oportun | [Oportun](https://mobbin.com/screens/3d1b5285-9ee8-40d4-9a39-619d6cd781ad) |

## B6. List → detail, refresh, navigation

- **List → detail is a push with a back chevron** (Notes, Stocks, Asana, Linear). Detail pages are full screens, not sheets ([NN/g](https://www.nngroup.com/articles/bottom-sheet/): don't replace page-to-page flows with sheets).
- **Refresh feedback:** Mercury shows a small "✓ Updated" toast after a refresh ([Mercury](https://mobbin.com/screens/a91adb8e-d40d-43ea-b24b-5615f37efabb)).
- **Mercury iOS uses an icon-only 5-tab bar** ([link](https://mobbin.com/screens/646c4676-c9c8-403d-86aa-fe93e411daf0)). HIG says to include labels, so don't copy this.
- **Notion iOS bottom bar** is Search · Ask AI · Compose ([link](https://mobbin.com/screens/e7689c02-0bc0-49f7-bc5c-71f516844d33)). AI entry sits at the bottom in thumb reach on every screen.

---

## B7. Compass mobile checklist (numbers)

Applies at < 600 px wide (compact). Medium is 600–839, and expanded ≥ 840 switches to sidebar + multi-pane.

**Layout and safe areas**
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; pad fixed bars with `env(safe-area-inset-top|bottom|left|right)` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)).
- [ ] Side margins **16 px**. Content max-width ~ 680 px on wider screens for reading. **[our call]**
- [ ] Use `100dvh` (not `100vh`) for full-height shells so mobile browser chrome doesn't clip the composer. **[our call]**
- [ ] No horizontal page scroll at 320 px width (WCAG 1.4.10 Reflow). Only data tables scroll sideways, inside their own container.

**Targets**
- [ ] Every tappable element ≥ **44×44 px** hit area (HIG 44 pt). The visual can be smaller, but extend the hit area with padding. Use ≥ **8 px** between adjacent targets (Google 8 dp). Never go below the WCAG **24×24** floor, even for inline icons in dense tables.
- [ ] Star/pin, row ⋯ and chart chips all meet 44 px.

**Type**
- [ ] Body **17 px**, secondary 15 px, captions ≥ **12 px**, absolute floor **11 px** (HIG). Big KPI numbers 28 to 34 px (Title1 / Large Title). Use `font-variant-numeric: tabular-nums` for all metrics. **[our call]**
- [ ] Size text in `rem` and test at **200%** zoom (HIG: enlarge ≥ 200%). Two-column KPI rows must stack when text grows (HIG Layout).
- [ ] Inputs (composer) ≥ **16 px** font. iOS Safari auto-zooms smaller form fields on focus (WebKit behaviour). **[our call]**
- [ ] Contrast **4.5:1** for body text, **3:1** for ≥ 18 px / bold and for chart lines against the background.

**Navigation**
- [ ] Bottom tab bar, **4 tabs with icon + single-word label**: Inbox · Ask · Boards · Settings/More (3 to 5 per HIG/Material/NN/g). Visible on all top-level screens. Hidden only under full-screen modals. Badge only on Inbox for critical new insights.
- [ ] Tab bar height = 49 px + `safe-area-inset-bottom`. **[our call]**: 49 pt is the long-standing UIKit tab bar height. No primary source was fetched for it.
- [ ] List → detail = push route + back chevron (≥ 44 px). Restore scroll position on back. **[our call]**
- [ ] Desktop ≥ 840 px: sidebar replaces the tab bar (HIG: a tab bar can adapt to a sidebar; Android expanded class).

**Composer and keyboard**
- [ ] Composer docked at the bottom, above the tab bar on Ask/thread screens. On focus, the tab bar hides and the composer rides on the keyboard (Claude, Perplexity, Gemini pattern).
- [ ] Keyboard handling: `interactive-widget=resizes-content` (MDN; Chromium-based browsers) **plus** a `visualViewport` resize listener that sets `--kb-inset` for iOS Safari. **[our call]**: check current support on the MDN compat table.
- [ ] Field grows from 1 to **max 5 lines**, then scrolls internally. **[our call]**
- [ ] Controls: `+` (attach/context) · field · send. Send becomes **Stop** while streaming (Claude). Each ≥ 44 px.
- [ ] "Scroll to latest" circular button (44 px) appears when the user scrolls up more than one screen during streaming (ChatGPT, Claude).
- [ ] Per-answer action row: Copy · Save to board · 👍/👎 · ⋯ (ChatGPT/Claude pattern, with Compass's "Save to board" as the key action).
- [ ] Suggested follow-ups as full-width ↳ rows (≥ 44 px), not tiny chips (Perplexity).
- [ ] One-line AI disclaimer under answers, Caption size (Claude, Mercury).

**Charts**
- [ ] Put a one-sentence takeaway headline above each chart (HIG Charting data: descriptive text; Lloyds pattern).
- [ ] Chart full width of the content area. Height **~200–240 px** on phone. **[our call]**, matching the observed Finimize/Stake proportions.
- [ ] **3 to 5 y-ticks**, trailing side, short labels (€k, %). Units go in the title. **3 to 5 x-labels**. Use familiar tick steps (HIG).
- [ ] Bars start at 0. Lines may use a dynamic range (HIG).
- [ ] **Scrub** = the whole plot area is the touch target. Vertical rule + dot + readout (value, date, Δ vs comparison). Readout replaces the headline number while dragging (Finimize/Stocks pattern). Set `touch-action: pan-y` on the plot so vertical page scroll still works. **[our call]**
- [ ] Time-range chips **under** the chart (7D · 30D · 90D · YTD · 1Y), each ≥ 44 px tall.
- [ ] Comparison (last year / budget) as a dashed reference line with an inline label (Perplexity Finance "24H ago").
- [ ] Max **2 series** inline on phone. More goes behind "Expand" → a full-screen chart view (Yahoo Advanced Chart). **[our call]**
- [ ] Every chart gets an `aria-label` summary (type, axes, range, takeaway) and a "View as table" option (HIG: accessible charts).

**Tables**
- [ ] ≤ 4 short columns: compact table that fits the width (Yahoo).
- [ ] Record lists (bookings, segments): card rows with "Show more" after **5 to 10 rows** (Lloyds). **[our call]** on the count.
- [ ] Matrices: horizontal scroll inside the card, **frozen first column**, **sticky header**, next column visibly cut off (NN/g; Stake).
- [ ] Human column names, never raw field names (MLS anti-example).

**Sheets and approvals**
- [ ] Use a bottom sheet for short tasks only: Save to board, filter, confirm. Board and thread detail are pages, not sheets (NN/g).
- [ ] Sheet anatomy: grabber + **visible Close (X) ≥ 44 px**. Back gesture / Esc closes. **One sheet at a time** (HIG, NN/g). Medium detent ≈ 50%, large ≈ full (HIG).
- [ ] AI action approval sheet: title naming the action, **summary rows** (what / where / when / impact), **before → after diff** for changes (Acorns), one primary button labelled with the verb ("Apply rate change"), plus a secondary "Cancel" (PayPal, Klarna, Oportun).
- [ ] Destructive: red text button, consequence sentence, Undo toast for 5+ s after the action. **[our call]**
- [ ] Focus moves into the sheet on open and returns to the trigger on close. Background is `inert` for modal sheets (WCAG focus management).

**Refresh and freshness**
- [ ] Every board, KPI and chart shows "Updated X min ago" (Hex/Shopify "last viewed/updated" + Mercury). **[our call]** to show data freshness rather than file freshness.
- [ ] Pull-to-refresh on Inbox and Boards lists with a small "Updated" toast (Mercury). In standalone PWA mode the browser gives no native pull-to-refresh, so build it, or provide a visible refresh control. **[our call]**
- [ ] Use `overscroll-behavior-y: contain` on chat/thread scrollers so the page doesn't bounce or refresh mid-conversation. **[our call]**

**Haptics**
- [ ] Haptics only for discrete events: approval succeeded, pin toggled, scrub snaps to a data point. Keep them optional (HIG). On the web, the Vibration API is not available in Safari, so haptics must never carry meaning. Visual feedback always comes first. **[our call]**: check the MDN compat table for the Vibration API.

**Motion and accessibility**
- [ ] Respect `prefers-reduced-motion`: no animated chart draw-in, and sheets fade instead of sliding. **[our call]**
- [ ] AXE clean. Visible focus ring ≥ 2 px. All icon buttons have `aria-label`s.

---

## Sources

**Guidelines**
- Apple HIG: [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) · [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) · [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) · [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) · [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) · [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) · [Charts](https://developer.apple.com/design/human-interface-guidelines/charts) · [Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data) · [Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)
- Google/Material: [Touch target size (Accessibility Help)](https://support.google.com/accessibility/android/answer/7101858) · [Navigation bar (Compose)](https://developer.android.com/develop/ui/compose/components/navigation-bar) · [Bottom sheets (Compose)](https://developer.android.com/develop/ui/compose/components/bottom-sheets) · [Window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes)
- W3C: [WCAG 2.2 SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- NN/g: [Mobile tables](https://www.nngroup.com/articles/mobile-tables/) · [Bottom sheets](https://www.nngroup.com/articles/bottom-sheet/) · [Mobile navigation patterns](https://www.nngroup.com/articles/mobile-navigation-patterns/) · [Mobile list thumbnails](https://www.nngroup.com/articles/mobile-list-thumbnail/)
- MDN: [viewport meta (interactive-widget, viewport-fit)](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)

**Mobbin**: every screen is linked inline above.
