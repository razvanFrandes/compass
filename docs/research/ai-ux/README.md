# AI UX research

These notes are the research behind the Compass preview. The rule is to use only established patterns, each one backed by a source.

- [pattern_canon.md](pattern_canon.md): named patterns from Shape of AI, Microsoft HAX, Google PAIR, Apple HIG, NN/g, AWS Cloudscape, IBM Carbon, GitLab and others.
- [mobbin_best_ai_apps.md](mobbin_best_ai_apps.md): 82 Mobbin screens from leading AI apps, with a count of how often each pattern recurs.
- [ai_analytics_products.md](ai_analytics_products.md): AI features in Tableau Pulse, Power BI, ThoughtSpot, Hex, Looker, Databricks Genie, Juyo, Lighthouse and others.
- [library/](library/): free official PDFs (Microsoft HAX guidelines, Google PAIR worksheets and workshop materials).

## Where each pattern appears in the preview

| Preview element | Pattern | Source |
|---|---|---|
| Starter prompts about the hotel's own data | Suggested prompts in the empty state | Shape of AI; seen in 12 apps on Mobbin |
| Live steps that collapse into "Worked for 3s · 3 steps" | Thinking collapsed by default in chat; progressive steps | AWS Cloudscape; seen in 10 apps on Mobbin |
| Stop button replacing Send while generating | Stop or interrupt | Shape of AI; seen in 9 apps on Mobbin |
| Skeleton phases inside the generated chart | Generative loading states | Cloudscape; the Unify example on Mobbin |
| Chart from the assistant that switches line/bar and can be pinned | AI charts are ordinary charts | Power BI, Looker, Hex, Lightdash |
| "How this was computed" panel with a verified query | Show the work: definitions, filters, query and who approved it | Power BI, Looker, Genie, Sigma, Snowflake, Lightdash |
| Source chips | Citations and sources | Shape of AI; NN/g |
| Approval card: before → after, named action button, Edit, Deny, receipt with Undo | User-authorized actions; intent preview | Cloudscape; Mercury, Navan and Codex on Mobbin |
| "Allow changes in this chat" switch, off by default | Scoped permission for write access | Cloudscape; Notion's "Can make changes" |
| Copy, thumbs up/down with reason chips, regenerate | Feedback controls | HAX G15; seen in 14 apps on Mobbin; Perplexity's reason chips |
| "Compass can be wrong" line under the composer | Set expectations (caveat) | HAX G2; seen in 14 apps on Mobbin |
| Quick / Thinker selector inside the composer | Mode picker in the composer | Seen in 12 apps on Mobbin; Juyo's Kassandra answer depths |
| Morning brief with timestamp, first item open, ranked by money | Digest with summary first and freshness stamp | Tableau Pulse; Perplexity Finance; Public |
| "AI" label on generated content | AI label | IBM Carbon for AI |
| Clicking a KPI's change opens its drivers | Driver decomposition | Tableau Pulse; Power BI; Juyo |
| Watchers with status chip, schedule, last run, autonomy, toggle, Run now | Agent management and status model | GitLab agents and flows; Cloudscape |
| Notification on finish only, never while running | Notification rules for agents | GitLab |
| "Create with chat" for a new watcher | Conversational agent creation | Unify on Mobbin |
| Phone: floating "Ask" button that opens a full-screen sheet | Mobile assistant entry and sheet | iOS patterns on Mobbin |
