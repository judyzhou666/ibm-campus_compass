# Doris — Bob Task Session Exports

This folder contains Doris's real Bob IDE task exports for the Campus Compass project,
following the same conventions as `bob_sessions/Judy/` and `bob_sessions/Tingting/`.

## How to add exports

Bob IDE task exports cannot be generated programmatically from within a running task.
They must be exported manually through the Bob IDE UI:

1. In Bob IDE's chat, open **Views and More Actions → History**.
2. Confirm the workspace is this repository (choose **All** if tasks span several workspaces).
3. Open each project-related task and select its **task header** to show the consumption summary.
4. Take a **screenshot** of the consumption summary.
5. Select **Export task history** to download the task as Markdown or JSON.
6. Repeat for every Campus Compass–related task.

Place each exported file here using the naming convention from `bob_sessions/README.md`:

```
YYYY-MM-DD-short-task-name.md
YYYY-MM-DD-short-task-name.png
```

or the JSON format used by Tingting:

```
bob-task-<uuid>-YYYY-MM-DD.json
```

## Important

- Do **not** write, edit, or recreate session files by hand.
- Check exports for API keys, IAM tokens, or project IDs before committing.
- Make sure Bob is on the provisioned team **ibm-skillsbuild-ell** (Settings → General).

This folder contains genuine IBM Bob task-history exports from Doris's Campus Compass development sessions. Additional session exports will be added as future tasks are completed.
