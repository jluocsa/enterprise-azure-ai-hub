## Summary of Architecture Pattern / Playbook Update

- **Track:** `01 · Prompt Caching & PTU` | `02 · APIM AI Gateway` | `03 · Multi-Region BCP` | `04 · Agentic Harness & Evals` | `Decision Studio` | `Operating Model`
- **Customer-Zero Provenance (anonymized industry/workload archetype only):** e.g., *Regulated enterprise multi-node document review & compliance platform*

## Mandatory 3-Gate Pre-Publication Checklist

- [ ] **Gate 1 — Sanitization (`npm run check:sanitized` passes):** Zero customer names, stakeholder names, engagement timelines, internal org/sales acronyms, internal email addresses, or subscription/tenant GUIDs appear in prose, diagrams, XML policies, code comments, or PDFs.
- [ ] **Gate 2 — Source & Architecture Review:** Product claims are tagged `[M]` and verified against public Microsoft Learn docs (`Last verified` updated); reference patterns are tagged `[Arch]`; proposed release SLOs are tagged `[Agree]`; empirical probes are tagged `[Validate]`; zero unpublished NDA roadmap items are included.
- [ ] **Gate 3 — IP & Channel Disposition:** Confirmed this contribution does **not** disclose an un-cleared invention disclosure (IDF), and noted whether it is also queued for Azure Architecture Center / Product Group upstreaming.
- [ ] **Full Verification (`npm run verify`):** Sanitization gate, Python kit CLI smoke tests, and VitePress production build succeed with zero dead links or warnings.
