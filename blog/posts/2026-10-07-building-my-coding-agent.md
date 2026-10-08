# Building my coding agent: memory, tools, and the execution loop

My Python coding-agent project started with one chat request. Over the first few
sessions, it grew into a loop that can execute tools and send their results back
to the model. This is the first entry in a daily record of what I build, learn,
and verify along the way.

## Memory starts with messages

The original CLI treated each input as a fresh conversation. My `Memory` class
now keeps user and assistant messages in order throughout a running session.
The next model request includes that history, so the conversation can refer to
earlier turns.

For tool use, the history also needs the assistant's requested calls and the
corresponding results. A tool-call ID connects each result to its request.

This is still in-memory history. Restarting the process clears it. I discussed
JSON session files as the next step, but disk persistence is not implemented yet.

## Tools turn suggestions into actions

The harness has five tools:

- `list_files` discovers immediate entries inside a workspace directory.
- `read_file` retrieves a file's contents.
- `write_file` creates a UTF-8 file or replaces it with an explicit overwrite option.
- `run_shell` executes a command and captures its output and exit code.
- `search_files` uses ripgrep to search file contents recursively, with an optional filename filter.

The registry associates each Python function with a schema describing its name
and arguments. The model sees those schemas; the dispatcher parses the requested
arguments and calls the registered function.

I kept the first implementation small so I could follow the control flow. It
has basic error results, a limit on tool rounds, and a shell timeout. Some tools
can access paths outside the project when the process has permission; the harness
does not provide execution isolation.

## Who makes the next model call?

This was the most useful idea to make explicit: the Python loop controls the
next request. The model proposes a tool call, and the harness does the work.

```text
Send history and tool schemas to the model
    ↓
Save the assistant's requested tool calls
    ↓
Execute each tool and save its result
    ↓
Send the updated history on the next loop iteration
    ↓
Print the final answer, or stop at the round limit
```

The tool result is part of the next request's context. It is not the final
answer: the model still has to interpret it and decide whether more work is needed.

## What I checked

Offline checks exercised multiple tool calls, matching result IDs, follow-up
history, dispatch errors, and the round limit using mocked model responses.
Direct tool checks covered:

- File creation, overwrite behavior, and writing outside the workspace.
- Shell stdout, stderr, exit codes, working directory, and process timeout.
- Recursive text search, filename filters, hidden files, invalid regexes, and output truncation.

These checks establish local behavior. They do not establish reliability with
the hosted model. A saved live model → tool → model trace and a repeatable coding
task are still needed.

## Next session

I want to capture one complete live tool-call trace, then use it to understand
where failures occur. After that, I will add persistent conversation memory.

This blog will track each working day's changes, observations, actual checks,
and next step. When something fails, that belongs in the log too.
