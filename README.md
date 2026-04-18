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
- 🔍 Supports complex rules (conditions + actions)
- ⚡ No API required — works directly from UI
- 🔐 100% local — no data collection or external calls
- 🧩 Works with existing Adobe session (no login needed)

---

## 🛠️ How it works

1. Open Adobe Analytics
2. Navigate to **Processing Rules page**
3. Click the extension
4. Click **Download JSON**

The extension:

- Reads embedded data from the page
- Converts it into 1.4 API format
- Downloads JSON file

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

The downloaded file follows Adobe Analytics 1.4 API structure:

```json
{
  "rsid": "your-report-suite",
  "processing_rules": [
    {
      "editable": true,
      "title": "Rule Name",
      "comment": "Description",
      "actions": [],
      "ruleNum": 1
    }
  ]
}
```

---

## ⚠️ Known Limitations

- Depends on current Adobe UI structure
- May break if Adobe updates Processing Rules UI
- Works only when rules are fully loaded

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
