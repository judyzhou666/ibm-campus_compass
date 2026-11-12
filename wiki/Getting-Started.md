# Getting started: run Campus Compass on your own computer

This page is for everyone on the team, with or without a coding background. Follow the parts in order. Each grey box is a command: copy it, paste it into **Terminal**, and press **Return** (Enter).

The basic demo needs **no IBM account, no password and no API key**. Connecting the AI Planner to IBM watsonx is optional and explained on the [Using watsonx](Using-watsonx) page.

> **Words you will see**
> - **Terminal**: the app where you type commands. On a Mac, press ⌘ Space, type `Terminal`, press Return.
> - **Repository (repo)**: the project folder, stored on GitHub.
> - **Branch**: your own copy of the project inside the repo (`Judy`, `Doris`, `Bella`, `Tingting`). `main` is the shared, finished version.
> - **Server**: the program on your computer that runs the website. It keeps running in Terminal until you stop it.

---

## Part 1: Install the tools (one time only, about 15 minutes)

These steps are for a **Mac**. Windows users: see [Windows notes](#windows-notes) at the bottom.

**1. Install Homebrew** (an installer for developer tools). Paste this, press Return, and enter your Mac login password when asked. Nothing appears while you type the password; that is normal.

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

When it finishes, it may print "Next steps" with two or three commands. Copy and run those too.

**2. Install Git, Node.js and the GitHub tool:**

```sh
brew install git node gh
```

**3. Install Rust** (the language our server is written in). When it asks, press Return to choose the default option.

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**4. Close Terminal completely (⌘ Q) and open it again.** New tools are only found in a fresh Terminal window.

**5. Check everything is installed.** Each command should print a version number, not "command not found":

```sh
git --version
node --version
cargo --version
```

`node --version` must be **v22.12** or newer.

---

## Part 2: Download the project (one time only)

**1. Sign in to GitHub** from Terminal. Choose **GitHub.com**, **HTTPS**, **Yes** to authenticate Git, and **Login with a web browser**. Copy the code it shows and paste it on the page that opens.

```sh
gh auth login
```

**2. Download the project** into your home folder and move into it:

```sh
cd ~
gh repo clone judyzhou666/ibm-campus_compass
cd ibm-campus_compass
```

**3. Install the website's building blocks** (takes a minute):

```sh
npm ci
```

---

## Part 3: Start the website

Every time you want to use the app, open Terminal and run these three commands:

```sh
cd ~/ibm-campus_compass
npm run build
cargo run --locked
```

The first `cargo run` takes a few minutes because it builds the server. When it is ready you will see:

```
Campus Compass: http://127.0.0.1:4173 (Rust backend, simulated planner)
```

Now open **http://127.0.0.1:4173** in Chrome, Safari or Edge.

**Leave this Terminal window open** while you use the website. Closing it stops the website.

**To stop the website:** click the Terminal window and press **Control + C**.

---

## Part 4: Try the demo

1. Go to **Settings → Reset demo** to start from a clean sample student.
2. Open **AI Planner**. Click the example "AI and education on Tuesday or Thursday afternoons", or type your own request, such as "a social event with free food on Wednesday".
3. Under the chat you will see which planner answered:
   - **Rust planner · Simulated**: the built-in rules (the normal demo).
   - **Rust planner · IBM watsonx**: IBM's Granite AI model (only if you set up [watsonx](Using-watsonx)).
   - **Browser fallback · Simulated**: the server is not running; the page uses a backup copy of the rules.
4. Click **My calendar** (top right) to see your week beside the chat. Use **View details** or **Add to calendar** on a suggested event. Events marked **RSVP required** ask for a demo name and attendance tick first.
5. For a guided story, follow `docs/demo-script.md`: type "AI career social 3 events after 1 PM" in the AI Planner and add events one at a time.
6. Try **Simulate event cancellation → Find a replacement**, then export your calendar from **My Calendar**.

Everything is fictional: the events, the students and the demo week (October 19–23, 2026, Eastern Time). Nothing is sent to a real calendar, and no real RSVP is made.

---

## Part 5: Get the latest version from the team

Before you start working each day, update your copy:

```sh
cd ~/ibm-campus_compass
git switch main
git pull
npm ci
npm run build
```

Then start the website again (Part 3). To work on your own branch instead, see [Team workflow](Team-Workflow).

---

## Troubleshooting

| What you see | What it means and what to do |
| --- | --- |
| `command not found: cargo` (or `node`, `git`) | Terminal was opened before the tool was installed. Quit Terminal (⌘ Q), open it again and retry. If it still fails, redo that step in Part 1. |
| `Address already in use` | The website is already running in another Terminal window or tab. Use that one, or find it and press Control + C, then start again. |
| The page at 127.0.0.1:4173 is blank or "not found" | Run `npm run build`, then start the server again. |
| The page will not load at all | The server is not running. Check the Terminal window from Part 3 is still open and shows the `Campus Compass: http://127.0.0.1:4173` line. |
| Chat shows **Browser fallback · Simulated** | The page cannot reach the server. Start it (Part 3) and refresh the page. |
| "I'm a limited demo planner…" | The planner did not recognise your message. Include an interest (AI, career, social, arts, wellbeing) and a day or time. |
| `npm ci` fails with an engine or version error | Your Node.js is too old. Run `brew upgrade node`, reopen Terminal, and retry. |

Still stuck? Copy the **error text** (never a password or API key) into the team chat.

---

## Windows notes

1. Install **Git for Windows** from https://git-scm.com/download/win (accept the defaults).
2. Install **Node.js LTS** (version 22.12 or newer) from https://nodejs.org.
3. Install **Rust** from https://rustup.rs: download `rustup-init.exe`, run it, and accept the offer to install the Visual Studio C++ build tools if asked.
4. Install the **GitHub CLI** from https://cli.github.com.
5. Restart your computer, then open **PowerShell** and follow Parts 2–5 above. The commands are the same, except use `cd $HOME` instead of `cd ~`.

---

More detail for developers: [backend setup and tests](https://github.com/judyzhou666/ibm-campus_compass/blob/main/docs/backend.md) and the project [README](https://github.com/judyzhou666/ibm-campus_compass/blob/main/README.md).
