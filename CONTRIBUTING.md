# Contributing & Co-Authoring Guide

The **Enterprise Azure AI Solution Industrialization Hub** operates as a **governed, multi-author architecture repository**. Every playbook, decision tool, and engineering kit originates from validated production engineering (**Customer-Zero**) and passes three mandatory pre-publication gates.

## 1. Repository & Track Ownership

- **Hub Maintainers (`.github/CODEOWNERS` root):** Own the site design system, evidence conventions (`[M]`, `[Arch]`, `[Agree]`, `[Validate]`), interactive Decision Studio, and automated sanitization gate.
- **Playbook Track Leads & Co-Authors:** Own a dedicated track directory (`prompt-caching`, `apim-gateway`, `multi-region-bcp`, `agentic-rag-evals`, `ai-data-strategy`), review pull requests within their scope, and keep `Last verified` dates current across model waves.
- **Field Contributors:** Submit workload profiles, APIM policy snippets, KQL release gates, static lint checks, or documentation refinements via Pull Request (or the *"Suggest an edit to this page"* link on any page).

## 2. Three Mandatory Pre-Publication Gates

Before opening or merging a Pull Request, verify all three gates:

1. **Sanitization & Confidentiality Gate (`npm run check:sanitized`):**
   - Strip all customer names, project code names, individual stakeholder names, engagement dates, internal organization/sales acronyms, internal email addresses, and Azure tenant/subscription GUIDs.
   - Express every scenario in neutral, reusable architectural terms (`Workspace / Case Context Card (L2)`, `Multi-Node Rubric-Scoring Agent`, `PTU-M Primary + Standard PAYG Spillover`).
2. **Architecture & Source-Discipline Gate:**
   - Tag every product behavior claim `[M]` with an authoritative link to public Microsoft Learn or OpenAI documentation and update the `Last verified` timestamp on the playbook's `sources.md` page.
   - Tag reference patterns `[Arch]`, proposed release thresholds `[Agree]`, and empirical environment checks `[Validate]`. Never cite unpublished internal roadmaps.
3. **IP & Channel Disposition Gate:**
   - Confirm whether any novel mechanism is an active patent / invention-disclosure candidate. **Do not commit active invention-disclosure drafts to public repositories** (public commits create immediate prior art).
   - Identify companion upstream targets where applicable (Product Group engineering brief or Azure Architecture Center PR).

## 3. Progressive-Disclosure Page Standard

Every chapter and subpage follows a three-tier visual structure:

1. **Top `<PageBrief />` Card:** Concise 3-column summary (*Why It Matters*, *Key Takeaway*, *Practical Application*) with journey stage indicator and read time.
2. **Visual Mental Model:** Clean horizontal SVG architecture/flow diagram (`.arch-diagram`, theme-adaptive across light and dark modes) ahead of dense specification tables.
3. **Verified Engineering Detail:** Evidence-tagged (`[M]`, `[Arch]`, `[Agree]`, `[Validate]`) matrices, formulas, and copy-ready code/XML/KQL snippets.

## 4. Local Verification Workflow

```bash
git checkout -b feat/<track>-<topic>
npm run verify
```

Open a Pull Request and complete all checkboxes in `.github/pull_request_template.md`.
