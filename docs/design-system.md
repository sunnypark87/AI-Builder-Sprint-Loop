# Modugive Design System

## 1. Purpose and Brand Principles

Modugive helps organizations manage how donations are spent and helps donors follow that process with ease. Its goal is to create a virtuous cycle in which transparent information builds trustworthy organizations and leads to further giving.

The design follows four principles.

1. **Show evidence first.** Place expenditure records, sources, update dates, and evaluation criteria close to trust scores or summaries.
2. **Make each action clear.** Highlight only one primary action per screen in orange and reduce the visual hierarchy of other actions with neutral colors.
3. **Keep work screens dense, but not cramped.** Maintain productive density in lists and filters while revealing structure through spacing and dividers.
4. **Prioritize status and feedback over decoration.** Use color, icons, and badges only when they communicate information state.

### Avoiding an AI-Generated Template Look

- Do not use meaningless gradients, glows, glass effects, or clusters of floating oversized cards.
- Do not wrap every section in a rounded card. Express page structure through spacing, headings, dividers, and aligned table columns.
- Do not repeat CTAs of equal emphasis on one screen.
- Do not communicate meaning with icons alone; provide text labels or accessible names.
- Do not invent marketing copy unrelated to real work, arbitrary oversized numbers, or unsupported AI scores.
- Label sample data as `Sample data`, and show supporting evidence and the last updated time with trust information.
- Do not repeat the same `small accent label → large heading → description → card cluster` formula on every page. Marketing, work, document review, and completion screens should use hierarchies suited to their purpose.

## 2. Reference Analysis

### Modusign Public Home

- Uses generous white space and a large heading to make the first action clear.
- Concentrates the accent color on key actions such as starting a free trial, while secondary actions use white buttons and thin borders.
- Combines step-based feature explanations with actual product screens to aid understanding.
- Uses large desktop headings but simplifies type scale and navigation on mobile.

### Modusign Document Management

- Uses a productivity-oriented Pretendard type scale of 13–20px.
- Uses a three-region desktop layout: status navigation on the left, global navigation on top, and content on the right.
- Inputs and buttons are generally 36–42px high with 4–6px radii, and dividers and subtle surface colors are used more often than cards.
- Groups search, date range, labels, and sharing scope in one filter area close to the results table.
- Groups in-progress, completed, and pre-request states in the language of user tasks to reduce information-finding cost.

### Applying the References to Modugive

- Reference the structural principles and information density without copying Modusign's trademarks, logo, wording, or exact screen composition.
- Donor global navigation defaults to `Find organizations`, `My donations`, and `Notifications`. Organization management provides `Dashboard`, `Pledges`, `Donations`, `Expenditure plans`, `Expenditure records`, and `Reports` according to the work flow.
- Use secondary left navigation only on management screens with many statuses. Standard donor screens use a single-column or content-centered layout.
- Restrict Modugive orange to CTAs, the current selection, and key progress states.

## 3. Supporting References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): apply contrast targets of at least 4.5:1 for normal text and 3:1 for large text, along with keyboard and focus requirements.
- [GOV.UK Design System Layout](https://design-system.service.gov.uk/styles/layout/): design small screens as a single column first and constrain line length for long-form content.
- [GOV.UK Button](https://design-system.service.gov.uk/components/button/): use button elements suited to the action, clear contrast, and explicit disabled states.
- [Carbon Design System Typography](https://carbondesignsystem.com/elements/typography/overview/): build hierarchy with a limited set of type tokens and keep body text neutral.
- [Adham Dannaway, 14 UI design tips](https://www.adhamdannaway.com/blog/ui-design/ui-design-tips-14): apply proximity, a single primary action, limited alignment axes, adequate contrast and touch targets, and removal of unnecessary containers.
- [UI design principles for the AI era](https://hgko-dev.tistory.com/555): use as a supporting checklist for avoiding nested cards, decorative motion, and uniform SaaS template patterns.
- [Modusign home](https://modusign.co.kr/) and the authenticated document management screen: desktop and mobile structures and computed styles were analyzed with Playwright on 2026-07-30. Authentication sessions, personal information, and screenshots are not included in the repository.

## 4. Color

### Primitive Palette

| Token        | Value     | Purpose                                      |
| ------------ | --------- | -------------------------------------------- |
| `orange-50`  | `#fff4ee` | Subtle selected and notification backgrounds |
| `orange-100` | `#ffe4d6` | Accent-area borders                          |
| `orange-500` | `#fb4d00` | Brand and primary actions                    |
| `orange-600` | `#df4500` | Hover                                        |
| `orange-700` | `#c83d00` | Active; accents requiring white text         |
| `gray-0`     | `#ffffff` | Default surface                              |
| `gray-50`    | `#f8f8f8` | Secondary surface                            |
| `gray-100`   | `#f0f0f0` | Disabled surface                             |
| `gray-200`   | `#e0e0e0` | Default border                               |
| `gray-400`   | `#949494` | Placeholder and disabled text                |
| `gray-600`   | `#666666` | Secondary text                               |
| `gray-700`   | `#474747` | Supporting body text                         |
| `gray-900`   | `#212121` | Headings and default text                    |

### Semantic Colors

| Role          | Foreground | Background | Usage rule                                          |
| ------------- | ---------- | ---------- | --------------------------------------------------- |
| Brand primary | `#212121`  | `#fb4d00`  | Primary CTA; 4.73:1 contrast for normal-size text   |
| Brand strong  | `#ffffff`  | `#c83d00`  | Compact accent areas and active states              |
| Information   | `#174ea6`  | `#eef4ff`  | Neutral guidance and source information             |
| Success       | `#176b3a`  | `#edf8f1`  | Verification and expenditure completion             |
| Warning       | `#7a4b00`  | `#fff7df`  | Review required and delayed updates                 |
| Danger        | `#b42318`  | `#fff1f0`  | Errors, suspended expenditure, and destructive acts |

Never distinguish a status by color alone. Pair it with at least one of a status name, icon, or supporting description.

## 5. Typography

The default typeface is `Pretendard`, falling back to `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, and `sans-serif` in that order. Use weight 400 for body text and 700 for primary headings and strong emphasis. Restrict weight 500 to small controls such as buttons, tabs, and field labels.

| Token     | Size / line height | Weight | Purpose                                  |
| --------- | ------------------ | ------ | ---------------------------------------- |
| `display` | 48 / 60px          | 700    | Core statement on the public home        |
| `title-1` | 32 / 42px          | 700    | Page heading                             |
| `title-2` | 24 / 32px          | 700    | Primary section heading                  |
| `title-3` | 20 / 28px          | 700    | Card or panel heading                    |
| `body-lg` | 16 / 26px          | 400    | Introductions and long descriptions      |
| `body`    | 14 / 22px          | 400    | Default application body                 |
| `label`   | 14 / 20px          | 500    | Buttons, input labels, and table headers |
| `caption` | 12 / 18px          | 400    | Supporting information and update times  |

- The default application font size is 14px, but use 16px for important descriptions and mobile inputs.
- Keep long-form lines to approximately 45–75 characters.
- Right-align numeric columns and use consistent date and currency formats across the application.
- Public-page display headings may use `clamp()` when needed, but work screens must not use headings that overpower their content.

## 6. Spacing and Layout

Use a 4px-based spacing system.

| Token      | Value | Typical use                          |
| ---------- | ----- | ------------------------------------ |
| `space-1`  | 4px   | Icons and short labels               |
| `space-2`  | 8px   | Inline elements and compact controls |
| `space-3`  | 12px  | Input padding and dense lists        |
| `space-4`  | 16px  | Default component spacing            |
| `space-5`  | 20px  | Panel interiors                      |
| `space-6`  | 24px  | Within sections                      |
| `space-8`  | 32px  | Between sections                     |
| `space-10` | 40px  | Vertical page margins                |
| `space-12` | 48px  | Public-page sections                 |
| `space-16` | 64px  | Large marketing sections             |

### App Shell

- Desktop: 64px top bar, optional 264px left sidebar, and at least 36px content padding.
- Maximum content widths: 1440px for dashboards and tables, 960px for reading and forms, and 720px for long descriptions.
- Below 1024px: collapse the left sidebar and reduce content padding to 24px.
- Below 768px: use one column, 16px content padding, and convert top navigation into a menu panel.
- Hide lower-priority table columns or convert rows into cards; do not use horizontal scrolling as the default solution.

### Proximity and Alignment

- Space between separate groups must be at least 1.5 times the spacing within a group.
- Default to left alignment on work, form, and document screens. Restrict center alignment to short public-home introductions, completion results, and empty states.
- Do not create competing alignment axes within one area. Labels, values, and row actions should share consistent column lines.
- Do not hide critical status or the next action behind collapsed content or hover.

## 7. Shape, Borders, and Depth

- Radius: 6px for inputs and small buttons, 8px for panels and notices, and 12px for large public-page blocks. Use a fully circular shape only when the circle itself carries meaning, such as a radio control, avatar, or spinner.
- Default border: `1px solid #e0e0e0`. Active inputs use `#212121`; error inputs use `#b42318`.
- Use shadows only for elements that actually overlap content, such as dropdowns, modals, and fixed headers.
- Use surface color and borders instead of shadows on default cards.
- Use dividers to express list and table row structure, not as repeated decoration.

## 8. Shared Component Rules

Shared components follow [shadcn/ui](https://ui.shadcn.com/)'s source-ownership model. Add only the components needed through `components.json` and `src/components/ui`. Preserve the accessibility behavior of Radix UI primitives while adapting visual styles to Modugive tokens. Do not use Radix primitives directly in screen code; access them through shared components.

### Button

- Heights: small 32px, medium 40px, large 48px.
- As a rule, use one primary button per screen or work area.
- Secondary uses a white background and neutral border; tertiary uses a text button without a background.
- Use danger only for destructive actions that require confirmation.
- Preserve button width while loading and prevent duplicate submission.

### Input and Select

- Default height 40px, mobile form height 48px, horizontal padding 12px.
- A placeholder does not replace a label.
- Show the cause and resolution directly below an invalid field.
- Place search and filters near their results, and confirm applied filters with a chip or summary sentence.

### Card and Panel

- Use a Card only to group one decision or action unit.
- Statistic cards must include the value, reference period, and basis for change.
- Prefer a list or table over a card grid for repeated related items.
- Reserve Card for independently selected or movable objects, payment and pledge summaries, and genuinely floating supporting work. Prefer spacing and dividers for simple steps, descriptions, and chat messages.
- Do not nest a Card inside another Card with the same radius and border.

### Steps, Status, and Guidance

- Use `FlowProgress`, rather than rounded labels, to show both the current step and overall progress in sequential user flows.
- Express work status with the icon, color, and text combination in `StatusIndicator`, rather than a colored-background pill.
- Place categories, organization names, and dates in the normal metadata hierarchy; do not style them like statuses.
- Use `InlineNotice` for information requiring sentence-level explanation, such as demo limitations, payment restrictions, and personal-data warnings.
- Use `FilterTabs`, or Select on small screens, instead of groups of rounded filter chips.
- Keep inherently circular controls circular when the shape communicates their meaning, including radio controls, avatars, and spinners.

### Dialog

- At minimum, provide alert-dialog behavior for opening and closing, focus transfer, Escape dismissal, and blocking focus behind the dialog.
- Do not place complex forms in a modal; use a separate page or side panel.

### Page Header

- Public pages use a value proposition and one primary CTA.
- Management pages use the current work context, task title, short description, and one primary action when needed.
- Document review pages communicate document status and review responsibility before the heading.
- Use center alignment sparingly and only on completion or result pages.
- Do not repeat `Sample data` as a prominent eyebrow on every page. Use a quiet badge or guidance sentence where a demo might otherwise be mistaken for real data.

### Motion

- Prefer `opacity`, `background-color`, and `border-color` for state transitions between 150–250ms.
- Do not use positional movement, bounce, or excessive scale solely for hover effects.
- Use motion only when it explains the cause of a change, such as loading, save completion, or step navigation.

### State Screens

- Loading states identify what is in progress and why the user must wait.
- Empty states explain the cause, available next action, and how to reset active filters.
- Errors show both the cause and recovery action close to the area where the error occurred.
- Distinguish AI states as `Analyzing`, `Review required`, and `Confirmed`, and provide access to the source and an editing path.

### Tables and Lists

- Default row height is 52px; headers are at least 40px high.
- The first column identifies the item, and the last column contains row actions.
- Express sort state with an icon and accessible name.
- Empty states explain the cause, possible next action, and whether filters can be reset.

### Partner Management Lists

- The global sidebar distinguishes work objects—pledges, donations, plans, expenditures, and reports—while object statuses appear as tabs within each page.
- Avoid abstract statuses such as `Review required`. Include the responsible actor and object, as in `Organization signature required` or `Personal-data redaction review required`.
- Align decision-making information in consistent columns on desktop. On mobile, reduce rows to the title, key description, and status.
- Dashboard task counts link to the corresponding prefiltered lists.
- Add search, date range, assignee, and bulk actions only after real data volume and repeated work justify them. Do not place nonfunctional mock controls as decoration.
- AI screens requiring source review show source material and extraction results side by side, distinguishing `Matches source`, `Edited by staff`, and `Review required`.
- Actions affecting external users—publishing, issuing, and signing—first communicate the target, notification behavior, visibility, and unresolved items, then require a confirmation Dialog.

### Organization Registration and Pledge Templates

- Registration is a two-step flow, `Organization information → Pledge template`, showing both the current step and overall progress.
- Separate public organization information from nonpublic staff information. Do not collect unique identifiers such as resident registration numbers during organization registration.
- The pledge template references pages 1–2 of the repository file `후원(기부) 약정서식.pdf` and uses sections for donor information, donation type/amount/scheduled date, designation, payment method, receipt request, personal-information consent, and signatures.
- Exclude the in-kind donation book-value confirmation and the item/quantity/book-value table on page 3 of the PDF from the Modugive pledge template.
- Organizations may edit expenditure disclosure, recurring-donation cancellation, remaining-balance handling, and custom clauses, with changes reflected immediately in the pledge preview.
- Keep personal-information collection/use and receipt-issuance clauses as standard sections that cannot be deleted, while noting that legal and operational policy review is required before real-world use.

## 9. Trust and AI Communication

- Do not emphasize a single trust score alone. Show evaluation criteria, data sources, update dates, and unverified scope with it.
- Avoid definitive claims such as `Safe organization`. Communicate evidence levels with language such as `Based on disclosed materials`, `Verified items`, and `Further review required`.
- Explicitly label AI-generated or AI-summarized content and provide access to the source or supporting evidence.
- Never use real personal information, agreement data, or donation records in mock fixtures.

## 10. Accessibility and Verification Criteria

- Target contrast ratios of at least 4.5:1 for normal text and 3:1 for large text and UI boundaries.
- All interactive elements must be keyboard accessible and provide a clear focus ring at least 2px wide.
- Icon buttons must have a click target of at least 40×40px; primary mobile controls must be at least 44×44px.
- At 200% text zoom and a 360px width, there must be no loss or overlap of information.
- Respect `prefers-reduced-motion` and never rely on animation to communicate essential status.
- Manually review at 360px, 768px, 1280px, and 1440px viewport widths.

## 11. Token Usage Rules

- Components use semantic tokens such as `--color-text-primary` and `--color-surface-muted` instead of raw hex values.
- Do not add arbitrary `text-[#…]`, `bg-[#…]`, or `border-[#…]` values to Tailwind classes in pages or shared components.
- Before adding a new color or spacing value, confirm whether an existing token can express it.
- Consider promoting an exception to a token when it appears at least twice; do not create a token for a single screen.
- When design changes, update both this document and the tokens in `src/app/globals.css`.
