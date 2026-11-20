---
title: 02 · Governance, Evidence & Adoption Signals
description: Evidence tagging standards, 3-gate pre-publication controls, multi-author ownership, and outcome-focused adoption telemetry.
---

# 02 · Governance, Evidence & Adoption Signals

<PageBrief
  stepLabel="OPERATING MODEL · 02"
  readTime="3 min read"
  problem="Architecture documentation loses trust when opinions blur into product SLAs or sensitive identifiers slip into shared pages."
  takeaway="Every page enforces 4 explicit source tags ([M], [Arch], [Agree], [Validate]) and passes 3 automated PR gates before merge."
  csaUse="Verify every product specification directly against linked Microsoft Learn pages while treating [Agree] thresholds as recommended SLO baselines."
/>

High-trust architecture guidance requires strict separation between **verified platform specifications**, **reference design patterns**, and **proposed operational thresholds**—paired with clear ownership and outcome tracking.

<div class="arch-diagram">
  <svg viewBox="0 0 760 150" role="img" aria-labelledby="gov-title gov-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="gov-title">Four-Tier Evidence and Three-Gate Governance Flow</title>
    <desc id="gov-desc">Shows Draft Contribution tagged with [M], [Arch], [Agree], and [Validate] passing Gate 1 Automated Sanitization, Gate 2 Peer CODEOWNERS Review, and Gate 3 IP Prior-Art Clearance to publish as a Customer-Safe Field Asset.</desc>
    <defs><marker id="gov-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="18" width="136" height="92" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="16" y="37" font-size="9.2" font-weight="700" fill="#183e62">1. Tagged Draft</text>
    <text x="16" y="53" font-size="8.2" fill="#334e68">[M] Learn facts vs.</text>
    <text x="16" y="66" font-size="8.2" fill="#334e68">[Arch] patterns &amp;</text>
    <text x="16" y="79" font-size="8.2" fill="#334e68">[Agree] target SLOs</text>
    <text x="16" y="98" font-size="7.8" font-weight="700" fill="#1d4ed8">[Source Discipline]</text>
    <path d="M144 64 H162" stroke="#0f766e" stroke-width="1.7" marker-end="url(#gov-arr)"/>
    <rect x="166" y="18" width="134" height="92" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="174" y="37" font-size="9.2" font-weight="700" fill="#183e62">2. Gate 1: Sanitize</text>
    <text x="174" y="53" font-size="8.2" fill="#334e68">check-sanitized.mjs</text>
    <text x="174" y="66" font-size="8.2" fill="#334e68">blocks customer IDs,</text>
    <text x="174" y="79" font-size="8.2" fill="#334e68">emails &amp; GUIDs</text>
    <text x="174" y="98" font-size="7.8" font-weight="700" fill="#1d4ed8">[Zero Data Leak]</text>
    <path d="M300 64 H318" stroke="#0f766e" stroke-width="1.7" marker-end="url(#gov-arr)"/>
    <rect x="322" y="18" width="134" height="92" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="330" y="37" font-size="9.2" font-weight="700" fill="#183e62">3. Gate 2: Peer ARB</text>
    <text x="330" y="53" font-size="8.2" fill="#334e68">Track Owner checks</text>
    <text x="330" y="66" font-size="8.2" fill="#334e68">citations, math &amp;</text>
    <text x="330" y="79" font-size="8.2" fill="#334e68">zero broken links</text>
    <text x="330" y="98" font-size="7.8" font-weight="700" fill="#1d4ed8">[CODEOWNERS Gate]</text>
    <path d="M456 64 H474" stroke="#0f766e" stroke-width="1.7" marker-end="url(#gov-arr)"/>
    <rect x="478" y="18" width="130" height="92" rx="6" fill="#fff7eb" stroke="#d97706" stroke-width="1.4"/>
    <text x="486" y="37" font-size="9.2" font-weight="700" fill="#92400e">4. Gate 3: IP Screen</text>
    <text x="486" y="53" font-size="8.2" fill="#334e68">Holds active patent</text>
    <text x="486" y="66" font-size="8.2" fill="#334e68">disclosures prior to</text>
    <text x="486" y="79" font-size="8.2" fill="#334e68">any public commit</text>
    <text x="486" y="98" font-size="7.8" font-weight="700" fill="#b45309">[Prior-Art Safe]</text>
    <path d="M608 64 H626" stroke="#0f766e" stroke-width="1.7" marker-end="url(#gov-arr)"/>
    <rect x="630" y="18" width="122" height="92" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="638" y="37" font-size="9.2" font-weight="700" fill="#115e59">5. Trusted Asset</text>
    <text x="638" y="53" font-size="8.2" fill="#334e68">Named co-authors,</text>
    <text x="638" y="66" font-size="8.2" fill="#334e68">verified date &amp;</text>
    <text x="638" y="79" font-size="8.2" fill="#334e68">outcome tracking</text>
    <text x="638" y="98" font-size="7.8" font-weight="700" fill="#0f766e">[Customer-Ready]</text>
    <text x="10" y="136" font-size="8.4" fill="#526c80">Automated CI + human peer governance ensures every playbook stays accurate, sanitized, and safe to share externally.</text>
  </svg>
</div>

## 1. Four-Tier Evidence Discipline

Every technical claim, table, and code block across this hub uses four explicit tags:

| Tag | Meaning | Verification Requirement |
| :--- | :--- | :--- |
| <span class="ev-badge ev-m">[M]</span> **Microsoft Learn Verified** | Published Azure OpenAI in Microsoft Foundry Models or OpenAI platform specification (e.g., PTU-M breakpoint boundaries, `12h` cache-write billing date, `reasoning.context` defaults, normalized token weights). | Must cite an authoritative URL on the playbook's `Sources` page with an explicit `Last verified` date. |
| <span class="ev-badge ev-arch">[Arch]</span> **Reference Architecture Pattern** | Recommended reference architecture pattern for enterprise runtimes, context assembly, APIM failover, or CI/CD quality pipelines. | Must document trade-offs, preconditions, and do/avoid boundaries. |
| <span class="ev-badge ev-agree">[Agree]</span> **Recommended Gate SLO** | Proposed release threshold (e.g., `&ge;80%` repeat cache hit rate, `&ge;60%` cached input share, `&ge;10:1` read/write ratio). | Presented transparently as a recommended target for release sign-off—never disguised as a hard platform limit. |
| <span class="ev-badge ev-val">[Validate]</span> **Subscription Empirical Check** | Behavior that depends on regional rollout state, quota tier, or endpoint configuration. | Paired with a reproducible probe (e.g., the 2-pass cache hit probe or regional quota check). Never references unpublished roadmaps. |

## 2. Three-Gate Pre-Publication Checklist

Every Pull Request into `main` enforces three gates via `.github/pull_request_template.md` and GitHub Actions:

1. **Sanitization & Confidentiality (`scripts/check-sanitized.mjs`):** Automated scan across `.md`, `.vue`, `.html`, `.kql`, and extracted `.pdf` text blocking customer names, project code names, internal aliases, internal email addresses, restricted classification banners, and Azure subscription GUIDs.
2. **Peer Architecture Review (`.github/CODEOWNERS`):** At least one review from a designated Track Owner confirming source accuracy, workload neutrality, and zero broken links (`npm run verify`).
3. **IP & Prior-Art Clearance:** Confirmation that the contribution synthesizes public platform capabilities + architectural best practices and does **not** prematurely publish an un-cleared invention disclosure.

## 3. Multi-Author Ownership Model

Playbooks are owned by **named Track Leads and Co-Authors**, not anonymous wiki edits:

- **Visible Bylines:** Every playbook displays its Track Owners, Customer-Zero provenance category, governance status, and `Last verified` date in the `<PlaybookMeta />` header banner across both chapter pages and consolidated white-paper subpages.
- **Scoped Directory Ownership:** `.github/CODEOWNERS` routes PRs in `/docs/playbooks/<track>/` directly to that track's co-authors while keeping root sanitization rules gated centrally.
- **Low-Friction Peer Contribution:** Contributors can either co-own a full playbook track ([see all 4 Live Playbooks in the Architecture Catalog](/playbooks/)) or submit a single workload profile, APIM policy, KQL query, or CI check via Pull Request.

## 4. Outcome-Oriented Adoption Metrics (What We Measure—and What We Don't)

::: warning Outcome Metrics Over Vanity Traffic
Page views, generic downloads, and social impressions do **not** prove architectural impact. Track adoption through concrete delivery and engineering outcomes.
:::

| Outcome Metric | What High-Impact Reuse Looks Like |
| :--- | :--- |
| **1. Architecture Design Sessions (ADS) Accelerated** | Count of customer architecture reviews where the playbook's decision matrices (`Scope × Volatility` prefix order, PTU calculator, APIM spillover) compressed design sign-off from weeks to a single working session. |
| **2. Pre-Cutover Regressions Prevented** | Count of model migrations (`gpt-4.x` / `o3-mini` &rarr; `gpt-5.6` / `gpt-6` / `gpt-6.1`) where `PCR001–006` linting or the 2-pass DeepEval / KQL gate caught `0%` cache hits or PTU under-sizing *before* production cutover. |
| **3. Repeatable Readiness Engagements Scoped** | Number of structured 2–3 week customer readiness engagements scoped directly from the [Repeatable Delivery Blueprint](/operating-model/delivery-scoping). |
| **4. Multi-Author Reuse Across Teams** | Number of peer architects actively contributing chapters, co-owning new playbook tracks, or adapting the KQL/lint kits on independent accounts. |
| **5. Upstream Product & Learn Contributions** | Count of Product Group engineering briefs actioned or Azure Architecture Center / Microsoft Learn pull requests merged from matured playbook chapters. |
