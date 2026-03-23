# Karpathy US Job Market Visualizer — Summary

**Source:** [karpathy.ai/jobs](https://karpathy.ai/jobs/) · March 2026  
**Created by:** Andrej Karpathy (ex-OpenAI, ex-Tesla)

---

## What It Is

A visual research tool that maps **342 occupations** from the Bureau of Labor Statistics (BLS) Occupational Outlook Handbook — covering **143 million jobs** across the US economy.

Each rectangle in the treemap is sized by **total employment**. Color shows the selected metric.

---

## What It Shows

You can toggle between 4 views:

| Metric | What It Tells You |
|--------|-------------------|
| BLS Projected Growth | Government forecast — which jobs are growing or shrinking |
| Median Pay | Annual earnings by occupation |
| Education Required | Degree level needed to enter the field |
| **Digital AI Exposure** | How much AI will reshape each job (0–10 score) |

---

## The AI Exposure Score (Most Important Feature)

Karpathy used an LLM prompt to score every occupation on **Digital AI Exposure** — a 0 to 10 scale.

### The Core Insight

> **If the job can be done entirely from a home office on a computer — writing, coding, analyzing, communicating — AI exposure is inherently high (7+).** The ceiling is very high and the trajectory is steep. Conversely, jobs requiring physical presence, manual skill, or real-time human interaction have a natural barrier.

### The Scale

| Score | Category | Examples |
|-------|----------|---------|
| 0–1 | Minimal | Roofer, landscaper, commercial diver |
| 2–3 | Low | Electrician, plumber, firefighter, dental hygienist |
| 4–5 | Moderate | Registered nurse, police officer, veterinarian |
| 6–7 | High | Teacher, manager, accountant, journalist |
| 8–9 | Very High | Software developer, graphic designer, translator, data analyst, paralegal, copywriter |
| 10 | Maximum | Data entry clerk, telemarketer |

---

## The Key Caveat

⚠️ **High exposure ≠ the job disappears.**

> "Software developers score 9/10 because AI is transforming their work — but demand for software could easily grow as each developer becomes more productive."

The score does **not** account for:
- Demand elasticity (more productivity → more software demand)
- Latent demand (things we couldn't build before)
- Regulatory barriers
- Social preferences for human workers

**Many high-exposure jobs will be reshaped, not replaced.**

---

## Why This Matters for Project Future

This tool gives us a **visual map of who gets hit first and hardest**.

The jobs most at risk are the ones that:
1. Are entirely digital (8–10 exposure)
2. Have high employment numbers (large rectangles in the treemap)
3. Are in the knowledge-worker middle class

That intersection — **high employment + high AI exposure** — is the core of the economic dislocation thesis. These are the workers who:
- Are the primary earners for their families
- Pay the most taxes
- Drive consumer spending
- Take out the most mortgages

When AI reshapes their work, the ripple effects are not just jobs — they're the entire economic chain: spending, debt, banking, government revenue.

---

## The LLM Pipeline (Technical Note)

Karpathy open-sourced the pipeline:
- Scrapers and parsers for BLS data
- LLM scoring prompt framework
- You can write **any** prompt and re-color the treemap

Alternative scoring prompts you could run:
- Exposure to humanoid robotics
- Offshoring risk
- Climate impact
- Which jobs will see 10x demand increase

This is infrastructure for thinking about the future of work, not just a static visualization.

---

*Summarized from karpathy.ai/jobs · March 2026*  
*For Project Future research archive*
