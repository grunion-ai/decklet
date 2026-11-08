# Authoring benchmark

Does an agent that follows `SKILL.md` reach `FINALIZE PASS` on attempt 1, with the deck the prompt asked for? Rerun it on every SKILL.md change and compare the numbers.

## What a case checks

`manifest.json` holds five cases: a pitch, a quarterly business review, a one-page document, a 4:5 carousel and a twelve-vendor competitive landscape. Each case has a frozen prompt in `prompts/` and semantic keys the scorer checks on the candidate's `model.json`:

| key | the candidate must |
|---|---|
| `format` | name this format |
| `density` | (in the prompt) build at this density |
| `slides` | have between `[min, max]` slides |
| `entities` | list every one of these companies in `deck.entities` |
| `counts` | carry at least this many `chart`, `logo`, `donut` or `img` rows |

A row passes only when `finalize` passes (validate `--strict`, create, verify `--strict`) and no semantic key misses. A deck that renders but drops a required vendor fails, and so does a faithful deck that `finalize` rejects.

## Fair-run protocol

1. Run every configuration on the same commit, prompt set, time limit and tool access. Record the agent and model names in `run.json`.
2. Run the agent from an installed copy of decklet (plugin or `npx skills add`), never from this repository, so it sees what users see and never sees these cases or the references.
3. Give it the prompt and, for a case with `inputs`, a copy of that folder in its working directory.
4. One complete agent invocation is attempt 1. Freeze its `model.json` (and `style.json`, if any) into `<run-dir>/<case>/` when it ends. Later attempts never replace it.
5. Write `run.json`: `{agent, model, cases: {<id>: {minutes, repairs}}}`, with repairs counted from the transcript (runs of finalize or verify after the first).
6. Score it and keep the result:

```bash
node benchmarks/authoring/benchmark.mjs check
node benchmarks/authoring/benchmark.mjs score <run-dir> --out benchmarks/authoring/results/<date>-<agent>-<model>.json
```

The script never launches a model; the runner owns models, credentials, timing and transcripts.

## References

`reference/` holds one hand-built candidate per case. They prove the scorer and the cases are wired (test/benchmark.test.mjs scores them), and `run.json` marks them `"evidence": false`. They are never benchmark results.
