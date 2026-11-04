# Using IBM watsonx with the AI Planner (optional)

By default the AI Planner uses built-in rules ("simulated"). With these steps, it uses **IBM watsonx.ai** and IBM's **Granite** AI model to understand what the student types.

Finish [Getting started](Getting-Started) first, so you know the basic demo works.

## How it works, in plain words

1. A student types a request, such as "AI and a social event, Tuesday or Thursday only".
2. Our server (running on your computer) sends **only that message and the earlier filters** to watsonx. It does not send the schedule, profile or names.
3. Granite replies with search filters only: topics, days, times, food, cost and number of options.
4. Our own rules then pick real events from the fictional catalog and check for clashes. **The AI never invents events.**
5. If watsonx is slow, unavailable or gives a bad answer, the app quietly uses the built-in rules for that message and says so in the chat.

IBM Bob is **not** part of this. Bob is the coding assistant we use to build the project; it is never called by the running app. See [IBM Bob](IBM-Bob).

## Credits: who pays?

Our team has **one shared IBM Cloud account**, with one shared pot of watsonx credits. Each teammate can create their own API key, but **every key uses the same team credits**. A planner message costs a tiny fraction of a cent, so normal testing is fine. IBM emails the account at 25%, 50% and 80% usage; at 100% the account is suspended. Bobcoins (for IBM Bob) are separate and are not used here.

The API key that is used is the one in the `.env` file **on the computer running the server**, not the person typing in the browser.

---

## Step 1: Get your project ID and API key (one time only)

1. Accept the **IBM Cloud** invitation email for the AI Experiential Learning Lab and sign in.
2. Open https://dataplatform.cloud.ibm.com/wx/home?context=wx. At the top right, check the account is the **AI Experiential Learning Lab** one and the region is **Dallas**.
3. Scroll down to **Developer access**.
4. Under **Project or space**, choose **watsonx Challenge Sandbox**. Copy the **Project ID** somewhere private (for example, a note only you can see).
5. Click **Create API key**. Give it a name, choose **Disable the leaked key**, and click **Create**.
6. **Copy the API key now.** IBM shows it only once. Keep it private.

> **Keep the API key secret.** Never paste it into chat, email, screenshots, GitHub, or IBM Bob. If IBM finds a key in a public place, it disables the key and suspends our team account. If you think your key leaked, delete it in IBM Cloud and create a new one.

## Step 2: Put the key in a private settings file (one time only)

The project has a template called `.env.example`. You make a private copy called `.env`. Git is set up to **never upload** `.env`.

```sh
cd ~/ibm-campus_compass
cp .env.example .env
open -e .env
```

TextEdit opens the file. Change these lines (no spaces, no quote marks):

```
PLANNER_PROVIDER=watsonx
WATSONX_API_KEY=paste-your-api-key-here
WATSONX_PROJECT_ID=paste-your-project-id-here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-4-h-small
```

Save (⌘ S) and close TextEdit. Leave the other lines as they are. Each setting name must appear **exactly once**.

## Step 3: Start the website with watsonx

Stop any running copy first (Control + C in its Terminal window). Then:

```sh
cd ~/ibm-campus_compass
npm run build
set -a; source .env; set +a; cargo run --locked
```

The middle part (`set -a; source .env; set +a`) loads your private settings into this Terminal window. You need it **every time** you start the server with watsonx.

You should see:

```
Campus Compass: http://127.0.0.1:4173 (Rust backend, IBM watsonx planner (ibm/granite-4-h-small, https://us-south.ml.cloud.ibm.com); simulated fallback on failure)
```

## Step 4: Check that watsonx is really answering

Open http://127.0.0.1:4173, go to **AI Planner**, and send "AI and a social event, Tuesday or Thursday only".

- ✅ **Working:** the label under the chat says **Rust planner · IBM watsonx**, and the suggestions are on Tuesday or Thursday.
- ⚠️ **Not working:** the label says **Rust planner · Simulated** and the reply starts with "IBM watsonx was unavailable…". Look at the Terminal window for a line starting `watsonx interpreter unavailable (…)` and use the table below.

To go back to the normal demo (no watsonx), stop the server with Control + C and start it like this:

```sh
PLANNER_PROVIDER=simulated cargo run --locked
```

---

## Troubleshooting

| Terminal message | What it means | What to do |
| --- | --- | --- |
| `PLANNER_PROVIDER=watsonx needs WATSONX_API_KEY and WATSONX_PROJECT_ID` | The key or project ID is missing from `.env`. | Open `.env`, fill both lines, save, start again. |
| `(upstream returned HTTP 404)` | watsonx does not offer the model named in `.env`. | Set `WATSONX_MODEL_ID=ibm/granite-4-h-small`. Check the exact name in Prompt Lab → View all foundation models (with the **Chat** filter). |
| `(authentication failed)` | The API key or project ID is wrong, deleted or from another account. | Copy the project ID again; create a new API key; update `.env`. |
| `(request timed out)` or `(network error)` | No internet, or watsonx was slow. | Check your internet and try again. The app keeps working with the built-in rules. |
| `(model output was not a constraints object)` or `(model constraints rejected …)` | Granite answered in a way our safety checks refused. | Nothing to fix; that message used the built-in rules. Rephrase if needed. |
| `.env:13: command not found: …` | There is a stray word or line in `.env`. | Open `.env` and delete any line that is not `NAME=value` or a `#` comment. |
| `Address already in use` | The website is already running elsewhere. | Stop the other copy with Control + C, then start again. |

## Rules from the IBM lab guide

- Use the **watsonx Challenge Sandbox** project in **Dallas**. Deployment spaces are out of scope.
- Use **Granite**. Do **not** use `llama-3-405b-instruct`, `mistral-large`, `mixtral-8x7b-instruct-v01`, `mistral-medium-2502`, `mistral-small-3-1-24b-instruct-2503` or `pixtral-12b`; they can lower our evaluation.
- The team IBM Cloud account is **closed after the lab ends**. After that, live mode stops and the app falls back to the built-in rules automatically, so the demo still works.
