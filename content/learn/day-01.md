# Day 1 — A model call is a software boundary

## Agenda — 10 minutes

**Agenda:** understand what a language-model call does, make its inputs visible, inspect its output, and build a small application that reports success and failure honestly.

Today’s question: **“If an AI application gives a confident answer, what exactly have we proved?”**

You are building **Atlas**, a support assistant for a fictional software company. A customer asks, “How many active projects can I create on Atlas Basic?” An assistant replies, “You can create ten projects.” It sounds clear. But the current course fixture says **three**. Before changing the prompt, locate where the system could have gone wrong.

This is a constructed teaching example, not a measured output from a particular model. All Atlas policies in this lesson are synthetic.

### What you will learn

By the end of this lesson, you should be able to:

- **Explain inference:** distinguish using a trained model from changing its learned parameters.
- **Identify the components:** separate a model, a model repository, an inference provider and your application.
- **Trace a request:** describe how a user question becomes model input and how a response becomes an application result.
- **Use evidence:** compare supplied facts, missing facts and stale facts without treating confident wording as proof.
- **Recognise failure:** distinguish local configuration, authentication, timeout, response-shape and answer-quality failures.
- **Build and inspect:** run a small CLI, record a run ID and latency, and review five outcomes.

### Today’s sequence

| Stage | Time | Observable output |
|---|---:|---|
| Agenda and prediction | 10 min | A hypothesis about the wrong answer |
| Fundamentals | 45 min | A component diagram and six topic-level takeaways |
| Discussion | 25 min | A defended explanation of three failure cases |
| Three hands-on exercises | 75 min | Request map, answer comparison and failure ledger |
| Practice briefing and exit ticket | 25 min | A plan for the CLI assignment |

Finish the independent assignment in **60–90 minutes** after the guided session. Tokens, sampling controls and detailed context limits are tomorrow’s topics. Today, know that requests and responses have size limits; do not try to optimise them yet.

**Before starting:** you should be able to run a Python file, read a dictionary and recognise an exception. The offline lab needs only Python 3.9 or later. Live inference also needs the HF client, an account token and an instructor-verified model/provider route.

## Fundamentals — 45 minutes

**Fundamentals:** treat inference as one component in a software system with explicit input, output and failure behaviour.

**Vocabulary note:** **model inference** means running a trained model. A **lesson inference** below means a conclusion you can draw from an example. The two uses of “inference” are related to different activities.

### Topic 1 — Training and inference are different operations

**Keywords:** **training**, **parameters**, **inference**, **input**, **output**.

**Training** adjusts a model’s learned numerical parameters using a training procedure and data. **Inference** uses an already-trained model to produce an output for a supplied input. In our chat application, we send messages and receive generated text. The model’s parameters and the supplied messages both influence that text.

Suppose a model is like a reader who has already developed language skills. Giving that reader a new page changes what information is available for the current task. It does not automatically rewrite their education. This analogy is useful for the distinction, but it does not mean a model reasons or remembers exactly like a person.

```text
Training:  training data + optimisation → changed learned parameters
Inference: trained parameters + current input → generated output
```

**Worked example:** send “Atlas Basic allows three active projects” in a request. Then send a fresh request without that fact. Do not assume the second request knows the first. Your application must deliberately supply history or retrieve stored information if it wants the next call to use it.

**Inference to carry forward:** **supplying a fact in a prompt is not the same as training the model**. A service may separately store conversation data or have a data-use policy; that is distinct from claiming that each ordinary inference request updates the model’s weights.

<details>
<summary>Checkpoint 1 — Did the model learn our company policy permanently?</summary>

**Think first:** you included the three-project rule once. Can you remove it from every future request and rely on the same answer?

**Suggested answer:** no. The request supplied temporary task information. The application needs an explicit mechanism for supplying it again. Today that mechanism is a short fact string; later modules introduce retrieval and managed state.

</details>

### Topic 2 — A model is not the whole application

**Keywords:** **model**, **application**, **base model**, **instruction-tuned model**, **responsibility boundary**.

A **model** produces outputs from inputs. An **application** receives a user request, selects information, calls a model or service, checks the result and decides what to show. A failure in any of these steps can appear to the user as “the AI was wrong”.

A **base language model** is generally trained to continue text. An **instruction-tuned model** has further training intended to make it more useful for following instructions or conversational requests. This is a difference in training and intended behaviour; it does not establish that a model always obeys instructions or always knows the correct fact. Hugging Face’s [chat-template guide](https://huggingface.co/docs/transformers/chat_templating) explains the relationship between continuation, chat training and message formatting.

**Worked example:** two teams use the same instruction-tuned model. Team A sends the current Basic-plan limit and asks for a supported answer. Team B sends an outdated policy and does no checking. The outputs can differ because the **applications supplied different evidence**, even though the model name is identical.

| Responsibility | Owner in today’s application |
|---|---|
| Receive and validate a question | Our Python application |
| Choose the policy text | Our Python application |
| Run generation | The inference service running the model |
| Check whether a response contains usable text | Our Python application |
| Decide whether the answer matches the fixture | A learner’s review today; automated checks later |
| Present a failure clearly | Our Python application |

**Inference to carry forward:** **fix the component responsible for the error**. A better model cannot compensate for every missing input, stale document or application bug.

### Topic 3 — Prompt, context and evidence

**Keywords:** **prompt**, **instruction**, **context**, **evidence**, **grounding**, **abstention**.

The **prompt** is the input we construct to guide the model. An **instruction** says what task to perform. **Context** is information made available in that request. **Evidence** is the part of that information that can support a particular claim. Not all context is relevant evidence, and supplied evidence can itself be wrong or out of date.

**Grounding** means tying an answer to the supplied evidence. **Abstention** means declining to assert a fact when the available evidence does not establish it. A model can fail to abstain even when told to do so, so we must inspect its behaviour.

Use this current synthetic policy throughout Day 1:

```text
Source: atlas-plans-v2
Effective date: 2026-10-01
Atlas Basic supports 3 active projects per workspace.
Atlas Pro supports 20 active projects per workspace.
Archived projects do not count toward these limits.
```

**Worked comparison:** keep the same question and change only the supplied facts.

| Case | Supplied context | What a supported answer should do |
|---|---|---|
| Current facts | The v2 policy above | Say Basic permits three active projects per workspace. |
| Missing facts | “Atlas is project-management software.” | State that the limit is not provided. |
| Stale facts | A v1 policy saying Basic permits five, explicitly expired on 2026-09-30 | Do not assert five as the current limit on 2026-11-02. Explain that current evidence is missing. |

These are **expected behaviours**, not guaranteed model responses. Keep the actual output, even if the model guesses correctly with no supporting context. A lucky correct number is not evidence that your process will generalise.

**Inference to carry forward:** **a supported answer depends on the question, relevant evidence and its applicability**. “Use only the facts” is a useful instruction, but it is not a proof that the result is supported.

<details>
<summary>Checkpoint 2 — Correct number, missing evidence</summary>

**Think first:** the missing-facts request returns “three”. Should you mark the evidence check as passed?

**Suggested answer:** no. It matches the fixture by value, but the supplied context did not justify that number. Record factual agreement and evidence support separately. The desired behaviour for this controlled missing-evidence case is to say that the information is unavailable.

</details>

### Topic 4 — Where Hugging Face fits

**Keywords:** **Hub**, **model ID**, **provider**, **endpoint**, **client SDK**, **authentication**.

The **Hub** hosts model repositories and related information. A **model ID** identifies a repository/model; it does not by itself prove that a provider currently serves it. An **inference provider** operates a service that runs supported models. An **endpoint** is a network address through which an application calls a service. The **client SDK** is a library that helps construct and send those calls. HF Inference Providers exposes supported routes through a common client interface. See the [official providers documentation](https://huggingface.co/docs/inference-providers/index).

For this course, keep four configuration values distinct: the HF token, the selected model, the selected provider and the request timeout. A token authenticates access; it is not the model and not a prompt parameter. Check that the selected route supports the task you want.

**Worked analogy:** a model repository is like a catalogue entry for an engine; an inference service is an operating engine you can send work to. Finding the catalogue entry does not mean you have already arranged a running service.

```text
Learner's CLI
    → HF client library
    → HF routing/service boundary
    → selected provider running the model
    → response to the CLI
    → application checks
    → displayed result
```

**Inference to carry forward:** **“the model exists” and “this request can run” are different claims**. Check availability, access and task support before diagnosing a prompt.

### Topic 5 — A model call is a software boundary

**Keywords:** **request**, **response**, **contract**, **timeout**, **validation**, **failure category**.

A **software boundary** is a point where one component relies on another component’s interface. Here, Python calls a remote service. We control the request we send, but cannot assume the service is reachable, accepts our configuration or returns the content we expected.

A **contract** states what we send, what we accept back and how we represent failure. Today’s contract is deliberately small: send a list of messages; expect one non-empty text answer; otherwise return a labelled error. Checking answer meaning is an additional step.

| Layer | Question to ask | Example failure | First useful response |
|---|---|---|---|
| Local configuration | Can we construct a valid request? | Required environment variable missing | Fix configuration before making a network call. |
| Authentication / access | May this caller use the service? | HTTP 401 or 403 | Inspect credentials, permissions and model access. |
| Service / network | Did the call complete? | Timeout, rate limit or service error | Record the category and inspect service conditions. |
| Response shape | Did we receive usable text? | Empty content or missing expected fields | Report a response error; do not silently call it a good answer. |
| Answer meaning | Is the content supported and useful? | “Ten projects” despite current evidence saying three | Review the evidence, instruction and output. |

**Worked example:** an authentication error occurs before the model produces an answer. Editing the wording of “How many projects?” will not repair that credential problem. Conversely, a successful response containing a wrong number is not repaired merely by retrying the HTTP request.

**Timeout nuance:** a client timing out means it did not receive a usable response within the relevant wait. It does not prove that the remote server performed no work. Some SDK timeout errors can also cover unavailability; do not infer a more precise cause than the evidence supports. Check the [HF client’s documented error behaviour](https://huggingface.co/docs/huggingface_hub/package_reference/inference_client).

**Inference to carry forward:** **transport success, response-shape success and answer correctness are separate checks**. HTTP 200 is not a fact-check.

<details>
<summary>Checkpoint 3 — Three outputs, three diagnoses</summary>

**Think first:** classify (A) a missing token before any call, (B) a request that times out, and (C) a normal text response saying ten projects.

**Suggested answer:** A is local configuration; B is a timeout/unavailability category until further evidence narrows it; C is an answer-quality problem if the current three-project policy was provided. Do not assign all three the label “hallucination”.

</details>

### Topic 6 — Record enough information to explain a run

**Keywords:** **run ID**, **latency**, **metadata**, **observability**, **provenance**.

A **run ID** identifies one application attempt. **Latency** measures elapsed time across a stated boundary. **Metadata** describes the run: case, mode, model/provider, prompt version and status. **Provenance** records where the supplied facts came from. **Observability** begins with being able to connect an outcome to the steps and inputs that produced it; later modules add spans and dashboards.

An application run ID is not necessarily the provider’s request or response ID. Record them as distinct fields if both are available. A fast result can be wrong, and a slow result can be well supported. Do not mix timing with answer quality in one vague “success score”.

**Worked record:** the bundled lab prints an answer for inspection and appends safe metadata to `runs.jsonl`. It records `quality_review: pending`: returning text has not completed the learner’s fact check. It does not log **API tokens**, raw HTTP errors or the full prompt. An API token is a credential; the **text tokens** introduced tomorrow are units of model input and output. Keep these two meanings distinct.

**Inference to carry forward:** **if you cannot identify the request, configuration and source, you cannot explain an observed difference reliably**. A small structured ledger is enough to start.

## Discussion on fundamentals — 25 minutes

**Discussion:** predict individually for two minutes, discuss in pairs for eight, compare explanations as a group for ten, and revise your original prediction for five. Reason from visible inputs and outputs.

| Question | What a strong answer distinguishes |
|---|---|
| The same model gives different answers in two products. Why? | Evidence, message history, prompt, generation settings and application handling can differ. |
| Does sending a company fact train the model? | Temporary inference input versus parameter updates; explicit application memory versus assumptions. |
| The answer is correct but no source was supplied. Is our evidence policy satisfied? | Factual agreement versus support in the provided context. |
| Should every failed call be retried immediately? | Configuration and permission failures versus potentially transient conditions; retries can repeat work. |
| The old policy says five projects. What is the current answer? | Historical evidence versus evidence applicable to the requested date. |

**Discussion artifact:** write three sentences: “We observed …”, “That supports …”, and “That does not establish …”. This trains careful inference without overclaiming.

<details>
<summary>Worked discussion — A fluent but unsupported answer</summary>

**We observed:** the missing-facts request produced a readable answer with a numerical limit.

**That supports:** the service returned text that the application could display.

**That does not establish:** the limit was supported by the supplied facts, the policy was current, or another missing-facts question will be answered reliably.

</details>

## Hands-on — three exercises, 25 minutes each

**Hands-on:** reproduce the mechanism, change one input, then diagnose controlled failures. Work from the course folder containing `day-01-lab.py`.

### Exercise A — Trace and run the smallest application

**Goal:** connect code to the request diagram. Use the offline mode first; it returns instructor-authored responses and makes **no model call**.

```sh
python3 day-01-lab.py --mode demo --case current
```

**Steps:** spend five minutes finding `build_messages`, `demo_answer`, `live_answer` and `run_case` in the script. Spend ten minutes drawing the request/response path and annotating each function’s responsibility. Spend ten minutes running the command and inspecting its JSON output and the new line in `runs.jsonl`.

**Look for:** `mode` is `demo`, `simulated` is `true`, `status` is `ok`, `quality_review` is `pending`, and the displayed fixture answer identifies the three-project limit. The run ID and measured local elapsed time vary; the scripted answer is deterministic.

**Inference:** a working offline adapter can test your application’s control flow. It cannot establish a real model’s quality, latency, authentication or availability. Never mix its timing into a live-inference comparison.

**Deliverable:** a labelled diagram plus a short explanation of why `status: ok` still leaves a quality review pending.

### Exercise B — Change the evidence and observe the answer

**Goal:** compare current, missing and stale evidence while keeping the question and instruction fixed.

```sh
python3 day-01-lab.py --mode demo --case current
python3 day-01-lab.py --mode demo --case missing
python3 day-01-lab.py --mode demo --case stale
```

These runs show the **expected policy behaviour** of the fixtures. For an actual model experiment, use the live mode below after the instructor has verified the route. Predict before running: current evidence should support “three”; missing or expired evidence should not support a current limit.

**Live setup:** create a project environment and install the client. The instructor should freeze the tested version for the cohort.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install huggingface_hub
```

Supply `HF_TOKEN` through a secure environment or password-manager workflow. Set `HF_CHAT_MODEL` to a currently served chat model and `HF_PROVIDER` to the compatible provider verified by your instructor. No fixed model/provider pair is promised by this material; availability and access vary. Do not paste a real token into the lesson or commit it. The code checks these values before attempting inference.

```sh
python day-01-lab.py --mode live --case current
python day-01-lab.py --mode live --case missing
python day-01-lab.py --mode live --case stale
```

**What the model receives:** `build_messages` makes a system instruction and a user message containing today’s fixed course date, the selected facts and the same Basic-plan question. In live mode, `InferenceClient` sends that message list using the configured route, a 30-second client timeout and a 128-text-token output limit. We inspect response text rather than demanding JSON from the model; the **Python application** produces the surrounding JSON record. Message-list inference is documented in [HF chat completion](https://huggingface.co/docs/inference-providers/tasks/chat-completion).

| Case | Prediction | Actual answer | Supported? | Appropriate abstention? | Mode |
|---|---|---|---|---|---|
| Current | Three active projects | Fill after running | Yes / no / uncertain | Not required | Demo or live |
| Missing | Limit unavailable | Fill after running | Yes / no / uncertain | Yes / no | Demo or live |
| Stale | Current limit unverified | Fill after running | Yes / no / uncertain | Yes / no | Demo or live |

**Inference:** the instruction can be unchanged while the answer’s evidence changes. Diagnose what information was available before blaming the model’s name.

**Deliverable:** the filled table and one paragraph separating what the experiment showed from what it did not. If live access is unavailable, submit the demo exercise labelled **simulation** and schedule the live run; do not claim to have tested model behaviour.

### Exercise C — Inject and classify failures

**Goal:** see different failure categories without breaking a real service. All fault flags are available only in demo mode.

```sh
python3 day-01-lab.py --mode demo --case current --fault auth
python3 day-01-lab.py --mode demo --case current --fault timeout
python3 day-01-lab.py --mode demo --case current --fault empty
```

**Steps:** predict which layer each flag represents. Run the three commands. Compare `error_category`, `status`, `answer` and `quality_review`. The commands intentionally return a nonzero exit code for errors. Explain why that is useful for a script or test runner. The simulated auth case is not proof that actual HF credentials work or fail.

**Expected observations:** auth produces `authentication`; timeout produces `timeout_or_unavailable`; empty content produces `invalid_response`. All have `status: error`, no answer and a quality review of `not_applicable`. Every attempt receives its own run ID.

**Inference:** failure categories guide different next actions. Adjusting a prompt does not resolve every failure, and an empty response should not quietly become an empty “successful” answer.

**Deliverable:** three ledger rows plus a next-action explanation for each. Do not intentionally cause real rate limits or expose a real token to reproduce a failure.

## Practice problem — 25-minute briefing, 60–90-minute independent implementation

**Practice problem:** extend the starter into an **Atlas answer inspector**. A teammate should be able to run a selected case, see its answer or a labelled error, locate its ledger entry and record whether the answer was actually supported.

**Required behaviour:** preserve the separate demo/live modes and current/missing/stale fixtures. Add a `--question` argument for live requests so a learner can ask another question about the same supplied policy. Keep demo fixtures explicit: either reject unsupported custom questions or label their responses as scripted rather than pretending to answer arbitrary input. Add a separate review file with `run_id`, `factual_agreement`, `evidence_support`, `reviewer_note` and the reviewer’s chosen result.

**Test questions:** “Does Basic allow three or five active projects?”, “Do archived projects count?”, and “What is Atlas’s refund period?” The current fixture supports the first two. It does not establish a refund period. Do not add refund information merely to make all questions answerable.

### Acceptance criteria

- Produce at least **five distinct runs**: current facts, missing facts, stale facts, simulated auth failure and simulated timeout. Keep `mode` in every record.
- A returned answer has `status: ok` only after the basic non-empty-text check. Its semantic quality remains a separate review.
- Missing environment values are reported before a live network request. Injected fault flags cannot accidentally run against the live service.
- Every run has a unique **run ID**, UTC timestamp, latency, case, source version, prompt version and requested route metadata.
- Error records do not contain API tokens, request headers or raw exception messages. Do not label every unknown provider error as authentication or timeout.
- Review the current, missing and stale answers against the fixture and applicable date. Preserve unexpected results.
- A teammate can reproduce the demo runs from your README. Identify live runs separately and state the model/provider used.

### Submission

Submit the extended script, `runs.jsonl`, a separate review file, the component diagram, the three-case comparison and a README with one known limitation. A short learning note is enough today; the publishable module blog is due at the end of Day 5.

**Stretch task:** introduce a synthetic “wrong answer” demo fixture that returns ten projects while passing the text-shape check. Show how your separate review catches it. Do not add a vector database, an agent framework or retries today.

<details>
<summary>Hint ladder — Open only after attempting the assignment</summary>

**Hint 1:** change the question inside `build_messages`, not inside the ledger writer. The ledger should describe the request, not decide its content.

**Hint 2:** an answer and an error should have mutually exclusive shapes. Keep an error’s answer empty and its failure category explicit.

**Hint 3:** use the run ID to join review records to run metadata. Do not change a model’s answer after reviewing it; preserve what was actually produced.

</details>

## What we learned in this lesson

| Topic | Highlighted keyword | Inference you should now be able to explain |
|---|---|---|
| Training versus use | **Inference** | Providing context for one call does not itself update learned parameters. |
| Model versus product | **Application responsibility** | Source selection, validation and failure handling belong to the application. |
| Instructions and facts | **Evidence** | The same question needs a different response when support is missing or expired. |
| Hosted access | **Provider** | A Hub model ID is not a guarantee of a working inference route. |
| Network boundary | **Contract** | Request success, usable response shape and supported meaning are distinct. |
| Investigating behaviour | **Run ID** | A result needs configuration and provenance to be explained or compared. |

### Exit ticket

Before marking Day 1 complete, answer in your own words:

- What is the difference between changing a prompt and training a model?
- Draw the boundary between your application and the inference service.
- What can an HTTP success tell you, and what can it not tell you?
- Which evidence would you inspect if a current-policy question received an old answer?
- Show one run and distinguish its execution status from its answer-quality review.

<details>
<summary>Suggested exit-ticket answers</summary>

**Prompt versus training:** changing a prompt changes the current input; training changes learned parameters through a separate procedure.

**Boundary:** the application builds messages, calls the client/service, checks the response and decides what to present. The service runs the requested inference task on a supported route.

**HTTP success:** it indicates success at the HTTP/API layer as defined by that service. It does not prove that the answer’s facts, date, relevance or evidence support are correct.

**Old answer:** inspect the actual source text, source version, applicable date, prompt and response before changing the model. The application may have selected stale data.

**Run versus quality:** `status: ok` means our basic execution/response contract passed; `quality_review: pending` leaves factual agreement and evidence support for a separate check.

</details>

## Conclusion

An AI application becomes easier to build when a model call is treated as a boundary with explicit responsibilities. You choose the task and evidence, request inference, inspect the result and handle failure. The useful engineering question is not only “Did the model answer?” but **“What evidence and checks justify presenting this answer?”**

Today you built the first part of Atlas: a small, inspectable request-to-result path. **Tomorrow:** learn how messages become text tokens, why character counts are unreliable for budgeting, and how generation settings affect the output. Bring one short English paragraph, one code snippet and one mixed-language sentence to compare.

### Sources and implementation status

The explanations and synthetic examples are original teaching material. The HF integration follows the official [Inference Providers overview](https://huggingface.co/docs/inference-providers/index), [InferenceClient reference](https://huggingface.co/docs/huggingface_hub/package_reference/inference_client), [HTTP error reference](https://huggingface.co/docs/huggingface_hub/package_reference/utilities), [chat-completion documentation](https://huggingface.co/docs/inference-providers/tasks/chat-completion) and [chat-template explanation](https://huggingface.co/docs/transformers/chat_templating). Review the relevant excerpts rather than the entire sites.

The demo scenarios are executable offline fixtures. Their responses are authored, not generated, and their elapsed times measure local code only. The live HF path is provided for learner execution; no paid inference calls or credentials were used to produce this lesson. Model/provider availability and package compatibility must be verified for the cohort.
