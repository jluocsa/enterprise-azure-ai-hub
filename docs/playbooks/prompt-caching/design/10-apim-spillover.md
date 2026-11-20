---
title: 10 · APIM SKU-Aware PTU-to-Standard Spillover
description: Reference topology pairing right-sized PTU-M base capacity with SKU-aware Standard PAYG spillover behind Azure API Management.
---

# 10 · APIM SKU-Aware PTU-to-Standard Spillover

<PageBrief
  stage="design"
  readTime="3 min read"
  problem="Forwarding identical JSON payloads across GPT-5.6 PTU-M and Standard PAYG fails when PTU-M rejects explicit breakpoints or drops cache keys on 429 failover."
  takeaway="Size base PTU-M for steady demand, strip breakpoint fields only on the GPT-5.6 PTU-M leg in APIM, and preserve prompt_cache_key on 429 spillover."
  csaUse="Apply this 3-rule gateway pattern when configuring Azure API Management PTU-M primary and Standard PAYG spillover backend pools."
/>

Rolling 30-day PTU right-sizing works best when base **Global / Data Zone PTU-M** capacity is sized for steady sustained demand (staying below `~60–70%` queuing saturation) and paired with automatic **Standard (PAYG) spillover** via Azure API Management (APIM) on HTTP `429` <span class="ev-badge ev-arch">[Arch]</span>.

## SKU-Aware Gateway Routing Topology `[Arch]`

<div class="arch-diagram">
  <svg viewBox="0 0 700 114" role="img" aria-labelledby="apim-title apim-desc">
    <title id="apim-title">APIM SKU-aware routing between PTU-M primary deployment and Standard spillover</title>
    <desc id="apim-desc">Shows enterprise AI applications sending sharded prompt_cache_key requests through Azure API Management to a primary PTU-M deployment (sized below queuing saturation) with automatic HTTP 429 spillover to a Standard PAYG deployment.</desc>
    <defs><marker id="arr13" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#16858a"/></marker></defs>
    <rect x="6" y="12" width="166" height="86" rx="6" fill="#edf3fb" stroke="#93adc7"/>
    <text x="14" y="30" font-size="9.5" font-weight="700" fill="#183e62">Enterprise AI App / Agent</text>
    <text x="14" y="45" font-size="8.2" fill="#35556f">&bull; Pos 1–6 static-first prefix</text>
    <text x="14" y="58" font-size="8.2" fill="#35556f">&bull; Sharded prompt_cache_key</text>
    <text x="14" y="71" font-size="8.2" fill="#35556f">&bull; reasoning.context pinned</text>
    <text x="14" y="84" font-size="8.2" fill="#0e7279" font-weight="700">&bull; Breakpoints on Pos 3 &amp; 4</text>
    <path d="M172 55 H198" stroke="#16858a" stroke-width="2" marker-end="url(#arr13)"/>
    <rect x="202" y="12" width="196" height="86" rx="6" fill="#f8fafc" stroke="#6ca9a8" stroke-width="1.4"/>
    <text x="212" y="30" font-size="9.5" font-weight="700" fill="#115e63">APIM Gateway &amp; SKU Adapter</text>
    <text x="212" y="45" font-size="8.2" fill="#355d65">1. Preserves prompt_cache_key</text>
    <text x="212" y="58" font-size="8.2" fill="#355d65">2. Strips breakpoint fields if target</text>
    <text x="212" y="70" font-size="8.2" fill="#355d65">   is GPT-5.6 PTU-M (unsupported)</text>
    <text x="212" y="83" font-size="8.2" fill="#183e62" font-weight="700">3. Fails over on 429 Retry-After</text>
    <path d="M398 35 H430" stroke="#16858a" stroke-width="2" marker-end="url(#arr13)"/>
    <path d="M398 76 H430" stroke="#be7730" stroke-width="1.8" stroke-dasharray="4,2" marker-end="url(#arr13)"/>
    <rect x="434" y="8" width="260" height="44" rx="5" fill="#eaf7f5" stroke="#16858a"/>
    <text x="442" y="24" font-size="9.2" font-weight="700" fill="#0e7279">Primary: Provisioned (PTU-M) Deployment</text>
    <text x="442" y="37" font-size="8.1" fill="#355d65">Sized with burst headroom; 0% cached draw on</text>
    <text x="442" y="47" font-size="8.1" fill="#355d65">5.6 PTU-M; 0.1x / 0.05x read weight on GPT-6 / 6.1</text>
    <rect x="434" y="58" width="260" height="44" rx="5" fill="#fff7eb" stroke="#be7730"/>
    <text x="442" y="74" font-size="9.2" font-weight="700" fill="#8a4b0f">Spillover: Standard (PAYG) Deployment</text>
    <text x="442" y="87" font-size="8.1" fill="#8a4b0f">Absorbs burst traffic above PTU ceiling; honors explicit</text>
    <text x="442" y="97" font-size="8.1" fill="#8a4b0f">breakpoints on 5.6+ and reports cache_write_tokens</text>
  </svg>
</div>

## Critical Gateway Rules When Mixing GPT-5.6 PTU-M & Standard

1. **Preserve `prompt_cache_key` across both legs:** Keep the exact sharded `prompt_cache_key` unchanged when failing over from PTU-M to Standard so repeated spillover requests still group onto the same Standard cache partition.
2. **Strip unsupported breakpoint fields on the GPT-5.6 PTU-M leg:** Because GPT-5.6 PTU-M does not support `prompt_cache_breakpoint` or `prompt_cache_options` <span class="ev-badge ev-m">[M]</span> (whereas GPT-5.6 Standard and GPT-6+ PTU-M do), let the gateway adapter strip those fields when forwarding to a GPT-5.6 PTU-M backend while leaving them intact on Standard spillover and GPT-6+ PTU-M.
3. **Bound retries & honor `Retry-After`:** Open the primary backend's circuit breaker for the returned `Retry-After` duration on HTTP `429`, route burst calls cleanly to Standard, and never replay mid-stream SSE failures.
