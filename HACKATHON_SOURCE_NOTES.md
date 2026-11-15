> **[DEPRECATED — see `docs/HACKATHON.md`]** These notes describe the earlier Nebius x NVIDIA Global AI Hackathon and its 30 October 2026 deadline. The current event is the HackCulture AI Global Hackathon.

# Hackathon source notes (verified 20 October 2026)

1. Official rules: https://nebiusglobalaihackathon.devpost.com/rules
   - Project must be a working app that makes a runtime call to Token Factory API or is deployed/run on Nebius AI Cloud compute, and uses at least one NVIDIA open source model.
   - Best Apps and Agents encourages apps/copilots powered by Nemotron models on Token Factory.
   - Submission requires working demo URL, public repo, open-source license, README, public YouTube demo under 3 minutes, tool feedback, and pre-existing-project change explanation where applicable.
   - Judging criteria are equally weighted: technological implementation, design, potential impact, quality of idea.
   - Deadline: Friday 30 October 2026, 10:00 a.m. PDT = 6:00 p.m. WAT.
2. Nebius model note: https://nebius.com/blog/posts/three-new-open-weight-models-from-us-companies-give-builders-more-choice
   - Published 16 October 2026; includes exact Token Factory model ID `nvidia/Nemotron-3.5-Super-VL`, OpenAI-compatible endpoint example, and a discussion of targeted code validation.
3. Nemotron Token Factory overview: https://nebius.com/services/token-factory/models/nvidia-nemotron-models-inference
   - Lists current model family/deployment options and OpenAI-compatible API example. Confirm live availability, request/structured-output behavior and billing with the actual API key in Phase 0.

Vercel Functions impose a 4.5 MB request/response body limit; the 3 MiB compressed ZIP ceiling leaves headroom for transport overhead and JSON/base64 framing. See https://vercel.com/docs/functions/limitations and https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions.

Do not represent any provider call as successful until a live runtime test has passed. The model identifier and endpoint should be rechecked immediately before deployment because model catalogs can change.
