# Chart selection, pie/donut rules and premium chart design for Compass

Research notes, 2026-11-20. Scope: a sourced guide to choosing chart types for a hotel-group analytics app whose AI assistant generates charts. It covers when pies and donuts are acceptable, which chart types belong in the catalogue, the visual rules that make charts look premium in light and dark themes, accessibility, and what design systems say. Anything marked **[our call]** is my synthesis, not a source's claim. "Via search snippet" means I saw the claim only in a search-engine summary because the page could not be fetched, so treat it as lower confidence.

## 1. What do the established chart-choice frameworks recommend, and where do they agree?

### Takeaway
Every framework starts from the message or data question, not from the chart (FT Visual Vocabulary, GOV.UK Analysis Function, From Data to Viz, Power BI). The perception research behind them ranks encodings the same way: position on a common scale beats length, and both beat angle and area (Cleveland & McGill; Heer & Bostock). As a result the frameworks share a small default set: line for time, sorted bar for comparison and ranking, scatter for relationships, histogram or box plot for distributions, and bar or stacked bar for part-to-whole, with pies allowed only in narrow cases. They also share a "maximise data, minimise decoration" style (Tufte, Few, Knaflic/SWD, Datawrapper).

### Cited Findings

#### FT Visual Vocabulary (Financial Times)
- The vocabulary has nine relationship categories, each with a list of chart types. Paraphrased:
  - **Deviation:** emphasises +/- variation from a fixed reference point such as zero, a target or a long-term average. Charts: diverging bar, diverging stacked bar, spine chart, surplus/deficit filled line.
  - **Correlation:** the relationship between two or more variables. Readers may assume causation unless told otherwise. Charts: scatterplot, line + column, connected scatterplot, bubble, XY heatmap.
  - **Ranking:** use when an item's position in an ordered list matters more than its absolute value. Charts: ordered bar, ordered column, ordered proportional symbol, dot strip, slope, lollipop.
  - **Distribution:** histogram, boxplot, violin, population pyramid, dot strip, dot plot, barcode plot, cumulative curve.
  - **Change over time:** line, column, line + column, stock price, slope, area, fan chart (projection), connected scatterplot, calendar heatmap, Priestley timeline, circle timeline, seismogram.
  - **Magnitude:** compares sizes, usually of counted numbers rather than rates. Charts: column, bar, paired column/bar, proportional stacked bar, proportional symbol, isotype, lollipop, radar, parallel coordinates.
  - **Part-to-whole:** how a single entity breaks down into components. If only the component sizes matter, a magnitude chart may be better. Charts: stacked column, proportional stacked bar, pie, donut, treemap, Voronoi, arc, gridplot, Venn, waterfall.
  - **Spatial:** use only when precise locations or geographic patterns matter most. Charts: choropleth (rates/ratios), proportional symbol (counts), flow map, contour, cartograms, dot density, heat map.
  - **Flow:** the volume or intensity of movement between states or locations. Charts: Sankey, waterfall, chord, network.
  - Source for all of the above: [FT chart-doctor: Visual Vocabulary](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary). The interactive version is at [ft-interactive.github.io/visual-vocabulary](http://ft-interactive.github.io/visual-vocabulary/).
- On pies, the FT says a pie is a common way to show part-to-whole but it is difficult to compare segment sizes accurately. On donuts, it says the centre can hold extra information such as a total. — [FT chart-doctor](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)

#### From Data to Viz (Yan Holtz and Conor Healy)
- The decision tree starts from the input data type: Numeric, Categoric, Num & Cat, Maps, Network or Time series. It leads to about 20 data formats. — [From Data to Viz](https://www.data-to-viz.com/)
- What it suggests for each type:
  - One categorical variable: barplot, lollipop, pie/doughnut, treemap, waffle, word cloud.
  - Several categorical variables: heatmap, Sankey, chord, network. Nested data: sunburst, circular packing.
  - One value per group: barplot, lollipop. Several observations per group: violin, boxplot.
  - Time series: line, area, stacked area, streamgraph, heatmap.
  - Source: [From Data to Viz](https://www.data-to-viz.com/)
- It keeps a "gallery of common caveats" covering ordering data, cutting the Y axis, spaghetti charts, pie charts, histogram bin size, boxplot limitations, error bars, overplotting, rainbow palettes and faceting direction. — [From Data to Viz](https://www.data-to-viz.com/)

#### Data Viz Catalogue (Severino Ribecca)
- The catalogue sorts charts by function. It tags the pie chart with Comparisons, Part-to-a-whole and Proportions. — [Data Viz Catalogue: Pie Chart](https://datavizcatalogue.com/methods/pie_chart.html)
- Pies are "ideal for giving the reader a quick idea of the proportional distribution of the data." They are weak for accurate comparisons, including between groups of pies, because people judge area less precisely than length. Comparing one slice with the whole works well. — [Data Viz Catalogue](https://datavizcatalogue.com/methods/pie_chart.html)
- Pies take more room than a 100% stacked bar chart, partly because of their size and the usual need for a legend. The catalogue names the 100% stacked bar as the space-saving alternative. — [Data Viz Catalogue](https://datavizcatalogue.com/methods/pie_chart.html)

#### Cleveland & McGill (1984) and Heer & Bostock (2010): the perception ranking
- Cleveland & McGill's paper is "Graphical Perception: Theory, Experimentation, and Application to the Development of Graphical Methods", JASA 79(387):531–554. Its elementary perceptual tasks include position, length, angle, area, volume, direction, curvature, shading and colour saturation. — [Cleveland & McGill 1984 (DOI)](https://doi.org/10.1080/01621459.1984.10478080); task list confirmed via search snippets of course notes such as [UBC perception slides](https://www.cs.ubc.ca/~tmm/courses/533-09/slides/percep.pdf)
- The ranking as commonly rendered, from most to least accurate:
  1. Position on a common scale
  2. Position on non-aligned scales
  3. Length, direction, angle
  4. Area
  5. Volume, curvature
  6. Shading, colour saturation
  - This ordering comes from secondary course slides (via search snippets), not from the paper itself. — [UBC perception slides](https://www.cs.ubc.ca/~tmm/courses/533-09/slides/percep.pdf); [NIU lecture](https://faculty.cs.niu.edu/~dakoop/cs680-2019fa/lectures/lecture10.pdf)
- Heer & Bostock replicated the study on Mechanical Turk. Judgment types 1–3 used position on a common scale, 4–5 used length, 6 used angle (a pie) and 7 used circular area (a bubble).
  - "the rough shape and ranking of judgment types by accuracy (T1-5) are preserved"
  - "position encoding still significantly outperformed length encoding"
  - Area did worse than angle, and both did worse than position, as theory predicts. But "Theory also suggests that angle should perform worse than length, but the results do not support this."
  - Source: [Heer & Bostock 2010, CHI, "Crowdsourcing Graphical Perception"](http://vis.stanford.edu/files/2010-MTurk-CHI.pdf)
- Rectangles and treemaps: "the accuracy of rectangular area judgments matches that of circular area judgments." Comparing squares (aspect ratio 1) gave the worst performance. Isolated rectangles and a treemap layout showed no significant difference. — [Heer & Bostock 2010](http://vis.stanford.edu/files/2010-MTurk-CHI.pdf)
- Gridlines and chart size:
  - Their gridline results "corroborate Stone & Bartram's recommendation of alpha = 0.2 as a 'safe' default."
  - Charts 40 px tall produced significantly more error. The authors "suggest little benefit for increasing chart height beyond 80 pixels when using a 0-100 scale."
  - Adding gridlines improved accuracy, and "gridlines be separated by at least 8 pixels."
  - Source: [Heer & Bostock 2010](http://vis.stanford.edu/files/2010-MTurk-CHI.pdf)

#### Stephen Few (Perceptual Edge)
- Few says the pie's main strength is that the part-to-whole message is built into it. A bar on a percentage scale conveys part-to-whole "only slightly less effectively than a pie chart with a quarter slice", especially if the title says the bars are parts of a total. "Pie charts only make it easy to judge the magnitude of a slice when it is close to 0%, 25%, 50%, 75%, or 100%." — [Few, "Save the Pies for Dessert", Aug 2007](https://www.perceptualedge.com/articles/visual_business_intelligence/save_the_pies_for_dessert.pdf)
- For shares changing over time he writes "Nothing shows change through time better than a line." He adds that a stacked area chart shows totals but makes every series except the bottom one hard to track, because only the bottom series has a flat baseline. — [Few 2007](https://www.perceptualedge.com/articles/visual_business_intelligence/save_the_pies_for_dessert.pdf)
- Few quotes Cleveland: "Pie charts [along with other forms of area charts] do not provide efficient detection of geometric objects that convey information about differences of values." (*The Elements of Graphing Data*, 1994, p. 268). — [Few 2007](https://www.perceptualedge.com/articles/visual_business_intelligence/save_the_pies_for_dessert.pdf)

#### Edward Tufte
- *The Visual Display of Quantitative Information* (1983), p. 178: a "table is nearly always better than a dumb pie chart; the only worse design than a pie chart is several of them, for then the viewer is asked to compare quantities located in spatial disarray". Confirmed via search snippets of the chapter. — [Tufte, Aesthetics and Technique chapter (CMU course copy)](https://www.stat.cmu.edu/~brian/rm/764-2016/week04/graphs%20and%20tables/tufte-aesthetics_and_technique.pdf); [Tufte notebook: Pie charts](https://www.edwardtufte.com/notebook/pie-charts/)
- Sparklines:
  - "A sparkline is a small intense, simple, word-sized graphic with typographic resolution." Sparklines are "data-intense, design-simple, word-sized graphics."
  - They can be embedded in a sentence, table, headline, map, spreadsheet or graphic.
  - The governing idea is "max[data], min[design]": minimise design, not data.
  - Source: [Tufte, Sparkline theory and practice](https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/)

#### Cole Nussbaumer Knaflic / Storytelling with Data (SWD)
- The book says "pie charts are evil" and recommends the horizontal bar chart as the go-to graph for categorical data. Via search snippet. — [Knaflic, Storytelling with Data (excerpt)](https://introductiontodatavisualization.commons.gc.cuny.edu/files/2022/09/Knaflic-storytelling-data.pdf)
- In a 2017 post she softened this: pies are not inherently evil, but appropriate use cases are few. Via search snippet. — [SWD: an updated post on pies](https://www.storytellingwithdata.com/blog/2017/1/10/an-updated-post-on-pies)
- A 2020 SWD post by Elizabeth Ricks (not Knaflic) says "Pie charts are probably better than any other visual for expressing a part-to-whole relationship." It names two use cases: a general part-to-whole sense, and showing that one segment is relatively small or large. — [SWD: what is a pie chart?](https://www.storytellingwithdata.com/blog/2020/5/14/what-is-a-pie-chart)

#### Process framing (GOV.UK, Power BI)
- GOV.UK: decide the message first. If you cannot write it in a few sentences, simplify the chart or split the message. The page points to the FT Visual Vocabulary and maps time series to line charts, part-to-whole to bar, pie, donut, treemap or bubble, and correlation to scatter. — [UK Government Analysis Function: Data visualisation: charts](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)
- Power BI's "Choosing the right visual" asks you to weigh data type (categorical, numerical, time-based, geographic), goal (compare, show trends, show relationships, track progress), audience, and available space. — [Microsoft Learn: Overview of visualizations in Power BI (updated 2026-10-15)](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualizations-overview)

### Inferences
- **Where the frameworks agree:**
  - Start from the question.
  - Encode the most important comparison as position along a common aligned scale.
  - Sort categorical data unless it has a natural order.
  - Use lines for time.
  - Treat pies as a narrow special case.
  - Prefer small multiples to overloaded single charts.
  - Strip decoration, and use colour to direct attention rather than to decorate.
  - Sources: FT, From Data to Viz, Few, Tufte, SWD and GOV.UK as cited above.
- **Where they differ:**
  - The FT lists radar and pie as legitimate options, while From Data to Viz, Few and Tufte argue against them.
  - Power BI presents radial gauges positively, while Few designed the bullet graph to replace them. See Q3.
- **Question-to-chart map for the Compass AI assistant [our call]**, built on the sources in brackets:

| Data question | Default chart | Good alternates | Fails when / guardrail | Compass (hotel) example |
|---|---|---|---|---|
| Single KPI ("how are we doing?") | KPI tile: value + delta vs a named comparison + sparkline [Power BI card/KPI; Tufte] | Bullet graph vs target/LY with 2–5 bands [Few spec]; linear progress meter [Carbon "meter"] | Delta with no stated basis; mixing % and percentage points [ONS]; radial gauge [Few] | "Occupancy 78.4%, +3.1 pp vs same week LY" with a 13-week sparkline |
| Change over time | Line for continuous time; column for a few discrete periods or totals [FT; Power BI] | Single-series area; calendar heatmap for daily seasonality [FT]; fan chart for forecasts [FT] | More than ~4 emphasised lines [GOV.UK] or 8 series [Cloudscape]: switch to small multiples. Dual axes [GOV.UK; Datawrapper]. Interpolating across data gaps or changing tick increments [Carbon] | Daily RevPAR with a dashed same-period-LY line |
| Comparison of magnitudes | Sorted horizontal bar (long labels) [Power BI; SWD] | Column (few, short labels); grouped bar (2–3 series); dot plot or dumbbell for two values per category [FT paired bar/dot plot; Salesforce dot plot] | Non-zero or broken bar axis [GOV.UK; Carbon; Salesforce]; rotated labels, so switch to horizontal bars [Datawrapper] | ADR by property this month; dumbbell of LY vs TY per property |
| Ranking | Ordered bar, lollipop or dot strip [FT] | Slope for rank or value change between two dates [FT]; ribbon for rank over time [Power BI] | Unsorted or alphabetical order [SWD; GOV.UK] | Top 10 properties by RevPAR; slope LY to TY |
| Part-to-whole | Sorted bar on a % axis [Few] or one 100% stacked bar [Data Viz Catalogue] | Donut/pie only through the gate in Q2; treemap for many hierarchical parts [Power BI; From Data to Viz]; 100% stacked bars for groups [Datawrapper; ONS; EUI]; line of shares over time [Few] | More than 5 parts, similar sizes, several pies, negatives, totals not summing to 100% (Q2) | Channel mix this month (4 channels): donut with total. Mix by property: 100% stacked bars |
| Distribution | Histogram [FT] | Box plot, dot strip or violin to compare groups; cumulative curve [FT] | Poor bin size; box plots hiding multimodality; overplotting [From Data to Viz caveats] | Booking lead time; length of stay |
| Relationship | Scatter [FT] | Bubble for a 3rd measure [Power BI]; quadrant (scatter + median/target lines) [our call]; connected scatter for two measures over time [FT; Datawrapper] | Readers infer causation [FT]; overplotting [From Data to Viz]; two lines on two axes [Datawrapper] | Occupancy vs ADR per property, with quadrants split at portfolio medians |
| Deviation / variance | Diverging bar vs zero, target or LY [FT] | Waterfall bridge [Power BI; FT]; bullet [Few]; surplus/deficit filled line [FT]; IBCS scenario notation (Q4) | Red/green as the only cue [Datawrapper]; no visible reference line | RevPAR variance vs budget by property; GOP bridge from budget to actual |
| Flow / process | Funnel for sequential stages [Power BI] | Sankey for multi-path flows [FT; Salesforce]; waterfall [FT] | Non-sequential "stages" in a funnel; too many Sankey nodes [our call] | Visits to searches to bookings; channel to room type |
| Geography | Choropleth for rates, proportional symbols for counts [FT] | Sorted bar of regions when location is not the point [FT: "only when precise locations or geographical patterns matter most"] | Raw counts on a choropleth [FT's rate/count split] | Guest source markets |
| Two-way patterns | Heatmap or matrix [FT XY heatmap; Salesforce distribution] | Calendar heatmap [FT] | Rainbow palettes [From Data to Viz]; narrow lightness range [Datawrapper] | Occupancy by weekday × month; pickup by lead time × arrival month |
| Exact look-ups / many metrics per entity | Table with in-cell bars and sparklines [GOV.UK: tables for exact values; Power BI data bars; Tufte] | — | Used where a pattern should be visible at a glance [Few] | Property league table |
| Many series of one metric | Small multiples with shared axes [Power BI; From Data to Viz] | — | Independent y-scales that invite false comparisons [our call] | RevPAR trend per property, in a grid |

### Gaps
- I did not read the Cleveland & McGill paper itself. The six-tier ranking above comes from secondary course slides (search snippets) and is corroborated by the Heer & Bostock replication for tiers 1–3.
- I could only confirm the Data Viz Catalogue's function tags for the pie page. Its full function taxonomy was not visible.
- Tufte's data-ink ratio and chartjunk concepts were not verified from a primary page in this session. Only the sparkline and pie quotes were.
- I found no primary source that gives a numeric cap on bars per bar chart.

## 2. Pie and donut charts: what the evidence says, when they are acceptable, the alternatives, and what tools and design systems advise

### Takeaway
The evidence is more nuanced than "pies are evil". People do not read pies mainly by angle. Arc length or area seems to be the cue (Skau & Kosara 2016; Kosara 2019), donuts are as accurate as pies, and angle and length performed similarly in Heer & Bostock. But pies still lose to aligned position for comparing parts, ranking them, or comparing across groups or time.

Sources almost all agree a pie or donut is acceptable only when all of these hold:
- the parts make up one meaningful whole that sums to 100%;
- it is one total at one point in time;
- there are few slices (thresholds range from 2–3 ideal to a hard maximum of 5–6; Flourish alone allows 7);
- the message is "one part is big, or about a quarter, half or three quarters";
- slices are labelled directly, ordered from 12 o'clock, and never exploded or 3D.

Otherwise use a sorted bar, a 100% stacked bar, a line of shares over time, a treemap or a waffle.

### Cited Findings

#### Perception studies
- **Skau & Kosara 2016**, "Arcs, Angles, or Areas: Individual Data Encodings in Pie and Donut Charts", *Computer Graphics Forum* 35(3):121–130 (EuroVis 2016), DOI 10.1111/cgf.12888. The study tested angle, arc length and area separately. Abstract-level conclusion: angle is "the least important visual cue for both charts", and the donut chart is "as accurate as the traditional pie chart." — [Tableau Research: Arcs, Angles, or Areas](https://www.tableau.com/research/publications/arcs-angles-or-areas-individual-data-encodings-pie-and-donut-charts); [Eurographics DL](https://diglib.eg.org/handle/10.1111/cgf12888)
- Kosara's own summary of the 2016 studies:
  - "we do not read pie charts by angle." He suspects arc length, alone or with area.
  - "the donut chart is no worse than the pie chart."
  - Six donut hole sizes were tested, from 20% to 97% of the radius. Only the thinnest showed a borderline difference: "To be safe, you should probably stay away from very thin donuts."
  - Exploded pies had higher error: "avoid exploded pie charts." "The larger slice gets overestimated systematically." Irregular pies had significantly higher error.
  - "Donut charts are popular and are useable wherever a pie chart can be used."
  - Limits: the studies did not compare pies with bar charts and did not test multi-slice pies.
  - Source: [Kosara, eagereyes: An Illustrated Tour of the Pie Chart Study Results](https://eagereyes.org/blog/2016/an-illustrated-tour-of-the-pie-chart-study-results)
- **Kosara 2019** (IEEE VIS short paper) was a preregistered study using projected 3D pies to separate the cues. Area ranked as the most likely cue people use. — [Tableau Research: Evidence for Area as the Primary Visual Cue in Pie Charts](https://tableau.com/research/publications/evidence-area-primary-visual-cue-pie-charts) (abstract only)
- **Heer & Bostock 2010:** angle judgments (pie) were not worse than length judgments, but position on a common scale significantly outperformed both. — [Heer & Bostock 2010](http://vis.stanford.edu/files/2010-MTurk-CHI.pdf)
- **Few 2007:**
  - Pies are easy to read only near 0, 25, 50, 75 or 100%. In his example a 25% slice is obvious when it runs from 6 to 9 o'clock but hard to recognise once slices are sorted and it no longer sits on a 90° landmark.
  - Adding values and direct labels turns the pie into "an awkwardly arranged equivalent of a table of labels and values."
  - The pie's one advantage comes from Spence & Lewandowsky (1991, *Applied Cognitive Psychology* 5:61–77): judging "Which is greater, A+B or C+D?" Few concludes: "should you ever need to display data for this purpose, a pie chart would serve you well. Otherwise, save the pies for dessert."
  - Source: [Few 2007](https://www.perceptualedge.com/articles/visual_business_intelligence/save_the_pies_for_dessert.pdf)
- **Tufte:** several pies are worse than one because quantities sit "in spatial disarray". Via search snippets. — [Tufte chapter (CMU copy)](https://www.stat.cmu.edu/~brian/rm/764-2016/week04/graphs%20and%20tables/tufte-aesthetics_and_technique.pdf)

#### Practitioner and tool guidance
- **Datawrapper** (Lisa Charlotte Muth, 2018):
  - "Pie charts are great to show how 100% divide up into a few shares."
  - "Pie charts work best for values around 25%, 50% or 75%."
  - "Pie charts work best if you only have a few values – five max." Above five, use a stacked bar or column chart.
  - With only two values, state the number in the text instead.
  - "One pie chart can only show one total and its shares." To compare totals (for example two polls), use a stacked bar.
  - Highlight the key value in colour and show the rest in shades of one colour, not a rainbow.
  - Put labels for small slices outside the chart. Group small slices into "others".
  - Place pies in a margin column or sidebar, because they cannot fill the full text width.
  - Source: [Datawrapper: What to consider when creating pie charts](https://www.datawrapper.de/blog/pie-charts)
- **Datawrapper** labels line, pie and donut charts directly by default on desktop. On mobile the colour key moves to the top. — [Datawrapper: Text in data visualizations (2022)](https://www.datawrapper.de/blog/text-in-data-visualizations)
- **Flourish:**
  - Pies and donuts suit part-to-whole data with "a clear, limited number of categories".
  - It recommends "five to seven slices"; beyond that, "a bar chart may be more effective."
  - For comparisons it suggests a grid of pies (small multiples), or pies sized by total.
  - The donut centre is often used for central labels.
  - Source: [Flourish: What is a pie chart?](https://flourish.studio/visualisations/pie-charts/)
- **Tableau:** use pie charts only with a small number of slices, and avoid them when a dimension has too many categories. A stacked bar compares multiple categories better. Via search snippet; the direct fetch was refused (403). — [Tableau: Pie Charts](https://www.tableau.com/chart/what-is-pie-chart); [Tableau reference library](https://tableau.com/data-insights/reference-library/visual-analytics/charts/pie-charts)
- **Power BI:** "Pie and donut charts show the relationship of parts to a whole. Donut charts have an open center that can display a value, such as the total... Use these charts when you have a small number of categories." — [Microsoft Learn: Power BI visualizations overview](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualizations-overview)
- **Storytelling with Data** (Ricks 2020):
  - "if the slices sum to something other than 100%, it is wrong."
  - Limit slices, grouping small ones into "All other".
  - Sort meaningfully, for example descending rather than alphabetical.
  - Label directly "so long as there's sufficient space".
  - Use colour sparingly to focus attention on the key segment.
  - Avoid 3D and exploding effects, which "introduce unnecessary clutter and can distort the data."
  - Avoid comparing similar-sized slices or comparing across pies. A horizontal bar on a consistent baseline is the comparison alternative.
  - Source: [SWD: what is a pie chart?](https://www.storytellingwithdata.com/blog/2020/5/14/what-is-a-pie-chart)
- **From Data to Viz:**
  - Pies are "bad by definition" because "humans are pretty bad at reading angles." Its three side-by-side pies hide differences that a barplot reveals.
  - Pies get worse with 3D, a separate legend, totals not summing to 100, too many items, or exploded slices.
  - Alternatives: "The barplot is the best alternative to pie plots"; a lollipop for many values; a treemap to describe what the whole is made of.
  - Source: [From Data to Viz: The issue with pie chart](https://www.data-to-viz.com/caveat/pie.html)
- **UK ONS service manual:**
  - Pies are "most effective when there are a small number of categories with significant differences in size". Three or four categories is ideal; avoid more than six.
  - Combine the smallest categories into "other". If differences are small, use a bar chart.
  - Do not use pies for rates (for example unemployment by age), incomplete data, or data that can exceed 100% such as multi-select survey answers.
  - Do not use multiple pies to compare groups; use a stacked bar or column.
  - Run segments clockwise from 12 o'clock, largest to smallest, with "other" last.
  - Label directly; use a legend only when space is limited, as on mobile.
  - Source: [ONS Service Manual: Pie and doughnut charts](https://service-manual.ons.gov.uk/data-visualisation/chart-types/pie-and-doughnut-charts)
- **UK Government Analysis Function:**
  - Use pies only when "there are five categories or fewer" and the categories "sum to a meaningful whole". You may combine categories but never remove one from the whole.
  - Use a bar chart if several categories are a similar size.
  - Pies "are not the best in terms of accessibility as they are hard to understand when magnified."
  - Value labels are useful only with "four categories or fewer."
  - Source: [Analysis Function: charts](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)
- **Elastic EUI:**
  - Pies are suitable when "There are a maximum of 6 slices", "The values are around 25%, 50% or 75%", or "One of the categories is much bigger than the others". Donuts follow the same rules, and their centre can hold related information.
  - Avoid them when users must compare slices, when there are more than 6 slices, when values are negative, or when you would need multiple pies. For multiple data sets, "use part-to-whole bar charts with percentages."
  - Most pie, donut and sunburst data "can be better explained using bar charts."
  - Grouping into "Other" is allowed but "could end up being the largest category and therefore obscuring the meaning of the chart."
  - Ordering: "start from the 12 o'clock position" with "the largest slice in the clockwise position then the rest ordering counterclockwise in descending order". Natural orders take precedence.
  - "under no circumstances should you enlarge or explode slices."
  - Labels go within slices (or just outside), with values appended. With many small slices or long labels, use a legend formatted as a table with right-aligned values.
  - Source: [Elastic EUI: Part-to-whole comparisons](https://eui.elastic.co/docs/dataviz/types/part-to-whole-comparisons/)
- **Salesforce Lightning** (archived Spring '20 guidelines):
  - Use composition charts for two to five values: "Don't choose a composition chart for data sets with more than five values."
  - Sort slices in descending order starting at 12 o'clock and moving clockwise, never in random order.
  - Source: [SLDS (Spring '20) Charts guidelines](https://spring-20.lightningdesignsystem.com/guidelines/data-visualization/charts/)
- **AWS Cloudscape:** pie and donut are for categorical data at a snapshot in time, with 1–5 data points and a single series. A donut "includes a summary metric in the center." — [Cloudscape: Data visualization pattern](https://cloudscape.design/patterns/general/data-vis/)
- **Adobe Spectrum:** 2–3 segments if possible and no more than 5, with the largest segment starting at 12 o'clock and running clockwise. Via search snippet only; the page returned 404 on 2026-11-20. — [Spectrum: Donut chart](https://spectrum.adobe.com/page/donut-chart)
- **PatternFly:** no more than six categories in a donut, 3 px padding between segments, and a legend with values for accessibility. Via search snippet. — [PatternFly: Donut chart design guidelines](https://www.patternfly.org/charts/donut-chart/design-guidelines)
- **WCAG 1.4.11:** to read a pie you must see the slice edges, so adjacent slices below 3:1 contrast fail. A darker border around a slice fixes it, and so do conforming text values, which make the slices non-essential. — [W3C Understanding SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

### Inferences
- **Pie/donut gate for the AI assistant [our call].** Allow a pie or donut only if every condition holds; otherwise fall back as listed below.
  1. The values are non-negative parts of one meaningful whole and sum to 100%. No rates, no multi-select data, no partial totals. [ONS; GOV.UK; EUI; SWD]
  2. One total at one point in time. [Datawrapper; Cloudscape "snapshot"; ONS]
  3. 2–5 slices after grouping, with 2–4 preferred. "Other" must not be the largest slice. With exactly 2 values, prefer a big number or a single 100% bar. [Datawrapper; GOV.UK; Salesforce; Cloudscape; Spectrum; EUI; ONS]
  4. The user's question is about share or dominance ("what share is direct booking?"), not ranking or comparing near-equal parts. If the two largest slices differ by less than about 5 percentage points, use a bar. [our call on the 5 pp number, based on GOV.UK/ONS "similar size → bar"]
  5. Largest slice starts at 12 o'clock and the rest run clockwise in descending order. Ordinal categories (such as aging buckets) keep their natural order. [Salesforce; ONS; Spectrum; EUI]
  6. Labels are direct, with name and %. A legend is used only on narrow screens. Show values only with 4 or fewer slices, or when labels fit. [GOV.UK; ONS; Datawrapper; EUI]
  7. Prefer a donut, with the total or headline share in the centre. Keep the ring thickness moderate: very thin rings (hole about 97% of the radius) showed borderline extra error. [Kosara; Power BI; Cloudscape; FT]
  8. Use one highlight colour and tints of one neutral for the rest. Separate slices with 1–2 px gaps in the background colour so edges meet 3:1. [Datawrapper; SWD; WCAG 1.4.11; PatternFly 3 px]
  9. Never explode, use 3D, place multiple pies side by side for comparison, or animate slices in a way that implies change. [Kosara; EUI; From Data to Viz; Tufte; ONS]
- **Fallbacks [our call]:**
  - Comparing parts: sorted horizontal bar on a % axis titled "share of total revenue". [Few; From Data to Viz]
  - Same mix across properties or periods: 100% stacked bars, one per property or period, with the highlighted part on the shared baseline. [Datawrapper; ONS; EUI; Data Viz Catalogue]
  - Share over time: a line of shares. [Few]
  - Many or hierarchical parts: a treemap. Avoid near-square tiles where precise comparison matters, since squares were worst in Heer & Bostock. [Power BI; From Data to Viz; Heer & Bostock]
  - Discrete counts such as rooms out of order: a waffle grid. [From Data to Viz lists waffle; our call on the use]
  - A single share against a goal ("occupancy 78%"): KPI number plus linear progress bar or bullet graph, not a one-value donut ring. [Few bullet spec; our call]
- Thresholds conflict: Flourish allows 5–7 slices and suggests grids of pies for comparisons, while Datawrapper, ONS, EUI, SWD and Tufte discourage comparing across pies. For an AI that picks charts automatically, the stricter consensus (at most 5, no multi-pie comparison) is safer. [our call]
- Ordering conflict: EUI's "largest slice clockwise, rest counterclockwise in descending order" differs from Salesforce, ONS and Spectrum's "descending clockwise from 12 o'clock". Pick the majority rule. [our call]

### Gaps
- I read Skau & Kosara 2016 only at abstract level plus the author's blog. The PDF returned 403, so effect sizes are missing. I read Kosara 2019 at abstract level only.
- I found no peer-reviewed study comparing a donut-with-centre-total against a KPI number plus bar for executive dashboards.
- I could not retrieve Shopify Polaris Viz donut guidance (the page redirects; see Q6), Tableau's own page (403), or Spectrum's page (404).
- Waffle charts have no fetched guidance beyond their listing in From Data to Viz.

## 3. Which chart types belong in a business analytics catalogue, and which to avoid?

### Takeaway
Mainstream BI tools and design systems converge on this set:
- KPI cards
- line, area and column/bar, including stacked, 100% stacked and grouped
- combo
- waterfall and funnel
- scatter and bubble
- treemap
- heatmap
- tables and matrices with conditional formatting and data bars
- small multiples
- bullet graphs or linear meters
- Sankey for flows

Avoid 3D, exploded or multi-pie comparisons, radar charts (except perhaps a single profile on a shared scale), radial gauges (use bullets), and dual axes with different units. Each of these trades accuracy for decoration or invites false readings.

### Cited Findings
- **Power BI's built-in catalogue:**
  - Bar/column ("Use column charts for time-based comparisons and bar charts when category names are long").
  - Line, area, combo ("can have one or two Y axes"), ribbon (rank over time), waterfall ("running total as values are added or subtracted"), pie/donut, treemap, funnel ("sequential processes with stages"), scatter, bubble and dot plot.
  - Tables ("ideal when you need to see exact values") and matrices.
  - Cards ("when a single number... is the most important thing to track"), KPI visuals ("progress toward a measurable goal") and radial gauges ("great for showing the health of a single measure").
  - Small multiples ("trellis or lattice charts"), and conditional formatting including data bars in tables.
  - The Q&A natural-language visual "is scheduled for deprecation in December 2026."
  - Source: [Microsoft Learn: Power BI visualizations overview](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualizations-overview)
- **Salesforce Lightning** groups charts by purpose: comparison (bar, column, dot plot), trend (line), relationship (scatter), composition (pie, treemap), distribution (heatmap, matrix), metric (flat gauge, polar gauge, ratings), location (maps), and pipeline (funnel, waterfall, origami, Sankey). — [SLDS (Spring '20) Charts](https://spring-20.lightningdesignsystem.com/guidelines/data-visualization/charts/)
- **IBM Carbon Charts** offers area (simple and stacked), bar (simple, floating, grouped, stacked), boxplot, bubble, bullet, combo, donut, gauge, histogram, line, lollipop, meter (and proportional meter), pie, radar, scatter, sparkline, step, treemap, word cloud, alluvial, network, tree, circle pack and maps. — [Carbon: Chart types](https://carbondesignsystem.com/data-visualization/chart-types/)
- **Cloudscape** series limits: line 1–8 series, bar 1–8, mixed (bar + line) 1–4, pie/donut 1–5 data points. — [Cloudscape: Data visualization](https://cloudscape.design/patterns/general/data-vis/)
- **Bullet graph** (Few):
  - "The bullet graph was developed to replace the meters and gauges that are often used on dashboards. Its linear and no-frills design provides a rich display of data in a small space."
  - Its linear design "supports more efficient reading than radial meters."
  - Components: a text label; a quantitative scale on one linear axis; the featured measure; "One or two comparative measures (optional)", such as a target or the same measure a year ago; and "From two to five ranges" for qualitative state.
  - The scale "Begins at zero" (or below, for negatives). If the scale must start above zero, encode the featured measure as a dot or X rather than a bar.
  - Tick marks are light gray with a thin stroke.
  - Source: [Few, Bullet Graph Design Specification (rev. Oct 10, 2013)](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)
- **Radar charts** (From Data to Viz):
  - "quantitative values are much easier to compare when they are laid out along a single vertical or horizontal axis."
  - The shape "highly depends on the ordering of categories around the plot."
  - Area grows quadratically, which exaggerates differences. Multiple series overplot.
  - Alternatives: a ranked barplot or lollipop; a lollipop connecting two series; faceted small multiples; parallel coordinates for many series or mixed scales.
  - Source: [From Data to Viz: spider chart caveat](https://www.data-to-viz.com/caveat/spider.html)
  - Counterpoint: the FT lists radar under Magnitude. — [FT Visual Vocabulary](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)
- **3D charts** (From Data to Viz): in 3D bars, back bars look smaller and are hidden. "Nothing is worse than a pie chart in dataviz, except a 3D pie chart." The only exceptions are surface plots of true altitude-like values and interactive 3D scatterplots. — [From Data to Viz: 3D caveat](https://www.data-to-viz.com/caveat/3d.html)
- **Dual axes:**
  - Datawrapper: "The scales of dual axis charts are arbitrary and can therefore (deliberately) mislead readers." It cites Isenberg et al. 2011: "the superimposed chart performed poorly both in terms of accuracy and time." Alternatives: side-by-side charts, an indexed chart, labelling a prioritised series, or a connected scatterplot. A July 2026 edit notes Datawrapper now offers dual-axis charts on its Business plan. — [Datawrapper: Why not to use two axes (2018, edited 2026)](https://www.datawrapper.de/blog/dualaxis)
  - GOV.UK: "In general, we do not recommend using dual axis charts." — [Analysis Function](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)
  - Chartability flags more than one Y or X axis as inappropriate complexity. — [Chartability POUR-CAF](https://chartability.github.io/POUR-CAF/)
- **Line limits:**
  - GOV.UK caps lines at four ("More than four... often results in the chart becoming too cluttered") and says not to join points across missing data. — [Analysis Function](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)
  - Salesforce: "use a line chart to represent data with four or fewer related values." — [SLDS](https://spring-20.lightningdesignsystem.com/guidelines/data-visualization/charts/)
  - Carbon: "Never interpolate between periods when data is unavailable"; label the start and end of gaps. — [Carbon: Axes and labels](https://carbondesignsystem.com/data-visualization/axes-and-labels/)
- **Stacked areas:** only the bottom series has a flat baseline, so the inner series' changes are hard to judge. — [Few 2007](https://www.perceptualedge.com/articles/visual_business_intelligence/save_the_pies_for_dessert.pdf)
- **Treemaps:** rectangular-area judgments are as accurate as circular-area ones, but square tiles are judged worst. — [Heer & Bostock 2010](http://vis.stanford.edu/files/2010-MTurk-CHI.pdf)
- **Sparklines** should carry context: Tufte's examples mark first and last values and highs and lows in an accent colour. "every sparktweet should be accompanied by the beginning and the ending number." A grey "normal range" band shows elevated versus reduced readings. — [Tufte: Sparkline theory and practice](https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/)

### Inferences
- **Compass catalogue [our call].** Tier 1 is what the AI may choose automatically, Tier 2 needs a matching question, Tier 3 needs an explicit request, and "Avoid" is never generated.

| Tier | Chart | Use when | Don't use when / rule |
|---|---|---|---|
| 1 | KPI tile (value, delta vs named basis, sparkline, optional target) | Headline metrics | Delta needs a basis ("vs LY", "vs budget"). Rates change in pp. Sparkline is about 24–40 px and shows shape only; put exact values in the tooltip [our call] |
| 1 | Line (incl. dashed comparison line) | Trends; up to 4 emphasised series, the rest grey | More than 4 emphasised series: small multiples. Never bridge gaps |
| 1 | Bar/column (sorted), grouped (2–3 series) | Comparing and ranking categories | Zero baseline. Horizontal when labels are long or there are more than ~7 categories [our call] |
| 1 | 100% stacked bar / single share bar | Mix across properties or periods; one share | 5 segments or fewer; highlighted segment on the baseline |
| 1 | Table with in-cell bars, sparklines, deltas | Exact values across many entities | Right-align numbers, use tabular figures [our call] |
| 1 | Small multiples | One metric across many properties | Shared scales; sort panels meaningfully |
| 1 | Scatter / quadrant | Two measures across properties | Label notable points; name the reference lines |
| 2 | Bullet graph / linear meter | Actual vs target or LY with bands | 2–5 bands; zero-based scale |
| 2 | Waterfall | Bridge from budget to actual, or LY to TY | Ordered drivers; total bars anchored at zero |
| 2 | Funnel | Sequential conversion stages | Stages must be sequential |
| 2 | Heatmap / calendar heatmap | Day-of-week × period, or date grids | Sequential palette with a wide lightness range |
| 2 | Slope / dumbbell | Change between two dates per item | Two time points only |
| 2 | Histogram / box plot | Lead time, length of stay, rate distribution | Explain box plots to non-analysts in the subtitle [our call] |
| 2 | Donut (gated, Q2) | One share-of-whole at one time | See the Q2 gate |
| 2 | Treemap | Many hierarchical parts, such as revenue by property then department | Not for precise comparison |
| 3 | Sankey | Multi-path flows (channel to segment to room type) | Keep to about 3 stages and 15 nodes or fewer [our call] |
| 3 | Choropleth / symbol map | Source markets when geography matters | Rates on choropleths, counts on symbols |
| 3 | Pie (classic) | Only on request, within the gate | Prefer the donut variant |
| Avoid | 3D, exploded pies, multi-pie comparisons, radar, radial gauges/speedometers, dual axes with different units, very thin donuts, rainbow palettes | — | Substitute: bar, 100% stacked bar, small multiples, bullet, two aligned charts or an indexed chart |

- **Resolving the gauge conflict [our call]:** Power BI promotes radial gauges, but the bullet spec, Few's perception argument, and the space constraints of a phone all favour linear bullets or meters. Carbon also ships linear "meter" components.
- **Dual axes [our call]:** in practice, premium apps still use them; Causal's "ARR + Growth" combo has a growth-rate line on a right axis (see Q4). For an AI-generated chart, allow a combo only when both measures share a unit. Otherwise render two vertically stacked charts with aligned x-axes, or index both series to 100.

### Gaps
- I found no fetched source that sets a numeric limit on Sankey nodes or funnel stages. The numbers above are my own.
- Material and Fluent catalogues were not retrievable (see Q6).
- No source tested the readability of KPI-tile sparklines at specific pixel sizes. Heer & Bostock's 80 px finding applies to reading values, not to spotting a shape.

## 4. Visual rules that make charts premium and readable

### Takeaway
Premium charts in the sources and in top fintech apps look alike:
- a statement title and a quiet subtitle that defines the metric and period;
- one accent hue for the data that matters, with greys for context;
- the previous period as a lighter or dashed series, and targets as labelled dashed reference lines;
- direct labels instead of legends;
- few, light horizontal gridlines, and zero baselines for bars;
- compact, unit-bearing numbers with no false precision, distinguishing % from percentage points;
- a separately tuned dark palette that keeps contrast constant rather than inverting;
- text no smaller than 12 px.

### Cited Findings

#### Titles, labels, legends and annotation
- Put the main statement first and the precise data explanation later, for example in the title. Move definitions to "a less prominent text element, like the description or notes." — [Datawrapper: Text in data visualizations (Muth, 2022)](https://www.datawrapper.de/blog/text-in-data-visualizations)
- Label directly and drop the colour key where possible. Annotate outliers, the series you want readers to notice, and any context that explains values. Hide the least important annotations on small screens, or move them below the chart. — [Datawrapper 2022](https://www.datawrapper.de/blog/text-in-data-visualizations)
- GOV.UK:
  - Avoid "using legends unless necessary". Label lines directly, at the right-hand end if needed.
  - Use black or dark-grey label text.
  - "Always use horizontal text"; if labels do not fit, transpose the chart or change units.
  - Right-align numeric y-axis values and use commas for thousands.
  - Source: [Analysis Function: charts](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)
- Avoid rotated axis labels; switch from columns to horizontal bars instead. Left-align text. Give text that sits over gridlines an outline in the background colour. Use two clearly different levels of hierarchy, such as 12 px gray and 14 px black. — [Datawrapper 2022](https://www.datawrapper.de/blog/text-in-data-visualizations)

#### Colour budget
- "Gray is the most important color in data visualization." Use it for less important, missing and context data. Use several greys for non-data elements: "Grids need a lighter gray than axis labels", and titles get the darkest. — [Datawrapper: Colors in data vis style guides (Muth, 2022)](https://www.datawrapper.de/blog/colors-for-data-vis-style-guides)
- Style guides should "Choose 3-10 different colors." "Providing 12 colors lets people create visualizations with 12 categories — something you might not want to encourage." Pew: "The best approach is to use shades of a single hue in most charts." Vary lightness so colours survive greyscale, and check them with a colour-blindness simulator. — [Datawrapper 2022](https://www.datawrapper.de/blog/colors-for-data-vis-style-guides)
- Red/green for positive/negative must be tested for colour-blind readers; many organisations use blue for positive and red for negative. Colour blindness affects about 8% of men and 0.5% of women. — [Datawrapper 2022](https://www.datawrapper.de/blog/colors-for-data-vis-style-guides)
- Atlassian: limit charts to 5–6 colours by grouping extra categories. Use `color.chart.brand` for single-colour charts and the 8 categorical tokens in numbered order. Reserve danger tokens for negative or critical meaning. Via search snippet of atlassian.design. — [Atlassian: Data visualization color](https://atlassian.design/foundations/color/data-visualization-color)
- Salesforce cites short-term memory limits to make five the maximum number of colours. Use one colour for all values of the same measure and avoid decorative colour. Red-for-bad and green-for-good metaphors must account for culture. — [SLDS (Spring '20)](https://spring-20.lightningdesignsystem.com/guidelines/data-visualization/charts/)
- Carbon's alert palette (Red 60, Orange 40, Yellow 30, Green 60) is reserved for status. Gradients are only for highlighting extremes. — [Carbon: Color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)

#### Comparison lines and scenario notation
- IBCS (now the basis of ISO 24896, "Notation for business reporting") encodes scenarios by fill:
  - Actuals (AC): solid dark fill.
  - Previous year (PY): a lighter solid fill such as light grey.
  - Plan and budget (PL, BU): outlined or framed.
  - Forecast (FC): hatched in the colour of the measure.
  - An IBCS working paper notes that the light fill for previous periods is not applied consistently in IBCS sample pictures.
  - Sources: via search snippets of [IBCS v1.1 excerpt (PDF)](https://www.ibcs.com/wp-content/uploads/2021/02/IBCSv1-1_p125-131.pdf), [IBCS v2 (2026-07-02, PDF)](https://www.ibcs.com/wp-content/uploads/2026/07/IBCS_v2_final_2026-07-02_jf-with-ad.pdf) and [SAP: IBCS](https://www.sap.com/design-system/sac-dashboard-design-best-practices/ibcs)
- The bullet graph's comparative marker can be a target or "the same measure at some point in the past, such as a year ago." — [Few bullet spec](https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf)

#### Axes, baselines and gridlines
- Zero baselines for bars:
  - GOV.UK: "Do not break the numerical axis on bar charts." Use a Cleveland dot plot if the range is narrow. — [GOV.UK](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)
  - Salesforce: "Don't set the baseline to any number other than zero." — [SLDS](https://spring-20.lightningdesignsystem.com/guidelines/data-visualization/charts/)
  - Carbon: "Always start numerical axes at zero for part-to-whole and comparisons charts, such as bar and area chart." Line and scatter charts may start elsewhere because they are "intended to communicate trends". — [Carbon: Axes and labels](https://carbondesignsystem.com/data-visualization/axes-and-labels/)
  - Cloudscape: "if the Y axis of a line or bar chart does not start at 0, changes are exaggerated." — [Cloudscape](https://cloudscape.design/patterns/general/data-vis/)
- Conflict: Salesforce says to start both scatter axes at zero, while Carbon allows non-zero scatter axes. — [SLDS](https://spring-20.lightningdesignsystem.com/guidelines/data-visualization/charts/); [Carbon](https://carbondesignsystem.com/data-visualization/axes-and-labels/)
- Gridlines:
  - Use "generally... a maximum of ten", light grey, never thick or dark. The y-axis line is optional except at breaks. The gap between bars should be narrower than a bar. — [GOV.UK](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)
  - Gridline alpha of about 0.2 is a safe default, gridlines should be at least 8 px apart, and accuracy plateaus at a chart height of about 80 px (0–100 scale). — [Heer & Bostock 2010](http://vis.stanford.edu/files/2010-MTurk-CHI.pdf)
- Time axes:
  - "Never change axis ticks increments to accommodate data availability."
  - Use localised date and time formats.
  - Semibold the label when the data crosses into a new day, month or year.
  - Axis-break markers are 16 px.
  - Source: [Carbon: Axes and labels](https://carbondesignsystem.com/data-visualization/axes-and-labels/)

#### Number formatting
- "Don't add unnecessary precision when showing numbers." Abbreviate (12,831 becomes 12.8k). Avoid "in millions" multipliers in the description. Put units in axis labels, tooltips and annotations. Use a `0.[0]%`-style format so 27.0% shows as 27% but 22.4% keeps its decimal. Tooltips should include the category ("3.4% unemployed", not "3.4%"). — [Datawrapper 2022](https://www.datawrapper.de/blog/text-in-data-visualizations)
- A percentage point is the difference between two percentages: 10% falling by 1 percentage point gives 9%. Pluralise "points" except for exactly one. Via search snippet. — [ONS Service Manual: Percentages](https://service-manual.ons.gov.uk/content/numbers/percentages)
- Put the % symbol directly in axis labels. Via search snippet. — [ONS: Chart text](https://service-manual.ons.gov.uk/data-visualisation/guidance/chart-text)

#### Dark mode
- Datawrapper's automatic dark mode uses "an algorithm that is based on color contrast", so "the color contrast of each element against the background is always the same". Very dark colours on white become very bright on black. Text, gridlines, colour keys, highlight ranges, heatmaps and annotations are all adjusted, and custom themes can set their own dark palette colours. — [Datawrapper: Dark mode (Jan 26, 2022)](https://www.datawrapper.de/blog/dark-mode-for-embedded-visualizations)
- "Most very saturated, dark colors like blue and green don't have equally saturated equivalents if they're very bright."
  - Option 1: a separate dark palette ("clothe the same data in colors that can be highly saturated while being bright").
  - Option 2: one palette built from hues such as green and pink "that look fairly saturated when either dark or bright".
  - Tune lightness in LCh. Axis ticks are light grey on light backgrounds and dark grey on dark ones.
  - Source: [Datawrapper 2022 (dark mode section)](https://www.datawrapper.de/blog/colors-for-data-vis-style-guides)
- Carbon sequential palettes: on light themes "the darkest color denotes the largest values"; on dark themes "the lightest color denotes the largest values". Diverging palettes are the same in both themes. — [Carbon: Color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)

#### Small screens and minimum sizes
- No text smaller than 9pt/12px; geometries and large text above 3:1 contrast; regular text above 4.5:1. — [Chartability POUR-CAF](https://chartability.github.io/POUR-CAF/)
- Default web text: "sans-serif, regular, sentence case... >12px, (almost) black". Instead of shrinking text, hide it in tooltips, enlarge the chart or shorten the sentence. — [Datawrapper 2022](https://www.datawrapper.de/blog/text-in-data-visualizations)
- Mobile placement:
  - The colour key moves to the top on mobile. — [Datawrapper 2022](https://www.datawrapper.de/blog/text-in-data-visualizations)
  - Use a pie legend only when space is limited, as on mobile. — [ONS](https://service-manual.ons.gov.uk/data-visualisation/chart-types/pie-and-doughnut-charts)
- GOV.UK gives no minimum font size and leaves it to judgment. It recommends SVG so charts zoom without losing quality. — [GOV.UK](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)
- Interactive targets need at least 24 × 24 CSS px under WCAG 2.2 SC 2.5.8 (AA), with spacing and equivalent-control exceptions. — [W3C Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

#### Patterns in premium finance and analytics apps (Mobbin; my observations of the screenshots)
- **Midday (web):** the revenue card has a big number ($234) over the chart. The legend reads "Current / Previous / --- Average": current bars are solid black, the previous period is light grey, and the average is a dashed horizontal line. Gridlines are faint and dotted. — [Mobbin: Midday](https://mobbin.com/screens/d268f563-9b67-4a56-969a-3f650c6f958f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Xero (web), JAX AI assistant:** a generated chart ("Monthly Trend: Revenue...") comes with:
  - a "Calculation used" sentence above it;
  - a value tooltip;
  - a "Show table" toggle under the chart;
  - an "Explore more visualizations" button;
  - a provenance line ("Figures are calculated using account types");
  - a disclaimer ("JAX can make mistakes...").
  - This is directly analogous to the Compass assistant. — [Mobbin: Xero](https://mobbin.com/screens/03585ce9-541c-4c11-9f37-421785ef2a11?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Causal (web):** "ARR + Growth" puts direct value labels above every bar ($75k to $3.2m) and a pink growth-rate line on a secondary right axis (0–150%). This is a dual-axis combo in a premium product, which runs against GOV.UK and Datawrapper guidance. — [Mobbin: Causal](https://mobbin.com/screens/d69bf44f-08a5-4cb1-b17a-1047f90a077a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Mercury (web), Books overview:** three columns (Cash, Expenses, Revenue), each with KPI rows (net cash flow, runway, monthly burn; net margin, expense ratio) above small trend charts. In the empty or setup state the charts keep their structure as dotted placeholders and grey bars instead of disappearing. — [Mobbin: Mercury](https://mobbin.com/screens/f7740c28-3995-422a-bc34-d10f4bc8c483?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **QuickBooks (web):**
  - The P&L card shows "Net profit for FY26" with "↑ Up 100% from FY 25", the comparison basis named.
  - Income and expense bars use hatched segments for items "to review".
  - The Expenses donut has a legend with deltas.
  - Accounts receivable is shown as a donut of ordinal aging buckets (Current, 1–30 ... 91+), a case where a bar would preserve the order better [our call].
  - Source: [Mobbin: QuickBooks](https://mobbin.com/screens/a1576a19-53f6-498d-80a7-02ece64072d8?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Whop (web):** a grid of stat cards, each with a metric name, value, a delta pill (+$1.40) and a mini line chart. A global control row sets the period, "compared to" range, granularity and filter. — [Mobbin: Whop](https://mobbin.com/screens/0bb8b25f-0c3d-47c3-b20a-1447e7dbab9e?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **HoneyBook (web):** a chart footer says "Last updated 43 minutes ago", a data-freshness cue. — [Mobbin: HoneyBook](https://mobbin.com/screens/968fc556-332d-454a-b3c4-0f1dba4941e2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Revolut Business (web, dark):** the cards show "Net cashflow S$10.00 ▲100% This month". Remaining days of the month are drawn as a dashed line. A single teal accent sits on a navy surface, with right-side axis labels that include the currency and subtle gridlines. — [Mobbin: Revolut Business](https://mobbin.com/screens/642f8ac1-17b9-4735-a453-4efa31969116?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Origin (iOS):** "Spend this month: $760" with a "Compare with: April" picker. The current month is a solid indigo cumulative line with an area tint and an end-point dot. April is a dashed grey line. A dashed "$3,000 Budget" reference line has its own label. — [Mobbin: Origin](https://mobbin.com/screens/d9ac8ded-f15f-474d-ac19-62f1b603a66f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Copilot (iOS):** monthly spending bars are green under budget, and the one over-budget month is red. A horizontal budget line carries a value tag ($2,927) and the header reads "$690 under". Below, per-category "Spent / Budget / Over" metric tables. — [Mobbin: Copilot](https://mobbin.com/screens/c234ccb2-d1cb-4582-9df5-87c3a4a3d697?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **CRED (iOS, dark):** "↓ ₹5,196.84 from last month" in green, because a spending decrease is good. Twelve-month bars are muted grey with the current month in white. The axis is abbreviated (14K / 0K). — [Mobbin: CRED](https://mobbin.com/screens/7f33e880-f2cb-450b-a1bd-90def15a9e64?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **N26 (iOS):** the current month's bar is dark teal and the previous month is light. Monthly budget is a ring meter ("€3.10 left, 7 days to go"). — [Mobbin: N26](https://mobbin.com/screens/9551a340-6ac1-477d-ad92-826b63c22fc5?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Quicken (iOS):** a monthly spending bar chart sits directly above a month-by-month value table, pairing the chart with the table. — [Mobbin: Quicken](https://mobbin.com/screens/f74af978-aeef-4149-b481-37809806fb66?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)
- **Splitwise (iOS):** October vs November bars in two blues with large legend-coloured numbers ("Total spent $485.00", "Your share $275.00, 56% of total group spending"). The share is stated as text, not as a pie. — [Mobbin: Splitwise](https://mobbin.com/screens/f77b2738-8716-4219-932f-3e9080cbbd2c?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp)

### Inferences
**Compass chart style spec v0 [our call], derived from the findings above.**

Anatomy:
- Title as a statement, about 14–16 px semibold ("RevPAR up 6% vs last year").
- Subtitle at 12–13 px muted, giving the metric definition, period, comparison basis and filters ("Daily RevPAR, EUR, 1–30 Nov 2026 vs same days 2025 · All 12 properties").
- Footer at 12 px muted with source, last-updated time and, for AI charts, a "how this was calculated" link plus a "Show table" toggle. [Datawrapper; Xero; HoneyBook]

Colour budget:
- One accent hue for the focal series or category.
- Neutral greys for context, comparison and other series.
- At most 5–6 distinct categorical hues per chart. Beyond that, group into "Other" or use small multiples. [Datawrapper; Atlassian; Salesforce]
- Status colours (red, amber, green) only for status, always paired with a sign, arrow or label.
- Use blue/orange or blue/red rather than red/green for good/bad diverging scales. [Datawrapper; Carbon]

Comparison semantics, used consistently everywhere [IBCS-inspired; Midday; Origin; Revolut]:

| Scenario | Encoding |
|---|---|
| Current period | Solid accent |
| Previous period / LY | Grey solid (bars) or grey dashed (lines) |
| Budget / target | Dashed reference line with a value tag, or outlined bar |
| Forecast / pickup-on-the-books | Hatched bars or dotted line |
| Portfolio average | Thin dashed neutral line with an inline label |

Axes and gridlines:
- Horizontal gridlines only, 3–6 of them [our call within GOV.UK's maximum of 10], at about 20% opacity, at least 8 px apart.
- No vertical gridlines except optional month boundaries.
- Hide the axis line on value axes and keep the baseline. Bars and areas start at 0. Lines may start elsewhere, but the range should be "nice" and labelled.
- Never break a bar axis or bridge data gaps. Don't rotate labels; switch to horizontal bars instead.

Numbers:
- Use locale-aware formatting through the user's locale (for example ro-RO "1.234,5" vs en-GB "1,234.5"), compact notation for axis ticks (12,8 mii / 12.8k), and full precision in tooltips and tables. [Carbon localisation; Datawrapper]
- Show ADR and RevPAR in currency with zero decimals on axes and two in tooltips.
- Show occupancy in % with one decimal at most. Express changes in a rate as "pp" (percentage points), for example "Occupancy +3.1 pp", while relative changes in money use "%" ("ADR +4.2%"). [ONS]
- Always state the delta basis ("vs LY", "vs budget", "vs prior 28 days").

KPI tile:
- Label at 12–13 px, value at 24–32 px with tabular figures, and a delta chip with arrow, sign and colour plus the basis text.
- A sparkline of about 24–40 px with end-point dots, optionally with a grey normal band. [Tufte; Whop; QuickBooks; CRED]

Dark mode:
- Don't invert. Ship a dark palette whose marks keep the same contrast against the dark surface as the light palette has against white.
- Brighten saturated blues and greens, and flip the direction of sequential ramps (light = high).
- Re-tune the greys for gridlines and text. Check marks against 3:1 and text against 4.5:1. [Datawrapper; Carbon; WCAG]

Phone:
- No text under 12 px.
- Plot areas of at least about 120–160 px tall for value-reading charts [our call above Heer & Bostock's 80 px floor, to leave room for labels and touch].
- Tap and focus targets of 24 px or more for points and bars, using invisible hit areas.
- Move the legend or key above the chart and hide secondary annotations.
- Swap columns for horizontal bars when there are more than about 6 categories.
- Use one chart per card, and small multiples stacked vertically.

### Gaps
- I found no primary source on "premium" aesthetics as such (radius, shadow, card density). The Mobbin observations are qualitative. Mobbin did not return Stripe, Linear or Robinhood screens for these queries.
- I could not retrieve Apple HIG "Charting data" (the page is JavaScript-rendered), so I have no Apple minimum sizes or Audio Graphs guidance.
- I could not access a primary IBCS page directly; the notation details come via search snippets of IBCS PDFs and SAP's design guide.
- I found no source specifying compact-number conventions for Romanian ("mii", "mil.") in charts. Library defaults (Intl.NumberFormat compact) were not verified in this session.

## 5. Accessibility for charts

### Takeaway
To be accessible a chart needs:
- 3:1 contrast for every mark needed to understand it, including slice and segment edges and lines against the background (WCAG 1.4.11);
- a non-colour cue such as direct labels, line styles, markers or patterns (WCAG 1.4.1);
- a visible text summary plus a data table;
- text of at least 12 px;
- keyboard focus that mirrors hover;
- a screen-reader structure.

Chartability's critical heuristics make a good test checklist. Highcharts and ECharts provide much of this out of the box: a keyboard and screen-reader module and auto-descriptions, and decal patterns, respectively.

### Cited Findings
- **WCAG 2.2 SC 1.4.11 Non-text Contrast:**
  - Graphical objects "required to understand the content" need "a contrast ratio of at least 3:1 against adjacent color(s)". Thresholds are not rounded ("2.999:1 would not meet").
  - Each line in a graph counts. Lines "should have 3:1 contrast against their background" but need not contrast with each other where they overlap little.
  - Gridlines count when readers need them to read values.
  - Pie slices fail below 3:1 between adjacent slices. A darker border fixes this, as do conforming text values, which make the slices non-essential.
  - Exemptions: text labels and values (which must meet 1.4.3), aesthetic graphics, and information also available in another form, such as "a table that follows the graph".
  - Avoid "particularly thin lines and shapes" because anti-aliasing lightens them.
  - A pie with labels passes 1.4.1 Use of Color.
  - Source: [W3C Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **Chartability (POUR-CAF:** Perceivable, Operable, Understandable, Robust plus Compromising, Assistive, Flexible) has 14 critical heuristics:
  - "Low contrast"
  - "Content is only visual"
  - "Small text size"
  - "Visual presents seizure risk"
  - "Interaction modality only has one input type"
  - "No interaction cues or instructions"
  - "Controls override AT controls"
  - "No explanation for purpose or for how to read"
  - "No title, summary, or caption"
  - "Reading level inappropriate"
  - "No table"
  - "Data density is inappropriate"
  - "Navigation and interaction is tedious"
  - "User style change not respected"
  - Source: [Chartability POUR-CAF](https://chartability.github.io/POUR-CAF/)
- **Chartability tests and thresholds:**
  - Geometries and large text above 3:1; text above 4.5:1; text at least 9pt/12px.
  - Categorical colour needs textures, shapes, size or dash patterns as well.
  - Keyboard focus should mirror mouse hover and click.
  - A human-readable table is required unless the title, summary and annotations convey everything.
  - "Information complexity is inappropriate" flags more than one Y or X axis, more than 5 data categories, or a z-axis unless the data is spatial.
  - Uncertainty must be explained in text.
  - Source: [Chartability POUR-CAF](https://chartability.github.io/POUR-CAF/)
- **UK Analysis Function:**
  - Charts must meet WCAG 2.2 A/AA.
  - "we should not rely on colour as the only way to match labels to data."
  - Choose a data table when users need exact values, a text description when they need the overall takeaway, or both.
  - A description "should not repeat the chart title, be a literal description or outline every data point shown". Put it directly under the chart.
  - Use specific link text such as "Download the data for Figure 1".
  - Source: [Analysis Function: charts](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)
- **Highcharts accessibility module:**
  - Without it, a chart is "interpreted as an image with the chart title in the aria-label". With it, Highcharts adds a "text description of the chart, keyboard navigation, and support for ARIA roles and attributes on chart elements".
  - A visible `highcharts-description` element is linked automatically. Highcharts advises against relying only on hidden `accessibility.description`, because visible text also helps cognitive accessibility.
  - The export-data module provides a data-table view. Sonification ("Audio charts") and low-vision patterns/contrast features are listed.
  - "We recommend to always include the Accessibility module."
  - Source: [Highcharts: Accessibility module](https://www.highcharts.com/docs/accessibility/accessibility-module)
- **Apache ECharts `aria`:**
  - Off by default and must be imported (ECharts 5+). Once enabled, ECharts "will automatically generate a description of the chart according to the title, chart, data, etc." into `aria-label`, with templates.
  - "Apache ECharts 5 adds support for decal patterns as a secondary representation of color" (`aria.decal.show`, with custom `aria.decal.decals`).
  - The handbook mixes `aria.show` and `aria.enabled`; check the option reference.
  - Source: [ECharts handbook: Aria](https://echarts.apache.org/handbook/en/best-practices/aria/)
- **Cloudscape:** provide keyboard access to all content in a logical order, define ARIA labels in the app's language, avoid unnecessary roles and landmarks, and use an accessible palette. Its charts are built on Highcharts. — [Cloudscape: Data visualization](https://cloudscape.design/patterns/general/data-vis/); [Cloudscape: Pie chart](https://cloudscape.design/components/pie-chart/)
- **Atlassian:** "Don't rely on color alone"; add patterns, labels or shapes. Where display order can't be controlled (line charts), provide additional visual indicators. Via search snippet. — [Atlassian: Data visualization color](https://atlassian.design/foundations/color/data-visualization-color)
- **Salesforce:** pair colour with symbols or text, and prefer the "Color Safe" theme, which "passes WCAG 2.0 guidelines for contrast accessibility". — [SLDS (Spring '20)](https://spring-20.lightningdesignsystem.com/guidelines/data-visualization/charts/)
- **Datawrapper:** most published palettes do not meet 3:1 against white, and WCAG was not designed for data visualisation. White outlines between elements are a common workaround. — [Datawrapper 2022](https://www.datawrapper.de/blog/colors-for-data-vis-style-guides)
- **GOV.UK:** pies "are hard to understand when magnified". — [Analysis Function](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/)

### Inferences
**Compass accessibility contract for every chart, including AI-generated ones [our call]:**
1. A visible statement title and subtitle, plus a 1–3 sentence auto-generated text summary of the takeaway (not a literal readout). This is also the accessible name. [GOV.UK; Highcharts; ECharts aria]
2. A "Show table" toggle rendering an HTML `<table>` with caption and units, plus CSV download. [GOV.UK; Chartability "No table"; Xero JAX pattern]
3. Marks at least 3:1 against the surface in both themes. Adjacent segments in stacked bars and donuts get 1–2 px separators in the surface colour. Lines at least 2 px. [WCAG 1.4.11]
4. A non-colour cue for every categorical distinction: direct labels first, then line dash and marker shape. An optional "patterns" toggle uses ECharts decals or Highcharts pattern fills. IBCS hatching for forecasts doubles as a pattern. [WCAG 1.4.1; Chartability; ECharts; Atlassian]
5. Keyboard: the chart is one tab stop; arrow keys move between points and series; focus shows the same tooltip as hover; Esc exits; on-screen instructions are available. [Chartability; Highcharts]
6. Respect user settings: `prefers-reduced-motion` (no animated draw-in), `prefers-contrast` and forced-colours mode (fall back to outlines and patterns), and browser zoom and reflow to 200%. [Chartability "User style change not respected"; our call on the specific media queries]
7. Complexity budget: at most 5 categories by default and no dual axes. When the AI would exceed this, it should propose small multiples or a table. [Chartability]

### Gaps
- I did not test Highcharts' or ECharts' current Angular wrappers for how well they support these features.
- I fetched no source with specific screen-reader announcement patterns for sparklines inside tables.
- I found no data on how accessible AI-generated chart descriptions are, or how users perceive them.

## 6. What do design systems' data-viz guidelines say?

### Takeaway
Where design systems give thresholds, they are strikingly consistent:
- pie/donut 5 slices or fewer (6 for EUI, ONS and PatternFly), descending from 12 o'clock;
- zero baselines for bars;
- 4 lines or fewer (Salesforce, GOV.UK) or 8 or fewer series (Cloudscape);
- 5–6 colours or fewer per chart (Atlassian, Salesforce);
- direct labels;
- don't rely on colour alone.

Carbon contributes the most rigorous colour and axis rules, including dark-theme sequential ramps. Polaris, Material, Fluent and Apple HIG guidance could not be retrieved this session.

### Cited Findings
- **IBM Carbon:**
  - Chart catalogue as listed in Q3. — [Carbon: Chart types](https://carbondesignsystem.com/data-visualization/chart-types/)
  - Axis rules: zero for bar and area charts; non-zero allowed for line and scatter; never interpolate gaps; label gap start and end; never change tick increments; localised dates; semibold labels at new time cycles. — [Carbon: Axes and labels](https://carbondesignsystem.com/data-visualization/axes-and-labels/)
  - Colour:
    - A 14-colour categorical palette "applied in sequence strictly", ordered to "maximize contrast between neighboring colors". You may override it with a fixed palette when the number of categories is predictable.
    - Sequential palettes in four hues with ten steps each: darkest = largest on light themes, lightest = largest on dark themes.
    - Two diverging palettes, the same in both themes. Alert palette: Red 60, Orange 40, Yellow 30, Green 60.
    - Gradients only for extremes; "Never use a gradient in place of a sequential palette."
    - Source: [Carbon: Color palettes](https://carbondesignsystem.com/data-visualization/color-palettes/)
- **Atlassian** (via search snippet): chart colour tokens (`color.chart.brand` for single-colour charts, 8 ordered categorical tokens, status tokens such as `color.chart.danger`), 5–6 colours maximum by grouping, "Don't rely on color alone", and a generic token set for user-chosen colours. — [Atlassian: Data visualization color](https://atlassian.design/foundations/color/data-visualization-color)
- **Shopify Polaris / Polaris Viz:**
  - `polaris.shopify.com/design/data-visualizations` now returns 301 to `shopify.dev/docs/api/polaris` (observed 2026-11-20), so the former data-viz guidelines could not be read. — [Polaris data visualizations (redirects)](https://polaris.shopify.com/design/data-visualizations)
  - A search snippet says Polaris Viz's licence restricts its use to apps that integrate with Shopify.
  - An unverified community comment mentions Polaris Viz being deprecated. — [Shopify community thread](https://community.shopify.dev/t/dashboard-analytics/16078)
- **Microsoft Power BI / Fluent:** Power BI guidance as in Q2 and Q3, including reference lines, forecasting and anomaly detection in the Analytics pane, and conditional formatting (data bars, icons, colour scales). — [Microsoft Learn: Power BI visualizations overview](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualizations-overview). I found no Fluent 2 charting guidance this session.
- **Material Design:** the M2 data-visualization page (`m2.material.io/design/communication/data-visualization.html`) is JavaScript-rendered, and the fetch returned only the title, so no rules could be extracted. — [Material: Data visualization](https://material.io/design/communication/data-visualization.html)
- **AWS Cloudscape:**
  - Line 1–8 series, bar 1–8, mixed 1–4; area for continuous time stacked as part-to-whole; pie/donut for a categorical snapshot with 1–5 data points and a single series, donut with a centre summary metric.
  - Warns that non-zero y-axes exaggerate change. Show the minimum metrics, use filters when there are many, and minimise the number of charts per view.
  - Size charts of equal importance consistently. Avoid directional language ("above/below").
  - Keyboard and ARIA requirements.
  - Source: [Cloudscape: Data visualization](https://cloudscape.design/patterns/general/data-vis/)
- **GOV.UK** (Government Analysis Function) and **ONS:** rules as cited in Q2, Q4 and Q5, including 5 pie categories or fewer, 4 lines or fewer, gridlines 10 or fewer, no dual axes, no broken bar axes, horizontal text only, direct labels, and text description and/or table. — [Analysis Function](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/); [ONS: Pie and doughnut charts](https://service-manual.ons.gov.uk/data-visualisation/chart-types/pie-and-doughnut-charts)
- **Salesforce Lightning** (archived Spring '20; the current SLDS 2 may differ):
  - Purpose families as in Q3; pie 2–5 values, descending clockwise from 12 o'clock.
  - Zero baseline; one colour per measure; line charts for 4 or fewer related values; scatter axes start at zero.
  - Palettes: Default (6 hues), Color Safe, Light, Dark and others. At most 5 colours. Use colour metaphors with cultural caution.
  - Source: [SLDS Spring '20 Charts](https://spring-20.lightningdesignsystem.com/guidelines/data-visualization/charts/)
- **Elastic EUI:** at most 6 slices; pies suit 25/50/75% values or one dominant category; no comparing slices, negatives or multiple pies; bar charts preferred; never explode slices; legend as a table with right-aligned values when labels don't fit. — [EUI: Part-to-whole comparisons](https://eui.elastic.co/docs/dataviz/types/part-to-whole-comparisons/)
- **Other systems found incidentally:**
  - Adobe Spectrum: donut 2–3 segments ideal, 5 or fewer, largest from 12 o'clock clockwise. Via search snippet; page 404. — [Spectrum: Donut chart](https://spectrum.adobe.com/page/donut-chart)
  - PatternFly: donut 6 categories or fewer, 3 px segment padding, legend with values. Via search snippet. — [PatternFly: Donut chart](https://www.patternfly.org/charts/donut-chart/design-guidelines)

### Inferences
- **Consensus thresholds to encode in the Compass chart linter and AI guardrails [our call]:**

| Rule | Value | Sources |
|---|---|---|
| Pie/donut slices | 2–5 (ideal 2–4); hard stop at 6 | Datawrapper, GOV.UK, Salesforce, Cloudscape, Spectrum (≤5); ONS, EUI, PatternFly (≤6); Flourish 5–7 (outlier) |
| Pie order | Largest first, from 12 o'clock, clockwise, descending; "Other" last | Salesforce, ONS, Spectrum (EUI variant differs) |
| Bar baseline | 0, never broken | GOV.UK, Salesforce, Carbon, Cloudscape |
| Line series | 4 or fewer emphasised (grey others); more than 8 means small multiples | GOV.UK, Salesforce, Cloudscape |
| Mixed / combo | 4 or fewer series, same unit preferred, no dual axis by default | Cloudscape, GOV.UK, Datawrapper, Chartability |
| Categorical colours per chart | 5–6 or fewer | Atlassian, Salesforce, Chartability (5 categories or fewer) |
| Gridlines | Light grey, 10 or fewer, at least 8 px apart | GOV.UK, Heer & Bostock |
| Text | 12 px or larger, horizontal only | Chartability, Datawrapper, GOV.UK |
| Contrast | Marks 3:1 or better, text 4.5:1 or better, in both themes | WCAG 1.4.11/1.4.3, Chartability |
| Gaps in data | Never interpolate; label gap boundaries | Carbon, GOV.UK |

- Carbon's strict ordered categorical palette and theme-aware sequential ramps are the best model for Compass tokens, with Atlassian's semantic chart tokens (brand, categorical.N, danger, neutral) as the naming model. Combine them as `--chart-accent`, `--chart-cat-1..6`, `--chart-context` (grey), `--chart-comparison` (PY), `--chart-target`, `--chart-positive/negative`, and `--chart-seq-1..9` per theme. [our call]

### Gaps
- Polaris Viz guidance: unavailable (the page redirects; the possible deprecation is unverified).
- Material data-viz rules: JavaScript-rendered page, not extracted.
- Fluent 2 charting guidance: not found this session.
- Carbon's per-chart usage pages (for example donut slice limits, gauge and meter guidance): not found on the fetched pages.
- Atlassian: read via search snippet only.
- Salesforce: only the archived 2020 version could be read, so current SLDS 2 rules are unknown.
- Apple HIG "Charting data": JavaScript-rendered, not extracted.
