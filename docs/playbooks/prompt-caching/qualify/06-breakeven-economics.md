---
title: 06 · Cache Write/Read Break-Even Economics
description: Mathematical break-even analysis balancing 1.25x cache-write weights against 0.10x / 0.05x cached-read weights across GPT-5.6, GPT-6, and GPT-6.1.
---

# 06 · Cache Write vs. Cache Read Break-Even Economics

<PageBrief
  stage="qualify"
  readTime="3 min read"
  problem="GPT-5.6+ cache-write fees (1.25× weight) raise questions about whether prompt caching could cost more than uncached calls."
  takeaway="Just ONE subsequent cache read (1:1 ratio) already cuts effective prefix cost by 32.5%–35%; at a 10:1 target gate, cost drops by 80%–84%."
  csaUse="Use the break-even curve below to verify that write penalties occur only when early dynamic text forces repeated 0:1 misses."
/>

Because GPT-5.6, GPT-6, and GPT-6.1 introduce explicit cache-write billing (including `12h` write billing effective November 1, 2026) and normalized PTU weights <span class="ev-badge ev-m">[M]</span>, architecture teams must verify that cached prefixes are read enough times within their TTL to amortize the initial write premium.

<div class="arch-diagram">
  <svg viewBox="0 0 760 144" role="img" aria-labelledby="be-title be-desc" font-family="Segoe UI, Inter, -apple-system, sans-serif">
    <title id="be-title">Cache Read-to-Write Amortization Progression</title>
    <desc id="be-desc">Shows effective prefix token weight dropping from 1.25x (+25% penalty at 0 reads) to 0.675x (-32.5% at 1 read), 0.330x (-67% at 4 reads), 0.205x (-79.5% at 10 reads gate target), and 0.144x (-85.6% at 25+ reads).</desc>
    <defs><marker id="be-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#0f766e"/></marker></defs>
    <rect x="8" y="14" width="132" height="90" rx="6" fill="#fef2f2" stroke="#dc2626" stroke-width="1.3"/>
    <text x="16" y="33" font-size="9.1" font-weight="700" fill="#991b1b">0 Reads (0:1 Miss)</text>
    <text x="16" y="49" font-size="8.2" fill="#475569">1.25x effective wt</text>
    <text x="16" y="62" font-size="8.2" fill="#475569">Writes never reused</text>
    <text x="16" y="75" font-size="8.2" fill="#475569">Disable explicit write</text>
    <text x="16" y="94" font-size="7.8" font-weight="700" fill="#b91c1c">[+25% Write Penalty]</text>
    <path d="M140 59 H158" stroke="#0f766e" stroke-width="1.7" marker-end="url(#be-arr)"/>
    <rect x="162" y="14" width="134" height="90" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="170" y="33" font-size="9.1" font-weight="700" fill="#183e62">1 Read (1:1 Hit)</text>
    <text x="170" y="49" font-size="8.2" fill="#334e68">0.675x (GPT-6) /</text>
    <text x="170" y="62" font-size="8.2" fill="#334e68">0.650x (6.1 Sol)</text>
    <text x="170" y="75" font-size="8.2" fill="#334e68">Instant payback!</text>
    <text x="170" y="94" font-size="7.8" font-weight="700" fill="#1d4ed8">[&minus;32.5% to &minus;35% Net]</text>
    <path d="M296 59 H314" stroke="#0f766e" stroke-width="1.7" marker-end="url(#be-arr)"/>
    <rect x="318" y="14" width="134" height="90" rx="6" fill="#edf3fb" stroke="#5b87b2" stroke-width="1.4"/>
    <text x="326" y="33" font-size="9.1" font-weight="700" fill="#183e62">4 Reads (4:1 Chat)</text>
    <text x="326" y="49" font-size="8.2" fill="#334e68">0.330x (GPT-6) /</text>
    <text x="326" y="62" font-size="8.2" fill="#334e68">0.290x (6.1 Sol)</text>
    <text x="326" y="75" font-size="8.2" fill="#334e68">5-turn user session</text>
    <text x="326" y="94" font-size="7.8" font-weight="700" fill="#1d4ed8">[&minus;67% to &minus;71% Net]</text>
    <path d="M452 59 H470" stroke="#0f766e" stroke-width="1.7" marker-end="url(#be-arr)"/>
    <rect x="474" y="14" width="134" height="90" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="482" y="33" font-size="9.1" font-weight="700" fill="#115e59">10 Reads (Gate SLO)</text>
    <text x="482" y="49" font-size="8.2" fill="#334e68">0.205x (GPT-6) /</text>
    <text x="482" y="62" font-size="8.2" fill="#334e68">0.159x (6.1 Sol)</text>
    <text x="482" y="75" font-size="8.2" fill="#334e68">5&times;–6&times; compression</text>
    <text x="482" y="94" font-size="7.8" font-weight="700" fill="#0f766e">[&minus;80% to &minus;84% Net]</text>
    <path d="M608 59 H626" stroke="#0f766e" stroke-width="1.7" marker-end="url(#be-arr)"/>
    <rect x="630" y="14" width="122" height="90" rx="6" fill="#eaf4f5" stroke="#0f766e" stroke-width="1.5"/>
    <text x="638" y="33" font-size="9.1" font-weight="700" fill="#115e59">25+ Reads (Batch)</text>
    <text x="638" y="49" font-size="8.2" fill="#334e68">0.144x (GPT-6) /</text>
    <text x="638" y="62" font-size="8.2" fill="#334e68">0.096x (6.1 Sol)</text>
    <text x="638" y="75" font-size="8.2" fill="#334e68">Evaluate 12h TTL</text>
    <text x="638" y="94" font-size="7.8" font-weight="700" fill="#0f766e">[Up to &minus;90.4% Net]</text>
    <text x="10" y="130" font-size="8.4" fill="#526c80">Break-even requires only 1 subsequent read (k = 1); our production gate targets k &ge; 10 reads per write.</text>
  </svg>
</div>

## Mathematical Break-Even Formula `[M]`

For a reusable prefix of `P >= 1,024` tokens written once at short-context (`<=272K`) normalized weight `w_write = 1.25` and read `k` subsequent times within its TTL at weight `w_read` (`0.10` on GPT-6, `0.05` on `gpt-6.1-sol`), the effective normalized weight per prefix token across `k + 1` total requests is:

```text
C(k) = (1.25 + k × w_read) ÷ (k + 1)
```

## Effective Prefix Cost Across Reuse Regimes

| Reuse Regime (`k` Reads per Write) | Read/Write Ratio (`k : 1`) | GPT-6 Effective Weight / Prefix Token | GPT-6.1 Sol Weight / Prefix Token | Architectural & FinOps Prescription |
| :--- | :--- | :--- | :--- | :--- |
| **One-shot (`k = 0`)** | `0 : 1` (Miss) | `1.25x` (**+25% penalty**) | `1.25x` (**+25% penalty**) | **Disable caching:** set `prompt_cache_options: {"mode":"explicit"}` with zero breakpoints <span class="ev-badge ev-m">[M]</span>. |
| **Single reuse (`k = 1`)** | `1 : 1` (Break-even+) | `0.675x` (**−32.5% net**) | `0.650x` (**−35.0% net**) | **Already net-positive:** just *one* cache hit more than pays back the `0.25x` write premium. |
| **Multi-turn session (`k = 4`)** | `4 : 1` | `0.330x` (**−67.0% net**) | `0.290x` (**−71.0% net**) | **Use `ttl: "30m"` (default):** covers typical 5-turn interactive review sessions. |
| **Steady gate target (`k = 10`)** | `10 : 1` <span class="ev-badge ev-agree">[Agree]</span> | `0.205x` (**−79.5% net**) | `0.159x` (**−84.1% net**) | **Production gate baseline:** unlocks `~5×–6×` prefix compression across shared `T0/L2` prefixes. |
| **Cross-day batch (`k >= 25`)** | `25 : 1+` | `0.144x` (**−85.6% net**) | `0.096x` (**−90.4% net**) | **Evaluate `ttl: "12h"` (Responses API):** justified when inter-arrival gaps exceed 30 minutes. |

::: info FinOps Takeaway
Break-even requires **only one subsequent read (`k = 1`)** on `30m` TTL. Cache-write regressions occur only when early volatile tokens (such as timestamps in Pos 1) force `k = 0` on *every* request—turning every call into an unamortized `1.25x` write.
:::
