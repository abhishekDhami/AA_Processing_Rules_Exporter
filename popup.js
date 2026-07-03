let downloadBtn = document.getElementById("downloadBtn");
let progressFallbackTimer = null;
let progressFallbackInterval = null;
let activeProgressStage = null;
const longWaitMessages = [
  "Fetching processing rules...",
  "Still fetching the rules...",
  "The page is working on it...",
  "Patience is part of the process...",
  "Almost there - collecting the rules.",
  "The browser is doing its magic...",
];

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function generateLogContent(message, diagnostics = {}) {
  const timestamp = new Date().toISOString();
  const lines = ["=== AA Processing Rules Exporter - Diagnostic Log ===", `Timestamp: ${timestamp}`, "", `Error: ${message}`, ""];

  if (diagnostics.title) {
    lines.push(`Page Title: ${diagnostics.title}`);
  }

  lines.push("", "--- Extraction Process ---");
  if (Array.isArray(diagnostics.steps)) {
    diagnostics.steps.forEach((step, idx) => {
      lines.push(`Step ${idx + 1}: ${step}`);
    });
  }

  if (typeof diagnostics.scriptCount === "number") {
    lines.push("", "--- Script Analysis ---");
    lines.push(`Total scripts scanned: ${diagnostics.scriptCount}`);
  }
  if (typeof diagnostics.matchingScriptCount === "number") {
    lines.push(`Scripts with 'createRuleSetsFromUI': ${diagnostics.matchingScriptCount}`);
  }

  if (diagnostics.reason) {
    lines.push("", "--- Failure Summary ---");
    lines.push(diagnostics.reason);
  }

  lines.push("", "--- Troubleshooting ---");
  lines.push(
    "1. Verify you are on the Processing Rules page in Adobe Analytics.",
    "2. Wait for the page to fully load (no loading spinners).",
    "3. Make sure your browser allows content scripts to run.",
    "4. Try closing the popup and clicking the extension again.",
    "",
    "If the issue persists, report this log on GitHub:",
    "https://github.com/abhishekDhami/AA_Processing_Rules_Exporter/issues",
  );

  return lines.join("\n");
}

function downloadLogFile(message, diagnostics = {}) {
  const logContent = generateLogContent(message, diagnostics);
  const blob = new Blob([logContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aa-rules-extractor-log_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function animateTextChange(element, message) {
  if (!element) return;

  const timerKey = element === document.getElementById("status") ? "status" : "overlay";
  if (!animateTextChange.timers) {
    animateTextChange.timers = {};
  }

  clearTimeout(animateTextChange.timers[timerKey]);
  element.style.opacity = "0";
  animateTextChange.timers[timerKey] = window.setTimeout(() => {
    element.textContent = message;
    element.style.opacity = "1";
  }, 220);
}

function updateProgressMessage(message) {
  const status = document.getElementById("status");
  if (!status) return;

  animateTextChange(status, message);
}

function updateActiveStatus(message) {
  updateLoadingMessage(message);
  updateProgressMessage(message);
}

function clearProgressFallbackMessages() {
  if (progressFallbackTimer) {
    clearTimeout(progressFallbackTimer);
    progressFallbackTimer = null;
  }
  if (progressFallbackInterval) {
    clearInterval(progressFallbackInterval);
    progressFallbackInterval = null;
  }
  activeProgressStage = null;
}

function startFetchingFallbackMessages() {
  clearProgressFallbackMessages();
  activeProgressStage = "fetching";

  let index = 0;
  const rotateMessage = () => {
    if (activeProgressStage !== "fetching") return;

    const message = longWaitMessages[index % longWaitMessages.length];
    updateActiveStatus(message);
    index += 1;
  };

  rotateMessage();
  progressFallbackInterval = window.setInterval(rotateMessage, 5000);
}

function updateLoadingMessage(message) {
  const loadingText = document.querySelector("#loadingOverlay .loading-text");
  if (loadingText) {
    animateTextChange(loadingText, message);
  }
}

function renderStatus(message, isError = false, diagnostics = {}) {
  const status = document.getElementById("status");

  if (!isError) {
    status.innerHTML = escapeHtml(message);
    status.style.opacity = "1";
    return;
  }

  status.innerHTML = `
    <div style="margin-bottom: 8px;">${escapeHtml(message)}</div>
    <div style="margin-bottom: 8px;">
      <a href="#" id="downloadLogsLink" style="font-size: 11px; color: #2563eb; text-decoration: underline; cursor: pointer;">
        Download Logs
      </a>
    </div>
    <div>
      <a href="https://github.com/abhishekDhami/AA_Processing_Rules_Exporter/issues" target="_blank" style="font-size: 11px; color: #2563eb; text-decoration: underline;">
        Report issue on GitHub
      </a>
    </div>
  `;

  const logsLink = document.getElementById("downloadLogsLink");
  if (logsLink) {
    logsLink.addEventListener("click", (e) => {
      e.preventDefault();
      downloadLogFile(message, diagnostics);
    });
  }
}

downloadBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const status = document.getElementById("status");

  try {
    showLoader("Preparing extraction...");
    updateActiveStatus("Fetching processing rules...");
    startFetchingFallbackMessages();

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
      const diagnostics = results.map((r) => r.result?.diagnostics).filter(Boolean)[0] || {};

      renderStatus(errorMsg, true, diagnostics);
      hideLoader();
      return;
    }

    const data = validResult.result;

    clearProgressFallbackMessages();
    updateActiveStatus("Creating download file...");

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `processing_rules_${data.rsid || "unknown"}_${Date.now()}.json`;
    a.click();

    clearProgressFallbackMessages();
    updateActiveStatus("Download complete");
    renderStatus("Downloaded successfully!", false);
    hideLoader();
  } catch (err) {
    console.error("Extraction failed", err);
    clearProgressFallbackMessages();
    updateActiveStatus("Extraction failed");
    renderStatus("Failed to extract rules.", true, {
      title: tab?.title,
      reason: err?.message || String(err),
    });
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

  function getDiagnostics(extra = {}) {
    const scripts = Array.from(document.querySelectorAll("script"));
    const matchingScripts = scripts.filter((script) => {
      const content = script.textContent || script.innerHTML || "";
      return content.includes("createRuleSetsFromUI");
    });

    const pageTitle = document.title || "Unknown";
    const currentHref = window.location?.href || "";
    const hasDynamicProcessingRules = currentHref.includes("feature=DynamicProcessingRules");

    return {
      title: hasDynamicProcessingRules ? `${pageTitle}|feature=DynamicProcessingRules` : pageTitle,
      scriptCount: scripts.length,
      matchingScriptCount: matchingScripts.length,
      steps: [],
      ...extra,
    };
  }

  function extractRulesFromScript(content, scriptIndex, logs) {
    if (!content || typeof content !== "string") {
      logs.push(`Script ${scriptIndex}: Content is not a string, skipping.`);
      return null;
    }

    if (!content.includes("createRuleSetsFromUI")) {
      return null;
    }

    logs.push(`Script ${scriptIndex}: Found 'createRuleSetsFromUI', attempting to parse.`);

    const startIndex = content.indexOf("createRuleSetsFromUI");
    if (startIndex === -1) {
      logs.push(`Script ${scriptIndex}: Function call not found.`);
      return null;
    }

    const openBracketIndex = content.indexOf("[", startIndex);
    if (openBracketIndex === -1) {
      logs.push(`Script ${scriptIndex}: Opening bracket '[' not found after function.`);
      return null;
    }

    let depth = 0;
    let inString = false;
    let stringChar = "";
    let escaped = false;

    for (let i = openBracketIndex; i < content.length; i++) {
      const char = content[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'" || char === "`") {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === "[") {
        depth++;
      } else if (char === "]") {
        depth--;
        if (depth === 0) {
          const candidate = content.slice(openBracketIndex, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            logs.push(`Script ${scriptIndex}: Successfully parsed JSON array with ${Array.isArray(parsed) ? parsed.length : "unknown"} items.`);
            return parsed;
          } catch (e) {
            logs.push(`Script ${scriptIndex}: JSON parse error - ${e.message}.`);
            return null;
          }
        }
      }
    }

    logs.push(`Script ${scriptIndex}: Array bracket not closed.`);
    return null;
  }

  function findRulesInPage(logs) {
    const scripts = document.querySelectorAll("script");
    logs.push(`Scanning ${scripts.length} scripts on the page.`);

    let scriptIndex = 0;
    for (const script of scripts) {
      scriptIndex++;
      const content = script.textContent || script.innerHTML || "";
      if (!content) continue;

      const parsed = extractRulesFromScript(content, scriptIndex, logs);
      if (parsed) {
        logs.push(`Successfully extracted rules from script ${scriptIndex}.`);
        return parsed;
      }
    }

    logs.push(`No scripts with valid 'createRuleSetsFromUI' found.`);
    return null;
  }

  async function waitForRules(maxRetries = 30, delay = 800, logs) {
    logs.push(`Waiting for rules with max ${maxRetries} retries (${delay}ms between each).`);
    for (let i = 0; i < maxRetries; i++) {
      const rules = findRulesInPage(logs);
      if (rules) {
        logs.push(`Rules found on retry ${i + 1}.`);
        return rules;
      }

      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    logs.push(`Timeout: Rules not found after ${maxRetries} retries.`);
    return null;
  }

  try {
    const logs = [];
    logs.push(`Extraction started for page: "${document.title}"`);

    let rawRules = await waitForRules(30, 800, logs);

    if (!rawRules) {
      logs.push(`FAILED: No processing rules found after wait period.`);
      const diag = getDiagnostics({ reason: "rules_not_loaded", steps: logs });
      return {
        error: "Processing rules not loaded yet. Please wait a few seconds and try again. Make sure the Processing Rules page is fully loaded.",
        diagnostics: diag,
      };
    }

    logs.push(`Raw data received, attempting to validate structure.`);

    if (rawRules.rules && Array.isArray(rawRules.rules)) {
      logs.push(`Detected nested structure: extracting 'rules' property.`);
      rawRules = rawRules.rules;
    } else if (rawRules.ruleSets && Array.isArray(rawRules.ruleSets)) {
      logs.push(`Detected nested structure: extracting 'ruleSets' property.`);
      rawRules = rawRules.ruleSets;
    } else if (rawRules.data && Array.isArray(rawRules.data)) {
      logs.push(`Detected nested structure: extracting 'data' property.`);
      rawRules = rawRules.data;
    } else {
      logs.push(`Using raw data as-is (no nested properties detected).`);
    }

    if (!Array.isArray(rawRules)) {
      logs.push(`FAILED: Data is not an array. Type: ${typeof rawRules}.`);
      const diag = getDiagnostics({ reason: "unexpected_format", steps: logs });
      return {
        error: "Processing rules were found, but the page returned an unexpected format.",
        diagnostics: diag,
      };
    }

    logs.push(`Valid array with ${rawRules.length} items received.`);

    const filtered = rawRules.filter((r) => {
      if (r.hidden === 0 || r.hidden === "0" || r.hidden === false) {
        return true;
      }
      return r.hidden !== 1 && r.hidden !== "1";
    });

    logs.push(`Filtered ${rawRules.length} items to ${filtered.length} visible rules.`);

    const transformed = filtered.map((rule, index) => ({
      editable: rule.editable === 1 || rule.editable === true,
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

        if (a.actionOperator === "setvalueof") {
          actionStr = `overwrite value of ${a.matchFromAttribute} with ${a.matchToAttribute}`;
        } else if (a.actionOperator === "setevent") {
          const value = a.customEventValue || "1";

          if (typeof value === "string" && value.startsWith("contextdata")) {
            actionStr = `set ${a.setEvent} to ${value}`;
          } else {
            actionStr = `set ${a.setEvent} to custom value '${value}'`;
          }
        }

        if (a.actionConditionOn === 1 && a.conditionMatchFromAttribute) {
          return `if ${a.conditionMatchFromAttribute} ${a.conditionMatchOperator}, then ${actionStr}`;
        }

        return actionStr;
      }),
      ruleNum: index + 1,
    }));

    logs.push(`Transformed ${transformed.length} rules successfully.`);
    logs.push(`SUCCESSFUL: Processing rules extracted.`);

    return {
      rsid: extractRSID(),
      processing_rules: transformed,
    };
  } catch (e) {
    const logs = [];
    logs.push(`EXCEPTION: ${e?.message || String(e)}`);
    const diag = getDiagnostics({ reason: "exception", steps: logs });
    return {
      error: e?.message || String(e),
      diagnostics: diag,
    };
  }
}

function showLoader(message = "Preparing extraction...") {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.style.display = "flex";
  }

  clearProgressFallbackMessages();
  updateLoadingMessage(message);
  updateProgressMessage(message);
  downloadBtn.disabled = true;
}

function hideLoader() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.style.display = "none";
  }
  clearProgressFallbackMessages();
  downloadBtn.disabled = false;
}
