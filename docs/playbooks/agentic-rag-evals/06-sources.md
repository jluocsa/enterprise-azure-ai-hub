---
title: "06 · Verification Matrix & Sources (Playbook 04)"
description: Authoritative Microsoft Learn and open-source specifications backing Playbook 04 (Sandboxed Agentic Harness, Foundry IQ Grounded RAG & 7-Layer Evals).
---

# 06 · Verification Matrix & Authoritative Sources

<PlaybookMeta
  track="04 · Sandboxed Agentic Harness, Foundry IQ RAG & 7-Layer Evals"
  verified="2026-11-19 PST"
  status="Live v2.0"
/>

<PageBrief
  stage="reference"
  readTime="2 min read"
  problem="Agent runtime sandboxing, agentic retrieval, and GenAI OpenTelemetry conventions evolve rapidly across cloud SDKs."
  takeaway="Every [M] platform claim in Playbook 04 maps directly to the published Microsoft Learn and OpenTelemetry specifications below."
  csaUse="Reference these primary sources during Security Architecture and Responsible AI governance reviews."
/>

## Authoritative Microsoft Learn & Open-Standard Citations (`[M]`)

| Ref | Official Documentation Source | Key Platform Facts Grounded | Last Verified |
| :--- | :--- | :--- | :--- |
| **`A-R1`** | [Azure Container Apps Dynamic Sessions & Hyper-V Sandboxes](https://learn.microsoft.com/en-us/azure/container-apps/sessions) | MicroVM hardware/hypervisor boundary per session identifier, session pool lifecycle (`cooldown-period`, `max-sessions`), and untrusted code isolation. | `2026-11-19` |
| **`A-R2`** | [Agentic Retrieval & Knowledge Bases in Azure AI Search (Foundry IQ)](https://learn.microsoft.com/en-us/azure/search/search-agentic-retrieval-concept) | Query planning, hybrid + semantic reranking, MCP `knowledge_base_retrieve` integration, and security-trimmed enterprise grounding. | `2026-11-19` |
| **`A-R3`** | [Azure AI Content Understanding Overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview) | Multimodal and binary document extraction into structured layout-preserving Markdown and fields. | `2026-11-19` |
| **`A-R4`** | [Evaluate Generative AI Applications with Microsoft Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-approach-gen-ai) | Built-in `Groundedness`, `Relevance`, `TaskAdherence`, and safety/red-teaming evaluators for pre-production release scoring. | `2026-11-19` |
| **`A-R5`** | [Trace & Observe AI Agents in Microsoft Foundry (OpenTelemetry `gen_ai.*`)](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/develop/trace-application) | OpenTelemetry `gen_ai.*` semantic conventions, Application Insights integration, and `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` privacy controls. | `2026-11-19` |
| **`A-R6`** | [`microsoft/waza` — Agent Skill Evaluation CLI & Framework](https://github.com/microsoft/waza) | Reproducible task fixtures, trigger accuracy, and trajectory assertions for modular agent skills. | `2026-11-19` |
