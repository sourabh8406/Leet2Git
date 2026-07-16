[README.md](https://github.com/user-attachments/files/30098600/README.md)
# Leet2Git

> Automatically push every accepted LeetCode solution to GitHub — zero copy-paste required.

![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green?style=flat)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)

---

## Features

- **Auto-sync** — detects accepted submissions and pushes them instantly
- **Smart file layout** — organises solutions by difficulty, language, or flat structure
- **Comment header** — each file is annotated with problem metadata, runtime, and memory
- **README index** — keeps a live table of all your solutions in the repo's README
- **Stats dashboard** — tracks total synced, current streak, and last sync time
- **Full history** — browse and export the last 100 synced solutions
- **Zero backend** — all data stays in your browser; only GitHub's API is called

---

## File Structure

```
Leet2Git/
├── manifest.json
├── background/
│   └── background.js        # Service worker — message hub, sync logic
├── content/
│   └── content.js           # Intercepts LeetCode submissions
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js             # Quick-access UI
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js           # Full settings page
├── utils/
│   ├── auth.js              # GitHub OAuth flow
│   ├── github.js            # GitHub REST API helpers
│   └── storage.js           # chrome.storage wrappers
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Installation

### Step 1 — Create a GitHub OAuth App

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Fill in the form:
   - **Application name**: `Leet2Git`
   - **Homepage URL**: `https://github.com`
   - **Authorization callback URL**: leave blank for now (you will fill this in after loading the extension)
3. Click **Register application**
4. On the next page, click **Generate a new client secret**
5. Copy both the **Client ID** and **Client Secret** — you will need them in Step 4

### Step 2 — Add extension icons

Create or drop three PNG icons into `Leet2Git/icons/`:

| File | Size |
|------|------|
| `icon16.png` | 16 × 16 px |
| `icon48.png` | 48 × 48 px |
| `icon128.png` | 128 × 128 px |

> You can generate them from any image editor or use a free tool like [favicon.io](https://favicon.io).

### Step 3 — Load the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `Leet2Git/` folder
5. The extension will appear in your toolbar

### Step 4 — Configure OAuth credentials

1. Click the Leet2Git icon → then the ⚙ (settings) icon to open the Options page
2. Go to the **GitHub Setup** section
3. Copy the **Callback URL** shown on that page (it looks like `https://<extension-id>.chromiumapp.org/`)
4. Go back to your GitHub OAuth App settings and paste that URL into the **Authorization callback URL** field, then save
5. Back in the Options page, enter your **Client ID** and **Client Secret** and click **Save Credentials**

### Step 5 — Connect your GitHub account

1. Still on the Options page → **GitHub Setup**
2. Click **Connect GitHub Account**
3. A GitHub authorisation window will open — approve it
4. Your profile picture and username will appear once connected

### Step 6 — Configure sync settings

1. Go to the **Sync Settings** section in Options
2. Select (or create) the target **Repository**
3. Set the **Branch** (default: `main`)
4. Choose your preferred **folder structure**
5. Toggle any behaviour options you want
6. Click **Save Settings**

You're done. Solve a problem on LeetCode, hit submit, and watch it appear in your GitHub repo.

---

## How it works

```
LeetCode page                Chrome extension              GitHub
─────────────                ────────────────              ──────
User submits  ──fetch hook──▶ content.js detects
solution                      "Accepted" result
                                    │
                                    │  chrome.runtime.sendMessage
                                    ▼
                              background.js
                              • builds file path
                              • wraps code with header
                              • calls GitHub API
                                    │
                                    │  PUT /repos/{owner}/{repo}/contents/{path}
                                    ▼
                                                          Commit created
                                                          in your repo ✓
```

The content script patches `window.fetch` and `XMLHttpRequest` to intercept LeetCode's submission polling responses. It also runs a `MutationObserver` as a fallback to detect the green "Accepted" badge. When an accepted submission is detected, the code is read from the Monaco editor and forwarded to the background service worker, which calls the GitHub Contents API to create or update the file.

---

## Folder structure options

| Template | Example path |
|----------|-------------|
| `difficulty` (default) | `easy/0001-two-sum/0001-two-sum.py` |
| `flat` | `0001-two-sum.py` |
| `language` | `python/0001-two-sum.py` |

---

## Example synced file

```python
# Problem   : 1. Two Sum
# Difficulty: Easy
# URL       : https://leetcode.com/problems/two-sum/
# Language  : python3
# Runtime   : 52 ms
# Memory    : 17.4 MB
# Synced    : 2024-03-15

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            complement = target - n
            if complement in seen:
                return [seen[complement], i]
            seen[n] = i
```

---

## Supported languages

| Language | Extension |
|----------|-----------|
| Python / Python3 | `.py` |
| JavaScript | `.js` |
| TypeScript | `.ts` |
| Java | `.java` |
| C++ | `.cpp` |
| C | `.c` |
| C# | `.cs` |
| Go | `.go` |
| Rust | `.rs` |
| Ruby | `.rb` |
| Swift | `.swift` |
| Kotlin | `.kt` |
| Scala | `.scala` |
| PHP | `.php` |
| Bash | `.sh` |
| MySQL / SQL | `.sql` |

---

## Privacy & Security

- Your GitHub **Client Secret** is stored only in `chrome.storage.local` on your own machine
- No data is sent to any third-party server — the extension communicates exclusively with `api.github.com`
- Only the `repo` OAuth scope is requested (read/write access to your repositories)
- You can disconnect your account and clear all data at any time from **Options → Danger Zone**

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Not authenticated" toast | Open the popup and sign in with GitHub |
| "No repository configured" toast | Open Options → Sync Settings and select a repo |
| Solution not syncing | Make sure auto-sync is enabled; check the browser console on leetcode.com for `[Leet2Git]` logs |
| OAuth window doesn't open | Verify the Client ID and Secret are saved in Options → GitHub Setup |
| "OAuth state mismatch" error | Try disconnecting and reconnecting — this clears stale state |
| 404 on file push | Ensure the target branch exists or let the extension create it automatically |

---

## Development

```bash
# Clone / open the folder
cd Leet2Git

# Load in Chrome
# chrome://extensions → Developer mode → Load unpacked → select this folder

# After any code change, click the refresh icon on chrome://extensions
# Then reload the LeetCode tab
```

There is no build step — the extension uses ES modules natively via `"type": "module"` in the manifest's service worker declaration.

---

## License

MIT © 2024 — free to use, modify, and distribute.
