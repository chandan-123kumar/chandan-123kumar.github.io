# Day 1 — A model call is a software boundary

## Agenda — 10 minutes

**Today’s goal:** send a question to a model, inspect the answer and handle failures clearly.

You are building **Atlas**, a support assistant for a fictional company. A customer asks how many active projects the Basic plan allows. The assistant says ten; the current policy says **three**. Where did the error happen?

By the end, you will be able to trace a request, check its evidence and explain a failed call.

| Stage | Time | Output |
|---|---:|---|
| Agenda | 10 min | Predict a cause of the wrong answer |
| Fundamentals | 45 min | Draw the application’s components |
| Discussion | 25 min | Explain three failure cases |
| Hands-on | 75 min | Run three exercises |
| Practice briefing and review | 25 min | Plan your assignment |

**You need:** Python 3.9+, basic dictionaries and exceptions. Start offline; live inference also needs a Hugging Face token and a verified model/provider route. Independent practice takes **60–90 minutes**.

## Fundamentals — 45 minutes

### 1. Training vs inference

**Training** changes a model’s learned parameters. **Inference** uses those parameters and your input to produce an output.

```text
Training:  data + optimisation → updated parameters
Inference: trained model + input → output
```

Adding “Basic allows three projects” to a prompt supplies information for that request. It does not train the model. A fresh call needs that information again, through context, history or retrieval.

### 2. Model vs application

The **model** generates an output. Your **application** chooses the evidence, builds the request, checks the response and decides what to display.

An instruction-tuned model is trained to follow requests, but can still make mistakes. Two applications using the same model can give different answers because they supply different facts or instructions.

```text
Question → application selects facts → model call
         → application checks response → displayed result
```

**Takeaway:** locate the failing step before changing the model.

### 3. Prompt, context and evidence

- **Prompt:** the input sent to the model, including instructions and context.
- **Context:** information available in the request.
- **Evidence:** information that supports a specific claim.
- **Grounding:** tying an answer to evidence.
- **Abstention:** saying the available information does not establish an answer.

Use this fictional policy throughout the lesson:

```text
Source: atlas-plans-v2
Effective from: 2026-10-01
Basic: 3 active projects per workspace
Pro: 20 active projects per workspace
Archived projects do not count toward these limits.
```

The lab uses a fixed exercise date of **2026-11-02**.

| Evidence supplied | Expected answer to the Basic-plan question |
|---|---|
| Current policy above | Three active projects per workspace |
| No plan limits | The limit is not provided |
| Old policy: five projects, expired 2026-09-30 | The current limit cannot be verified |

These are expected behaviours, not guaranteed model outputs. A correct guess without evidence still fails the evidence check.

### 4. Where Hugging Face fits

| Component | Role |
|---|---|
| Hub / model ID | Identifies a model repository |
| Inference provider | Runs supported models as a service |
| Endpoint | Network address used to call a service |
| Client SDK | Library used to send requests |
| API token | Credential used to authenticate access |

```text
Your Python app → HF client → selected provider → model → response
```

A model’s presence on the Hub does not guarantee a working inference route. Verify the model, provider, access and task support before a live run.

### 5. Check three things separately

A model call crosses a **software boundary**: your application depends on another service. Define what you send, what you accept and how failures appear.

1. **Execution:** did the call complete?
2. **Response shape:** did it return non-empty text?
3. **Answer quality:** is that text correct and supported?

| Failure | First action |
|---|---|
| Missing configuration | Set required values before calling the service |
| Authentication or permission error | Check credentials and access |
| Timeout or service error | Record the category and investigate availability |
| Empty or malformed response | Report an invalid response |
| Wrong or unsupported answer | Inspect the evidence, instruction and output |

**HTTP success is not a fact-check.** A timeout also does not prove the server did no work, so retries need care.

### 6. Keep a run record

Record a **run ID**, timestamp, mode, case, model/provider, source version, prompt version, latency and status. This connects each outcome to its inputs and configuration.

The lab appends metadata to `runs.jsonl`. A returned answer has `quality_review: pending` until you inspect it. Keep API tokens, request headers and raw exception messages out of logs.

## Discussion — 25 minutes

Discuss these questions, then write one sentence for each answer:

1. Two products use the same model but give different answers. What inputs would you compare?
2. A response says “three” with no supporting facts. What passed, and what failed?
3. How would you handle a missing token, a timeout and a wrong answer differently?

Use this structure: **“We observed … This supports … It does not prove …”**

## Hands-on — 75 minutes

Download `day-01-lab.py` using the lesson’s download button. Run commands from its folder. Each exercise takes about 25 minutes.

### Exercise A — Trace one request

Start with the offline demo. Its answers are scripted; it makes no model call.

```sh
python3 day-01-lab.py --mode demo --case current
```

Find `build_messages`, `demo_answer`, `live_answer` and `run_case` in the code. Draw how a question travels through these functions to the displayed result.

Inspect the JSON output and `runs.jsonl`. Expect:

- `mode: demo` and `simulated: true`
- `status: ok` and `quality_review: pending`
- An answer giving the three-project limit

**Deliver:** your diagram and one sentence explaining why `ok` does not mean “fact-checked”. Demo timing measures local code, not model latency.

### Exercise B — Change the evidence

Keep the question fixed and run all three cases:

```sh
python3 day-01-lab.py --mode demo --case current
python3 day-01-lab.py --mode demo --case missing
python3 day-01-lab.py --mode demo --case stale
```

Predict each answer before running. Then complete this table:

| Case | Actual answer | Supported by supplied facts? | Mode |
|---|---|---|---|
| Current | | | |
| Missing | | | |
| Stale | | | |

**Deliver:** the table and two sentences explaining what changed. Label demo results as simulations.

<details>
<summary>Live experiment — after your instructor verifies access</summary>

Create an environment and install the client version tested by your instructor:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install huggingface_hub
```

Set `HF_TOKEN` securely, plus `HF_CHAT_MODEL` and `HF_PROVIDER` for the verified route. Keep your token out of source files and commits.

```sh
python day-01-lab.py --mode live --case current
python day-01-lab.py --mode live --case missing
python day-01-lab.py --mode live --case stale
```

The client sends an instruction, the exercise date, selected facts and question. It uses a 30-second timeout and a 128-text-token output limit. The model returns text; Python creates the JSON run record.

Record actual outputs, including unexpected ones. Keep live results and timing separate from demo results. If access is unavailable, complete the demo and mark the live experiment as pending.

</details>

### Exercise C — Classify failures

Inject three offline failures:

```sh
python3 day-01-lab.py --mode demo --case current --fault auth
python3 day-01-lab.py --mode demo --case current --fault timeout
python3 day-01-lab.py --mode demo --case current --fault empty
```

| Fault | Expected `error_category` |
|---|---|
| `auth` | `authentication` |
| `timeout` | `timeout_or_unavailable` |
| `empty` | `invalid_response` |

Each run should have `status: error`, no answer, `quality_review: not_applicable` and a unique run ID. Error commands intentionally return a nonzero exit code.

**Deliver:** three ledger rows and the next action for each failure. Fault injection is demo-only.

## Practice — Build an answer inspector

Extend the starter so a teammate can ask a policy question, inspect the result and record a quality review.

**Time:** 25-minute briefing, then 60–90 minutes independently.

### What to build

- Add `--question` for live requests. For custom demo questions, reject them or clearly label the response as scripted.
- Preserve demo/live modes, all three evidence cases and demo-only faults.
- Save reviews separately with `run_id`, `factual_agreement`, `evidence_support`, `reviewer_note` and a review result.
- Preserve the starter’s run metadata, non-empty-text validation and safe error handling. Check configuration before making live calls.

Try: “Does Basic allow three or five active projects?”, “Do archived projects count?” and “What is Atlas’s refund period?” The current policy supports the first two; it provides no refund information.

### What to submit

Submit the script, `runs.jsonl`, review file, component diagram, three-case comparison and a short README with run commands and one known limitation.

Include at least **five runs**: current, missing, stale, simulated auth failure and simulated timeout. Review all three evidence cases, preserve unexpected answers and identify any live model/provider used.

**Stretch:** add a demo answer saying “ten projects”. Show that it passes the text check but fails your quality review.

<details>
<summary>Hints</summary>

- Change the question in `build_messages`.
- Keep answers and errors mutually exclusive.
- Join reviews to runs using `run_id`; preserve the original output.

</details>

## Review — Before you finish

Explain these three points in your own words:

1. Why does adding a fact to a prompt differ from training?
2. Which steps belong to your application, and which belong to the inference service?
3. How can a run succeed while its answer fails the evidence check?

Save one lab example in your learning journal, then complete the knowledge check below.

**Tomorrow:** text tokens, context limits and generation settings. The module blog is due at the end of Day 5.

<details>
<summary>Official references and lab status</summary>

For live setup, consult Hugging Face’s [Inference Providers overview](https://huggingface.co/docs/inference-providers/index), [InferenceClient reference](https://huggingface.co/docs/huggingface_hub/package_reference/inference_client) and [chat-completion guide](https://huggingface.co/docs/inference-providers/tasks/chat-completion). For model formatting, see [chat templates](https://huggingface.co/docs/transformers/chat_templating).

All Atlas policies and demo responses are authored teaching fixtures. The live path is provided for learner execution; no paid inference calls were used to produce this lesson. The instructor must verify model/provider availability and package compatibility.

</details>
