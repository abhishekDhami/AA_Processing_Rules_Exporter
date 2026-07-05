# AA Processing Rules Exporter

A lightweight Chrome Extension to export **Adobe Analytics Processing Rules** as JSON (1.4 API format).

---

## 🚀 Why this extension?

Adobe Analytics **1.4 APIs are being deprecated**, and currently there is **no equivalent endpoint in 2.0 APIs** to fetch Processing Rules.

Many teams rely on this data for:

- Documentation
- Debugging
- Migration (AA → AEP)
- Audits

This extension provides a **simple workaround** by extracting rules directly from the Adobe UI.

---

## ✨ Features

- 📥 Export Processing Rules as JSON (1.4 API format)
- 🔍 Supports complex rules, rule-level conditions, action-level conditions, else actions, delete actions, set events, purchase, custom values, and concatenated values
- ⚡ No API required — works directly from UI
- 🔐 100% local — no data collection or external calls
- 🧩 Works with existing Adobe session (no login needed)

---

## 🛠️ How it works

### Option 1: Chrome extension

1. Open Adobe Analytics
2. Navigate to **Processing Rules page**
3. Click the extension
4. Click **Download JSON**

### Option 2: Console script, no extension install required

Use this if your organization does not allow Chrome extensions.

1. Open Adobe Analytics
2. Navigate to the **Processing Rules** page
3. Wait until the rules are fully loaded
4. Open DevTools → Console
5. Copy the latest `console-script.js` from this repository
6. Paste it into the Console and press Enter
7. A JSON file will download locally

Before running the console script, review it and confirm it does not contain external network calls such as `fetch`, `XMLHttpRequest`, or `sendBeacon`.

Both options:

- Read embedded Processing Rules data from the current Adobe UI page
- Convert it into Adobe Analytics 1.4 API-like JSON format
- Download the JSON file locally in your browser

---

## 📦 Installation

### Load Unpacked (Recommended for now)

1. Download or clone this repository
2. Go to `chrome://extensions/`
3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the project folder

---

## 📁 Output Format

The downloaded file follows the Adobe Analytics 1.4 API response structure:

```json
[
  {
    "rsid": "your-report-suite",
    "processing_rules": [
      {
        "editable": true,
        "title": "Rule Name",
        "comment": "Description",
        "matchOn": "All",
        "rules": [
          "if page_url contains any of (example)"
        ],
        "actions": [
          "if contextdata.example isset, then overwrite value of evar1 with contextdata.example"
        ],
        "elseActions": [],
        "ruleNum": 1
      }
    ]
  }
]
```

---

## ⚠️ Known Limitations

- Depends on current Adobe Processing Rules UI structure
- May need updates if Adobe changes the UI payload
- Works only when rules are fully loaded
- Console script users may need to select the correct frame in DevTools if Adobe loads the rules inside an iframe

---

## 🐞 Reporting Issues

If the extension stops working or UI changes:

👉 Please report here:
https://github.com/abhishekDhami/AA_Processing_Rules_Exporter/issues

Include:

- Screenshot (optional)
- Report suite context (no sensitive data)
- What error you saw

---

## 🔐 Privacy & Security

- No data is stored
- No data is transmitted externally
- Runs completely in your browser
- Console script does not use `fetch`, `XMLHttpRequest`, `sendBeacon`, or external network calls
- Review the script before pasting it into DevTools Console

---

## 💡 Use Cases

- Adobe Analytics implementation audits
- Rule documentation
- Debugging processing logic

---

## 🙌 Contributing

Contributions are welcome!

If you have ideas or improvements:

- Open an issue
- Submit a pull request

---

## ⭐ Support

If this helps you, consider giving it a ⭐ on GitHub!

---

## 📢 Disclaimer

This is an unofficial tool and is not affiliated with Adobe.
Use at your own discretion.

---

## 👨‍💻 Author

Built to solve a real-world gap in Adobe Analytics ecosystem.

---
