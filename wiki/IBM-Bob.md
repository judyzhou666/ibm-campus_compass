# IBM Bob: what each teammate must do

**IBM Bob** is IBM's AI coding assistant. It runs inside **Bob IDE** (a code editor) and helps us write, explain, test and review the project's code.

The lab guide says **Bob IDE is a mandatory part of the project**. To be judged, our repository must show real Bob work from **every** team member, as exported Bob session reports in the `bob_sessions/` folder.

Bob is a tool for **building** the project. The running website never calls Bob; the AI Planner uses IBM watsonx (see [Using watsonx](Using-watsonx)).

## Bobcoins

Each of us has our **own** provisioned Bob account with **150 Bobcoins**. Every Bob request uses some coins, and no more are given at 100%. Bobcoins are separate from the team's watsonx credits. Tips to save coins:

- Start a big task in **Plan** mode, then switch to **Code** mode to carry it out.
- Give Bob a clear, specific request, and point to files with `@` (for example `@backend/src/watsonx.rs`).
- Start a new task for a new topic instead of continuing a very long one.

## Step 1: Set up Bob IDE (one time only)

1. Find the **"Welcome to Bob!"** email (check Junk/Spam; search "IBM Bob").
2. Download and install **Bob IDE** from the link in that email.
3. Open Bob IDE and click **Log in to Bob**. Sign in with the **same IBMid** you registered for the lab with.
4. Open **Settings → General** and check the team is **ibm-skillsbuild-ell**. If you have a personal Bob account, switch to this team so you do not use your own coins.

## Step 2: Open the project in Bob

1. Download the project first: see [Getting started](Getting-Started), Parts 1–2.
2. In Bob IDE, choose **File → Open Folder** and select the `ibm-campus_compass` folder in your home folder.
3. Bob reads `AGENTS.md` for our project rules (Rust server, React/TypeScript website, fictional data only, honest "simulated" labels).
4. The `.bobignore` file stops Bob reading your private `.env` file. Still, **never paste an API key into a Bob chat**.

## Step 3: Do real work with Bob

Pick a task, ask Bob, **review its changes** before accepting, and run the tests. Ideas:

- Ask (Ask mode): "Explain how a message in the AI Planner travels from `frontend/src/api.ts` to `backend/src/lib.rs`."
- Plan, then Code: add AI-written reasons to each suggested event (the next planned watsonx feature).
- Ask Bob to run the checks in `docs/backend.md` and explain any failure.
- Use `/review` on your branch before opening a pull request.

Work on **your own branch** (see [Team workflow](Team-Workflow)), not on `main`.

## Step 4: Export your Bob sessions (required for judging)

Do this for **every** Bob task that relates to the project:

1. In Bob's chat, open **⋯ (Views and More Actions) → History**.
2. Make sure the workspace is this project (choose **All** if you used several).
3. Click a task to open it, then click the **task header** to show its usage summary.
4. Take a **screenshot** of that summary.
5. Click **Export task history** to save it as a Markdown (`.md`) file.
6. Put both files in `bob_sessions/<your name>/`, named like `2026-11-10-explain-planner.md` and `2026-11-10-explain-planner.png`.

Before you commit them, **open each file and check it contains no API key, token or password.** Then commit and push on your branch (see [Team workflow](Team-Workflow)).

More detail: [`bob_sessions/README.md`](https://github.com/judyzhou666/ibm-campus_compass/blob/main/bob_sessions/README.md) and [`docs/ibm-bob-setup.md`](https://github.com/judyzhou666/ibm-campus_compass/blob/main/docs/ibm-bob-setup.md).
