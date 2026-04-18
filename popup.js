let downloadBtn = document.getElementById("downloadBtn");
downloadBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const status = document.getElementById("status");

  try {
    showLoader();
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true }, //
      func: extractRules,
      world: "MAIN",
    });

    // 🔥 Find the frame which returned valid data
    const validResult = results.find((r) => r.result && r.result.processing_rules);

    if (!validResult) {
      const errors = results.map((r) => r.result?.error).filter(Boolean);
      const errorMsg = errors[0] || "Unable to extract processing rules.";

      status.innerHTML = `
        ${errorMsg}<br/><br/>
        <span style="font-size:11px; color:#555;">
          If the issue persists, Adobe UI might have changed.
        </span><br/>
        <a href="https://github.com/abhishekDhami/AA_Processing_Rules_Exporter" target="_blank">
          Report issue on GitHub
        </a>
      `;
      hideLoader();
      return;
    }

    const data = validResult.result;

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `processing_rules_${data.rsid || "unknown"}_${Date.now()}.json`;
    a.click();

    status.innerText = "Downloaded successfully!";
    hideLoader();
  } catch (err) {
    console.error(err);
    status.innerText = "Failed to extract rules.";
    hideLoader();
  }
});

async function extractRules() {
  //defining helper functions inside the injected script to ensure they have access to the page's DOM and JS context
  function extractRSID() {
    // 1. Primary (BEST)
    const el = document.querySelector("#selected_rsid");
    if (el?.value) return el.value;

    // 2. Secondary (list fallback)
    const listEl = document.querySelector("#rsidlist");
    if (listEl?.value) return listEl.value;

    // 3. Fallback (JS config)
    if (window?.Omniture?.Config?.reportSuiteName) {
      return window.Omniture.Config.reportSuiteName;
    }

    return "unknown";
  }

  async function waitForRules(maxRetries = 10, delay = 500) {
    for (let i = 0; i < maxRetries; i++) {
      const scripts = document.querySelectorAll("script");

      for (const script of scripts) {
        const content = script.innerHTML;

        if (content.includes("createRuleSetsFromUI")) {
          const match = content.match(/RuleSetController\.createRuleSetsFromUI\((\[.*?\])\)/s);

          if (match) {
            return JSON.parse(match[1]);
          }
        }
      }

      // wait before retry
      await new Promise((r) => setTimeout(r, delay));
    }

    return null;
  }
  try {
    if (!window.location.href.includes("www4.an.adobe.com/p/am/1.3")) {
      return { error: "Please open the Processing Rules page." };
    }
    const scripts = document.querySelectorAll("script");

    let rawRules = await waitForRules();

    if (!rawRules) {
      return { error: "Processing rules not loaded yet. Please wait a few seconds and try again." };
    }

    const filtered = rawRules.filter((r) => r.hidden === 0);

    const transformed = filtered.map((rule, index) => ({
      editable: rule.editable === 1,
      title: rule.title,
      comment: rule.comment,
      matchOn: rule.junction || undefined,
      rules: (rule.rules || []).map((r) => {
        if (r.matchOperator === "isset") {
          return `if ${r.matchHitAttribute} isset`;
        }
        if (r.matchOperator === "equals") {
          return `if ${r.matchHitAttribute} equals '${r.matches?.[0] || ""}'`;
        }
        return "";
      }),
      actions: (rule.actions || []).map((a) => {
        let actionStr = "";

        // 🔹 Build action part
        if (a.actionOperator === "setvalueof") {
          actionStr = `overwrite value of ${a.matchFromAttribute} with ${a.matchToAttribute}`;
        } else if (a.actionOperator === "setevent") {
          const value = a.customEventValue || "1";

          // 🔥 IMPORTANT: handle contextdata vs literal
          if (typeof value === "string" && value.startsWith("contextdata")) {
            actionStr = `set ${a.setEvent} to ${value}`;
          } else {
            actionStr = `set ${a.setEvent} to custom value '${value}'`;
          }
        }

        // 🔹 Build condition part (MAIN FIX)
        if (a.actionConditionOn === 1 && a.conditionMatchFromAttribute) {
          return `if ${a.conditionMatchFromAttribute} ${a.conditionMatchOperator}, then ${actionStr}`;
        }

        return actionStr;
      }),
      ruleNum: index + 1,
    }));

    return {
      rsid: extractRSID(),
      processing_rules: transformed,
    };
  } catch (e) {
    return { error: e.message };
  }
}

function showLoader() {
  document.getElementById("loadingOverlay").style.display = "flex";
  downloadBtn.disabled = true;
}

function hideLoader() {
  document.getElementById("loadingOverlay").style.display = "none";
  downloadBtn.disabled = false;
}
