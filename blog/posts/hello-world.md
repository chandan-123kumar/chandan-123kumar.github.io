# Hello, world — and what I'll be writing about

I'm Chandan. Seven years building production software at JPMorgan Chase and BrowserStack, currently shipping AI: agentic developer tooling, low-latency voice agents, and the occasional CUDA kernel.

This blog is where I'll work things out in public.

## What you'll find here

- **Agentic SDLC** — how we cut development time ~50% at BrowserStack with a 6-phase Spec-Driven Development pipeline, what worked, what didn't.
- **Voice AI engineering** — sub-second voice agents on consumer GPUs. Pipecat, faster-whisper, Silero VAD, and a megakernel TTS that does 47 ms time-to-first-audio.
- **GPU rabbit holes** — persistent-kernel CUDA, race conditions in decoders, bf16 noise floors.
- **Building with LLMs** — Claude Code, MCP servers, prompt and context engineering, agent evaluation.

## Why a blog (and not just more shorts)

I post on [@ai_system_design](https://www.instagram.com/ai_system_design) almost daily — bite-size system design for engineers. That format is great for ideas; it's terrible for *evidence*. A 60-second clip can show that a 5× TTS speedup exists. It can't show **why** the megakernel works, what the failure modes look like, or what I'd do differently next time.

So: short-form on Instagram, long-form here.

## What to expect from posts

- **Numbers.** TTFB, RTF, tokens/sec, RPS, p99 — if a claim has a measurement, it gets a measurement.
- **Code.** Real snippets, with the failure mode they were designed to fix.
- **Diagrams when they help, not when they look nice.**
- Honest "this didn't work" sections.

## Subscribe / follow

There's no email list yet. If you want updates, the fastest channel is:

- **WhatsApp** — easiest, fastest reply: [+91 72330 22562](https://wa.me/917233022562)
- **LinkedIn** — [linkedin.com/in/chandan-kumar-100a78111](https://www.linkedin.com/in/chandan-kumar-100a78111/)
- **Instagram** — [@ai_system_design](https://www.instagram.com/ai_system_design)

Thanks for reading. First real post coming soon — probably on **how the megakernel cuts first-audio latency from 4.6 s to 47 ms**, and why "just batch harder" is the wrong intuition.
