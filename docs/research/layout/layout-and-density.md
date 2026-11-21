# Compass respiră prin ierarhie, nu prin goluri

Un produs de analytics hotelier poate fi dens și aerisit în același timp dacă spațiul alb este cheltuit pe separarea grupurilor, iar „aerul" se obține scoțând chrome (borduri, umbre, culori, etichete, zecimale), nu scoțând date. Sursele converg pe un set mic de cifre: un grid de 12 coloane, o scară de spațiere 4/8 px cu treptele 8 / 16 / 24 / 32, padding de card de 16–24 px, **maximum 4 tile-uri KPI sau 3 grafice pe rând**, grafice de **180 px** în overview și **320 px** când sunt vedetă, rânduri de tabel de 40 px (comfortable) și 32 px (compact). Densitatea trebuie să fie un token separat de temă (`data-density` lângă `data-theme`), care schimbă doar înălțimi, padding și gap-uri, niciodată mărimea fontului. Recomandarea pentru Compass este comfortable ca default global și compact aplicat pe regiuni (tabele, filtre, panoul de evidence), nu ca mod pentru toată aplicația. Fiecare ecran primește un singur element erou, cel mult două niveluri de progressive disclosure și un tile KPI în trei rânduri care răspunde mereu la „față de ce?". Prima jumătate a primului ecran trebuie să conțină sumarul Kassandrei, rail-ul KPI și ce cere atenție, pentru că acolo se concentrează atenția. De reținut: aproape toate valorile numerice vin din documentația vendorilor și a design system-elor, nu din experimente controlate, iar ordinea „ce se uită un revenue manager dimineața" vine exclusiv din surse de vendor.

## Aerisit înseamnă mai puțin chrome, nu mai puține date

Stephen Few, de obicei citat ca avocat al minimalismului, cere de fapt densitate: un dashboard trebuie să afișeze „a dense array of information in a small amount of space", clar și fără distragere, și să elimine tot ce nu adaugă sens datelor ([Few 2007](https://blogs.ischool.berkeley.edu/i247s13/files/2013/02/WhyMostDashboardsFail.pdf)). Exemplul lui pune **șapte metrici, fiecare cu sparkline, bullet graph față de target și valoarea actuală**, în spațiul ocupat de trei gauge-uri, iar singura culoare din ecran este un punct roșu pe metrica cu probleme ([Few 2007](https://blogs.ischool.berkeley.edu/i247s13/files/2013/02/WhyMostDashboardsFail.pdf)). Concluzia practică pentru Compass: senzația de înghesuială se tratează prin eliminarea bordurilor, fill-urilor, gridline-urilor și a varietății gratuite, nu prin ascunderea metricilor.

Design system-ele spun același lucru cu alte cuvinte. Carbon afirmă că secțiunile dense sunt acceptabile cât timp există spațiu alb în care ochiul se odihnește și că mai mult spațiu în jurul unui element îi semnalează importanța ([Carbon: Spacing](https://carbondesignsystem.com/elements/spacing/overview/)). Polaris declară că admin-ul Shopify este „high density by default", cu densitate ridicată pentru index pages și data tables și densitate scăzută pentru editare focalizată, și rezervă liniile de separare aproape exclusiv tabelelor ([Polaris: Density](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/design/layout/density.mdx), [Polaris: Layout](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/design/layout/index.mdx)). Atlassian cere ca suprafețele să rămână plate și ca umbrele să fie păstrate pentru overlay-uri; un card se face din suprafață plus bordură, nu din elevație ([Atlassian: Elevation](https://atlassian.design/foundations/elevation)). Linear a obținut „mai mult aer" în 2026 fără niciun pixel în plus, doar estompând sidebar-urile ca zona de conținut să iasă în față ([Linear changelog 2026-03-12](https://linear.app/changelog/2026-03-12-ui-refresh)).

Dovezile despre atenție justifică unde merge spațiul. Studiul de eyetracking NN/g pe ecrane 1920×1080 arată că **circa 57% din timpul de vizualizare cade deasupra fold-ului, iar peste 65% din acesta în jumătatea de sus a viewport-ului**; al doilea ecran primește circa 17% ([NN/g: Scrolling and Attention](https://www.nngroup.com/articles/scrolling-and-attention/)). Studiul a acoperit site-uri generale, nu unelte cu login, deci este un indiciu, nu o măsurătoare pentru dashboard-uri. Tot NN/g arată că oamenii scanează cel mai eficient pe titluri și subtitluri (tiparul „layer-cake") și recomandă ca spațierea să arate ce conținut aparține cărui subtitlu ([NN/g: Layer-Cake](https://www.nngroup.com/articles/layer-cake-pattern-scanning/)). Aceasta este utilizarea spațiului alb susținută de dovezi: semnal de grupare, nu padding uniform. Dacă toate gap-urile cresc la fel, dispare exact ierarhia pe care proximitatea trebuia să o transmită.

Trei limite cognitive fixează restul regulilor. Memoria de lucru ține **3–5 chunk-uri**, nu 7±2 ([Cowan 2001](https://pubmed.ncbi.nlm.nih.gov/11515286/)), dar limita se aplică la ce trebuie ținut minte, nu la ce este afișat: valorile vizibile simultan se compară fără memorie ([NN/g: Data Tables](https://www.nngroup.com/articles/data-tables/)). De aici regula ca numerele care se compară (OTB, STLY, buget) să stea alături, în același rând. Progressive disclosure funcționează, dar designurile cu mai mult de două niveluri au de obicei usability scăzut ([NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)). Cardurile sunt potrivite pentru grupuri eterogene de informații scurte, însă pentru căutare și comparație listele și tabelele câștigă, pentru că pozițiile elementelor nu se mută de la un item la altul ([NN/g: Cards](https://www.nngroup.com/articles/cards-component/), [NN/g: Data Tables](https://www.nngroup.com/articles/data-tables/)). Niciuna dintre surse nu validează empiric un număr maxim de tile-uri KPI; „4 pe rând" este o euristică compatibilă cu Cowan și cu limitele produselor de mai jos, nu un rezultat de laborator.

## Produsele de top converg pe 12 coloane, maximum 4 pe rând și grafice de 180 sau 320 px

Stripe este singurul care publică cifre de layout, prin pattern-urile Stripe Apps care declară că urmează paginile native din Dashboard. Graficul dintr-un modul de overview are **180 px**, cel vedetă de pe o pagină de detaliu **320 px**; pe un rând intră două grafice egale, trei la 1/3 sau un split 2/3 + 1/3, și niciodată mai mult de trei, pentru că sub aproximativ **200 px lățime** graficele devin greu de citit ([Stripe: chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)). Graficele din același rând au aceeași înălțime, iar stările loading, empty, error și populated păstrează aceeași înălțime ca să nu sară layout-ul. Valoarea curentă stă deasupra graficului, „so users get the answer before checking the trend", iar tile-ul cu sparkline este label, valoare și un sparkline de 24×80 px ([Stripe: chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md)). Pagina se structurează în coloană primară și secundară, detaliul este o rută proprie, iar crearea și editarea se fac într-un drawer care nu scoate utilizatorul din context ([Stripe: full-page apps](https://docs.stripe.com/stripe-apps/patterns/full-page-apps.md)).

Tool-urile de tip builder ajung la aceleași limite. Mixpanel Boards așază conținutul pe rânduri de 12 unități, cu cel mult patru carduri pe rând și lățime minimă de 3/12 ([Mixpanel Boards](https://docs.mixpanel.com/docs/boards)); Datadog folosește un grid responsive de 12 pătrate, grupuri cu header care se pot plia și un „high density mode" doar pentru monitoare late ([Datadog: new dashboards experience](https://www.datadoghq.com/blog/datadog-dashboards/), [Datadog docs](https://docs.datadoghq.com/dashboards/?lang_pref=en)); Looker Studio în modul responsive impune 12 coloane și interzice suprapunerea componentelor ([Looker Studio: responsive report](https://cloud.google.com/looker/docs/studio/create-a-responsive-report?hl=ko)). Cifrele Mixpanel și Looker Studio provin din rezumate de căutare ale documentației oficiale, nu din pagini citite integral, deci merită reverificate înainte de a fi citate mai departe.

GA4 și Tableau Pulse arată cum se organizează un „morning brief". Home-ul GA4 este o stivă scurtă de secțiuni numite; cardul de overview ține mai multe metrici ca tab-uri peste un singur grafic, comparația este codată în marcaj (linie plină pentru ultimele 7 zile, punctată pentru cele 7 anterioare), listele din carduri sunt plafonate (maximum 5 țări), iar adâncimea se deschide prin „View all insights" și Expand ([GA4: Home page](https://support.google.com/analytics/answer/11197963?hl=en)). Fiecare summary card rezumă exact un raport de detaliu ([GA4: Overview report](https://support.google.com/analytics/answer/10659551?hl=en)). Tableau Pulse pune un **insight summary text în capul paginii**, apoi carduri cu valoare și variație procentuală, apoi o pagină de detaliu cu tab-urile Overview (un line chart) și Breakdown; răspunsul la o întrebare conține „key insights, relevant visualizations, source references, and suggested follow-up questions" ([Tableau Pulse: explore metrics](https://docs.salesforce.com/tableau/current/en-us/online/pulse_explore_metrics.md)). Aceasta este structura pe care panoul de evidence al Kassandrei o poate prelua direct. Amplitude descrie pentru Dashboard Agent un sumar cu citări și linkuri adăugate ca utilizatorul să poată verifica rezultatele, dar sursa este material de marketing al vendorului ([Amplitude: Dashboard agent](https://www.amplitude.com/releases/dashboard-agent-enhancements)).

Până și cel mai dens tool de BI s-a relaxat: noul card visual din Power BI a ridicat padding-ul implicit la **12 px** și a separat valoarea (callout) de „reference labels" (variație, target), care ocupă implicit 50% din card ([Power BI: card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card)). Microsoft numește și anti-pattern-urile care produc senzația de înghesuială: text și vizualizări toate de aceeași mărime, varietate de grafice de dragul varietății, intervale de timp amestecate, data labels inutile și numere cu mai mult de trei–patru cifre ([Power BI: tips for creating reports](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports)). Vercel adaugă disciplina de suprafață: trei tării de bordură și atât, fără gradiente, glow, glass sau umbre ornamentale, densitate normală pentru tabele obișnuite și compactă doar pentru lookup dens ([vercel.com/design.md](https://vercel.com/design.md)).

## Densitatea este un token separat de temă, iar fontul nu se micșorează

Există trei modele de implementare. Material folosește o scară numerică de la 0 la -5 în care fiecare pas scade 4 px din înălțimea componentelor, cu avertismentul că sub 0 accesibilitatea poate avea de suferit și cu excepția explicită că pop-up-urile și suprafețele de task (date picker) nu se densifică ([Angular Material theming guide](https://github.com/angular/components/blob/main/guides/theming.md)). Carbon folosește mărimi numite pe componentă: rânduri de tabel de **24 / 32 / 40 / 48 / 64 px, toate cu text de 14 px**, cu toolbar și paginare aliniate la înălțimea rândului ([Carbon: Data table style](https://carbondesignsystem.com/components/data-table/style/), [Carbon: Data table usage](https://carbondesignsystem.com/components/data-table/usage/)). Primer folosește variante numite ale aceluiași token: `--stack-gap` și `--stack-padding` cu **8 / 16 / 24 px** pentru condensed / normal / spacious, controale de 24–48 px și ținte minime de 16 px pentru pointer fin și 44 px pentru touch ([@primer/primitives size.css](https://unpkg.com/@primer/primitives@11.10.0/dist/css/functional/size/size.css)). Toate trei schimbă înălțimi, padding și gap-uri și lasă fontul în pace.

Scara de spațiere este aceeași peste tot: sub-grid de 4 px, unitate de lucru de 8 px, trepte rare la capătul mare. Polaris fixează `space-card-padding` și `space-card-gap` la 16 px și 8 px între titlul secțiunii și conținut ([polaris-tokens space.ts](https://github.com/Shopify/polaris/blob/main/polaris-tokens/src/themes/base/space.ts), [Polaris: Card layout](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/patterns/card-layout/index.mdx)); Atlassian dă benzile de utilizare cele mai clare: **0–8 px în interiorul componentelor, 12–24 px între elemente, 32–80 px între secțiunile paginii** ([Atlassian: Spacing](https://atlassian.design/foundations/spacing)); Carbon are trei moduri de gutter, 32 / 16 / 1 px, iar pe cel de 1 px îl recomandă explicit pentru dashboard-uri, cu 16 px padding în fiecare tile ([Carbon: 2x Grid usage](https://carbondesignsystem.com/elements/2x-grid/usage/)). Niciun sistem nu publică un raport explicit între spațierea de secțiune și cea din card; scara 8 → 16 → 32 de mai jos este dedusă din aceste valori. Sistemele diferă și la întrebarea dacă gap-ul dintre carduri trebuie să fie mai mare decât padding-ul: codelab-ul Material pune 24 între și 16 înăuntru ([Material adaptive codelab](https://developer.android.com/codelabs/adaptive-material-guidance)), Polaris 16 și 16, Carbon condensed 1 și 16. Diferența se rezolvă prin felul în care e desenată gruparea: când cardul are container vizibil (bordură sau treaptă de suprafață), containerul grupează și gap-ul poate scădea; când gruparea se bazează doar pe spațiu, gap-ul trebuie să depășească padding-ul interior.


| Token | Comfortable | Compact | Baza |
|---|---|---|---|
| `--space-page-x` | 24 px | 16 px | Primer: content padding 24 la xlarge, 16 sub |
| `--space-section` | 32 px | 24 px | Atlassian: banda de layout începe la 32 |
| `--space-card-gap` | 16 px | 8 px | Polaris card-gap 16; Primer stack-gap 16 / 8 |
| `--space-card-pad` | 24 px | 16 px | Primer stack-padding 24 / 16; Polaris 16 |
| `--space-stack` | 12 px | 8 px | Polaris: 8 între titlu și conținut |
| `--space-inline` | 8 px | 4 px | Atlassian: banda mică 0–8 |
| `--row-h` | 40 px | 32 px | Carbon md / sm |
| `--control-h` | 36 px | 32 px | Material: pași de 4 px; Primer medium 32 |
| `--cell-pad-x` | 16 px | 12 px | Carbon grid padding 16 |
| `--leading-body` | 20 px | 18 px | Carbon body-01 14/20, body-compact-01 14/18 |
| `--chart-h` / `--chart-h-hero` | 180 / 320 px | 180 / 320 px | Stripe; nu se schimbă cu densitatea |

```css
/* 1. Densitate: default comfortable, ortogonal temei */
:root {
  --space-page-x: 1.5rem;     /* 24 */
  --space-section: 2rem;      /* 32 */
  --space-card-gap: 1rem;     /* 16 */
  --space-card-pad: 1.5rem;   /* 24 */
  --space-stack: 0.75rem;     /* 12 */
  --space-inline: 0.5rem;     /* 8  */
  --row-h: 2.5rem;            /* 40 */
  --control-h: 2.25rem;       /* 36 */
  --cell-pad-x: 1rem;         /* 16 */
  --leading-body: 1.25rem;    /* 14/20 */

  /* Constante, neafectate de densitate */
  --chart-h: 180px;
  --chart-h-hero: 320px;
  --spark-w: 80px;
  --spark-h: 24px;
  --content-max: 1280px;
  --measure: 68ch;
  --text-label: 0.75rem;      /* 12/16, 500 */
  --text-body: 0.875rem;      /* 14 */
  --text-card-title: 1rem;    /* 16/24, 500 */
  --text-section: 1.25rem;    /* 20/28 */
  --text-kpi: 2rem;           /* 32/40 */
  --text-kpi-sm: 1.5rem;      /* 24/32 */
}

[data-density="compact"] {
  --space-page-x: 1rem;       /* 16 */
  --space-section: 1.5rem;    /* 24 */
  --space-card-gap: 0.5rem;   /* 8  */
  --space-card-pad: 1rem;     /* 16 */
  --space-stack: 0.5rem;      /* 8  */
  --space-inline: 0.25rem;    /* 4  */
  --row-h: 2rem;              /* 32 */
  --control-h: 2rem;          /* 32 */
  --cell-pad-x: 0.75rem;      /* 12 */
  --leading-body: 1.125rem;   /* 14/18 */
}

/* Overlay-urile nu se densifică (regula Material) */
[data-density="compact"] :is([role="dialog"], [role="menu"], [data-overlay]) {
  --control-h: 2.25rem;
  --space-card-pad: 1.5rem;
  --space-stack: 0.75rem;
}

/* Touch: ținte de 44 px indiferent de densitate (Primer) */
@media (pointer: coarse) {
  :root, [data-density="compact"] { --control-h: 2.75rem; --row-h: 2.75rem; }
}

/* 2. Teme: doar culoare; nu ating token-urile de mai sus */
:root[data-theme="<tema-1>"] { /* --background, --card, --border, --primary, --chart-1..5 */ }
:root[data-theme="<tema-2>"] { /* idem */ }
:root[data-theme="<tema-3>"] { /* idem */ }

/* 3. Expunere în Tailwind v4 */
@theme inline {
  --spacing-page-x: var(--space-page-x);
  --spacing-section: var(--space-section);
  --spacing-card-gap: var(--space-card-gap);
  --spacing-card-pad: var(--space-card-pad);
  --spacing-stack: var(--space-stack);
}

.num { font-variant-numeric: tabular-nums lining-nums; }
```

Atributul se poate pune pe `<html>` pentru preferința globală și pe o regiune (`<section data-density="compact">`) pentru tabele, bare de filtre și panoul de evidence. Așa procedează Carbon, pentru care amestecul de moduri de gutter este „the rule rather than the exception", și Polaris, care permite componente dense în pagini mai puțin dense, cu două interdicții: densitatea nu se schimbă brusc în interiorul unei componente și un conținut de densitate scăzută nu se amestecă într-un card cu o componentă de densitate ridicată ([Carbon: 2x Grid usage](https://carbondesignsystem.com/elements/2x-grid/usage/), [Polaris: Density](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/design/layout/density.mdx)). Scara tipografică rămâne îngustă, în spiritul setului „productive" din Carbon, cu 12 px ca prag minim și greutăți 400–600: Carbon coboară titlurile mari la 300–400, iar M3 ține Display și Headline la 400, deci ierarhia vine din mărime, nu din bold ([Carbon: Type sets](https://carbondesignsystem.com/elements/typography/type-sets/), [material-web typescale](https://github.com/material-components/material-web/blob/main/tokens/versions/latest/sass/_md-sys-typescale.scss)). Două observații despre starea actuală a codului: `--radius: 1rem` este generos pentru tile-uri compacte și tabele imbricate, iar Polaris recomandă reducerea razei pe suprafețele inset ([Polaris: Spatial organization](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/design/layout/spacial-organization.mdx)); umbrele din temă ar trebui păstrate pentru popover, dialog și drawer, cu cardurile plate.

Regulile de grid și de rând, adunate într-un loc:

| Regulă | Valoare | Sursă |
|---|---|---|
| Grid | 12 coloane desktop; conținut plafonat la 1280 px pe paginile de citit, full-width pe boards și builder | [Primer: Layout](https://primer.style/product/getting-started/foundations/layout/), [Carbon: 2x Grid usage](https://carbondesignsystem.com/elements/2x-grid/usage/) |
| Breakpoint-uri | < 600 un panou; 600–839; 840–1199 două panouri; ≥ 1200; ≥ 1600 opțional trei | [Android: window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes) |
| Tile-uri KPI pe rând | maximum 4, lățime minimă 3/12 | [Mixpanel Boards](https://docs.mixpanel.com/docs/boards) |
| Grafice pe rând | maximum 3 (1/2 + 1/2, 1/3 × 3 sau 2/3 + 1/3), minimum 200 px lățime | [Stripe: chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md) |
| Înălțime grafice | 180 px în overview, 320 px vedetă, aceeași înălțime pe rând și în toate stările | [Stripe: chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md) |
| Liste în carduri | maximum 5 rânduri + „Vezi toate" | [GA4: Home page](https://support.google.com/analytics/answer/11197963?hl=en) |
| Scara spațierii | 4 → 8 → 16 → 24 → 32; un gap interior nu egalează gap-ul care separă părintele de vecini | dedusă din [Atlassian: Spacing](https://atlassian.design/foundations/spacing) |
| Separatoare | linii doar în tabele; în rest spațiu și treaptă de suprafață; maximum trei tării de bordură | [Polaris: Layout](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/design/layout/index.mdx), [vercel.com/design.md](https://vercel.com/design.md) |
| Niveluri de disclosure | maximum 2 (tile → detaliu) | [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) |
| Interval de timp | unul pe secțiune, scris o dată în header-ul secțiunii | [Power BI: tips](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports) |
| Motion | 70–150 ms pentru hover, filtre, re-render de tabel; 240–400 ms pentru panouri | [Carbon: Motion](https://carbondesignsystem.com/elements/motion/overview/) |

## Tile-ul KPI răspunde la „față de ce?" în trei rânduri

Un număr fără context „would tell you little. Compared to what?", scrie Few, iar un sparkline este mai bogat decât o săgeată de trend pentru că arată efectiv urcușurile și coborâșurile ([Few 2007](https://blogs.ischool.berkeley.edu/i247s13/files/2013/02/WhyMostDashboardsFail.pdf)). Stripe, Looker Studio și Power BI ajung la aceeași anatomie: label mic în culoare secundară, valoare mare, apoi comparația și sparkline-ul, în această ordine ([Stripe: chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout.md), [Looker Studio: scorecard](https://docs.cloud.google.com/looker/docs/studio/scorecard-reference?authuser=2), [Power BI: card visual](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-new-card)). Pentru Compass, tile-ul recomandat arată așa:

| Rând | Conținut | Specificație |
|---|---|---|
| 1. Label | metrică + perioadă („RevPAR · MTD") | 12/16, weight 500, `--muted-foreground` |
| 2. Valoare | o singură valoare dominantă cu unitate, sparkline la dreapta | 32/40 pe rail-ul principal, 24/32 în tile-uri secundare; `tabular-nums`; sparkline 80×24 px, fără axe |
| 3. Referințe | cel mult două delte etichetate („▲ +4,2% vs STLY", „▼ −12 mii € vs buget") | 12/16; semn + săgeată + culoare; culoarea codează bine/rău, săgeata codează direcția |
| Container | padding `--space-card-pad`, `--space-stack` între rânduri, bordură de 1 px sau treaptă de suprafață, fără umbră | lățime minimă 3/12 și cel puțin 200 px |

Regulile de formatare decurg din aceleași surse. Pe tile-uri numerele se abreviază la trei–patru cifre: Microsoft recomandă „3.4 million" în loc de 3,400,000, Looker Studio transformă 553,939 în 553.9K, iar Polaris limitează valorile de pe axe la trei caractere numerice, o zecimală și o literă ([Power BI: tips](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-tips-and-tricks-for-creating-reports), [Looker Studio: scorecard](https://docs.cloud.google.com/looker/docs/studio/scorecard-reference?authuser=2), [Polaris: Data visualizations](https://github.com/Shopify/polaris/blob/main/polaris.shopify.com/content/design/data-visualizations.mdx)). Valoarea completă apare la hover sau în tabelul de detaliu, unde zecimalele sunt consistente pe coloană, numerele și header-ele lor sunt aliniate la dreapta și cifrele sunt tabulare ([A List Apart: tables](https://alistapart.com/article/web-typography-tables/), [EU Data Visualisation Guide](https://data.europa.eu/apps/data-visualisation-guide/fonts-for-numbers)). Culoarea nu poartă magnitudine și nu este niciodată singurul semnal; culoare plus formă este mai vizibilă decât oricare separat, iar fundalul tile-ului rămâne neutru ([NN/g: dashboards](https://www.nngroup.com/articles/dashboards-preattentive/)). Pie, donut și gauge se evită; lungimea și poziția sunt codările judecate cel mai precis ([NN/g: dashboards](https://www.nngroup.com/articles/dashboards-preattentive/)).

Specificul hotelier adaugă două capcane de etichetare. STLY înseamnă poziția la aceeași distanță față de sosire anul trecut, nu rezultatul final de anul trecut, iar bugetul și forecast-ul răspund la întrebări diferite ([Amadeus: Guestroom Pace report](https://help.amadeus-hospitality.com/sales-and-event-management/content/guestroom-pace-report.html), [PriceLabs](https://hotels.pricelabs.co/blog/hotel-revenue-reports/)). Fiecare deltă trebuie deci să își numească baza, iar baza activă trebuie să fie aceeași pe tot ecranul. Trei convenții din acest raport nu au sursă și sunt recomandări de practică: delta ocupării exprimată în puncte procentuale („+2,1 pp"), pragul de trei cifre semnificative pentru valută și formatarea în locale românesc (virgulă zecimală, „mii"/„mil.", simbolul € după valoare). Notele de cercetare nu au găsit nicio sursă despre formatarea numerelor pentru utilizatori europeni; `Intl.NumberFormat('ro-RO', { notation: 'compact' })` este punctul de pornire rezonabil, de validat cu Juyo.

## Fiecare ecran Compass primește un singur erou și două niveluri de adâncime

Ordinea conținutului urmează fluxul de dimineață descris de vendori: prima întrebare a unui revenue manager este „What was the pickup yesterday?", urmată de pace față de același moment de anul trecut și de breakdown-uri pe segment și canal; anomaliile se caută pe următoarele 90 de zile ([Lighthouse: pickup report](https://www.mylighthouse.com/resources/blog/booking-pickup-and-pace-revenue-management), [Lighthouse Performance](https://www.mylighthouse.com/resources/blog/hotel-revenue-management-workflows)). GM-ul și proprietarul citesc un flash report: ieri, MTD și YTD pentru ocupare, ADR, RevPAR și venit, fiecare față de buget și anul trecut ([Stayntouch: Manager Daily Report](https://stayntouch.freshdesk.com/support/solutions/articles/24000098730-manager-daily-report), [RMS Cloud](https://support.rmscloud.com/hc/en-gb/articles/12964128509327)). Toate aceste surse sunt documentație sau opinie de vendor; nu există cercetare independentă cu utilizatori, deci ordinea este convenție, nu comportament măsurat. Layout-urile de mai jos sunt recomandări derivate din regulile anterioare.

| Ecran | Structură | Erou | Densitate |
|---|---|---|---|
| Inbox / morning brief, desktop | conținut ≤ 1280 px; stivă: header, sumar Kassandra, KPI rail, apoi split 2/3 + 1/3 | sumarul + rail-ul | comfortable |
| Inbox / morning brief, telefon | o coloană, gutter 16 px; sumar, KPI 2×2, listă „Cere atenție" | sumarul | comfortable, ținte 44 px |
| Thread cu evidence panel | conversație ≤ 68ch + supporting pane 400 px la dreapta | răspunsul curent | chat comfortable, evidence compact |
| Boards | 12 coloane full-width, rânduri cu înălțimi presetate, grupuri pliabile | primul rând al board-ului | comfortable, comutabil de utilizator |
| Agent Studio, listă | tabel pe toată lățimea, rânduri clicabile | tabelul | compact pe tabel |
| Agent Studio, detaliu | coloană primară 2/3 + secundară 1/3, tab-uri, editare în drawer | configurația agentului | comfortable |
| Workflow builder | canvas full-bleed + paletă stânga + inspector dreapta | canvas-ul | chrome compact, formulare comfortable |

**Inbox / morning brief pe desktop.** Header-ul de pagină scrie o singură dată proprietatea, data și baza de comparație. Sub el vine sumarul Kassandrei, două–trei propoziții la cel mult 68 de caractere pe linie, după modelul Pulse cu text în capul paginii. Urmează KPI rail-ul cu patru tile-uri (Ocupare, ADR, RevPAR, Venit), singurul loc cu cifre de 32 px și cu `--space-section` deasupra și dedesubt, ca spațiul să îl marcheze drept cel mai important. Aceste trei elemente trebuie să încapă în jumătatea de sus a unui viewport de 1080 px. Dedesubt, coloana de 2/3 ține insight card-urile: fiecare are titlu care rezumă mesajul, un grafic de 180 px și o singură acțiune („Întreabă-o pe Kassandra" sau „Deschide"), conform regulii Apple ca fiecare grafic să aibă un titlu care îi rezumă mesajul și să nu ceară interacțiune pentru informația critică ([Apple HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)). Un card pe rând în această coloană, sau două când insight-urile sunt de importanță egală. Coloana de 1/3 ține liste plafonate la cinci rânduri: pickup de ieri și din ultimele 7 zile, date în urma pace-ului în următoarele 90 de zile. Primul insight card trebuie să fie tăiat de fold, ca semn că pagina continuă, pentru a evita „false floor" ([NN/g: Scrolling and Attention](https://www.nngroup.com/articles/scrolling-and-attention/)).

**Inbox / morning brief pe telefon.** Regula lui Few de „un singur ecran" nu se poate aplica literal; se păstrează partea transferabilă: privirea de ansamblu și ce cere atenție sunt vizibile fără navigare. Sumarul vine primul, apoi KPI-urile într-o grilă 2×2, astfel încât cele patru valori să rămână vizibile simultan; fiecare tile ține label, valoare de 24 px și o singură deltă, fără sparkline. „Cere atenție" devine listă de rânduri cu titlu și deltă, iar graficul apare la tap, în ecranul de detaliu: al doilea și ultimul nivel. Navigarea trece din sidebar în bară de jos sub 600 px ([Material adaptive codelab](https://developer.android.com/codelabs/adaptive-material-guidance)), iar tabelele late blochează prima coloană și lasă vizibil că există date dincolo de marginea orizontală ([NN/g: Mobile Tables](https://www.nngroup.com/articles/mobile-tables/)).

**Thread cu evidence panel.** Este layout-ul canonic „supporting pane" din Material: conversația în panoul principal, evidence-ul în panoul din dreapta, care în Primer este locul pentru metadate, detalii și informație auxiliară ([Primer: Layout](https://primer.style/product/getting-started/foundations/layout/)). Conversația se plafonează la 68ch, iar un răspuns conține cel mult un grafic inline de 180 px cu titlu-concluzie. Panoul de evidence, lat de 400 px (interval rezonabil 360–480; cifra este recomandare, nu specificație), urmează ordinea Pulse: insight-uri cheie, vizualizarea, referințele la sursă (view-ul SQL, perioada, filtrele), apoi întrebări de follow-up. Tabelele din panou folosesc `data-density="compact"` cu rânduri de 32 px; interogarea SQL brută stă pliată, ca al doilea nivel. Deschiderea unui panou lateral reduce numărul de coloane al conținutului, nu îl comprimă ([Carbon: 2x Grid usage](https://carbondesignsystem.com/elements/2x-grid/usage/)). Sub 1200 px panoul devine drawer peste conversație, iar pe telefon bottom sheet; cu înălțime sub 480 px layout-urile cu două panouri nu sunt practice ([Android: window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes)).

**Boards.** Grid de 12 coloane pe toată lățimea, tile-uri care se aliniază la 1/12, lățime minimă 3/12, cel mult patru KPI-uri sau trei grafice pe rând. Înălțimile se aleg din presetări, nu prin drag liber: tile KPI, card cu grafic de 180 px, card cu grafic de 320 px, tabel. Secțiunile au header de text care poartă intervalul de timp și se pot plia, ca grupurile Datadog. Un tabel primește propriul card pe toată lățimea și nu împarte cardul cu proză sau KPI-uri. Pentru banda de KPI-uri merită testat gutter-ul condensat de 1 px din Carbon: patru tile-uri lipite, cu padding interior de 16–24 px, se citesc ca un singur chunk și lasă spațiul mare pentru despărțirea de restul board-ului. Aici comutatorul de densitate al utilizatorului are cel mai mult sens.

**Agent Studio.** Lista de agenți este un tabel, nu o grilă de carduri: itemii sunt omogeni și se compară după status, ultima rulare și program. Prima coloană este numele lizibil, coloanele sunt ordonate după importanță, rândul are hover și este clicabil, iar numărul de coloane rămâne în jur de șase ([NN/g: Data Tables](https://www.nngroup.com/articles/data-tables/), [UXmatters: mobile tables](https://www.uxmatters.com/mt/archives/2020/07/designing-mobile-tables.php)). Rândurile au 40 px, sau 64 px dacă numele are și o descriere pe a doua linie, singurul caz pentru care Carbon recomandă mărimea xl. Detaliul unui agent urmează modelul Stripe: rută proprie cu breadcrumb, tab-uri pentru zone distincte (Configurare, Rulări, Surse), coloană primară cu instrucțiunile și istoricul și coloană secundară cu metadate. Editarea se face în drawer, la densitate comfortable, pentru că interfețele de editare focalizată cer densitate scăzută.

**Workflow builder.** Canvas-ul ocupă tot spațiul și nu are lățime maximă; chrome-ul urmează „L-ul inversat" din Linear, cu sidebar și bară de sus care controlează view-ul principal ([Linear: redesign part II](https://linear.app/now/how-we-redesigned-the-linear-ui)). Paleta de noduri stă în stânga (aproximativ 240–280 px), inspectorul nodului selectat în dreapta (320–360 px); ambele lățimi sunt recomandări fără sursă. Paleta și toolbar-ul pot fi compacte, dar formularele din inspector rămân comfortable, cu control de 36 px: Carbon cere modul lat pentru câmpurile etichetate, iar Material exclude suprafețele de task din densificare. Acțiunile critice (Salvează, Rulează) stau în bara de sus, nu în josul ferestrei ([Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)). Sub 1200 px inspectorul devine overlay; pe telefon, varianta rezonabilă este o listă verticală a pașilor, doar pentru citire și pornire, dar aceasta este o presupunere de produs, nu o concluzie din surse.

## Concluzie

Cercetarea mută întrebarea de la „comfortable sau compact?" la „unde merge spațiul?". Niciun design system nu tratează densitatea ca pe o alegere globală de gust: toate o tratează ca pe o proprietate a regiunii și a sarcinii, dens unde se scanează și se compară, relaxat unde se editează și se decide. Pentru un demo adresat Juyo, asta înseamnă că impresia de produs îngrijit va veni mai puțin din valorile exacte ale token-urilor și mai mult din trei discipline vizibile în primele secunde: un singur element dominant pe ecran, aceeași bază de comparație numită peste tot, și carduri plate separate prin trepte de spațiu, nu prin borduri și umbre.

Partea slabă a bazei de dovezi merită spusă direct. Nu există studii controlate care să compare modurile compact și comfortable pe dashboard-uri de business, nici un număr maxim validat de tile-uri KPI, nici măsurători pe capturi de ecran ale produselor analizate; cifra des citată de „20% comprehensiune în plus din spațiu alb" nu a putut fi urmărită până la un studiu primar și nu trebuie folosită ca argument. Regulile de aici sunt convergența documentată a practicii, suficientă pentru un MVP, iar cele trei lucruri care merită validate cu utilizatori reali Juyo sunt ordinea conținutului din morning brief, formatarea numerelor în locale european și dacă revenue managerii vor de fapt compact ca default pe boards.
