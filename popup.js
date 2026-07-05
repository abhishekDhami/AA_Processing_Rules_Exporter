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
    const validResult = results.find((r) => Array.isArray(r.result) && r.result[0] && r.result[0].processing_rules);

    if (!validResult) {
      const errors = results.map((r) => r.result?.error).filter(Boolean);
      const errorMsg = errors[0] || "Unable to extract processing rules.";
      const diagnostics = results.map((r) => r.result?.diagnostics).filter(Boolean)[0] || {};

      renderStatus(errorMsg, true, diagnostics);
      hideLoader();
      return;
    }

    const data = validResult.result;
    const reportSuiteExport = data[0];

    clearProgressFallbackMessages();
    updateActiveStatus("Creating download file...");

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `processing_rules_${reportSuiteExport.rsid || "unknown"}_${Date.now()}.json`;
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

    function isEnabled(value) {
      return value === 1 || value === "1" || value === true;
    }

    function quoteValue(value) {
      return `'${String(value ?? "")}'`;
    }

    function normalizeMatches(value) {
      if (Array.isArray(value)) {
        return value.filter((item) => item !== undefined && item !== null && String(item) !== "").map(String);
      }
      if (value === undefined || value === null || value === "") {
        return [];
      }
      return [String(value)];
    }

    function formatCondition(attribute, operator, matches, options = {}) {
      const warnings = options.warnings || [];
      const raw = options.raw;
      const forceAnyOf = options.forceAnyOf === true;
      const valueSeparator = options.valueSeparator || ", ";
      const knownOperators = ["isset", "isnotset", "equals", "notequals", "contains", "notcontains", "startswith", "notstartswith", "endswith", "notendswith"];

      if (!attribute || !operator) {
        warnings.push("Condition is missing an attribute or operator.");
        return `[Unsupported condition: missing attribute/operator]`;
      }

      if (!knownOperators.includes(operator)) {
        warnings.push(`Unsupported condition operator: ${operator}`);
        return `[Unsupported conditionOperator: ${operator}] ${attribute}`;
      }

      if (operator === "isset" || operator === "isnotset") {
        return `if ${attribute} ${operator}`;
      }

      const values = normalizeMatches(matches);
      if (!values.length) {
        warnings.push(`Condition operator '${operator}' has no match value.`);
        return `if ${attribute} ${operator} ''`;
      }

      if (forceAnyOf || values.length > 1) {
        return `if ${attribute} ${operator} any of (${values.join(valueSeparator)})`;
      }

      return `if ${attribute} ${operator} ${quoteValue(values[0])}`;
    }

    function formatRuleCondition(condition, warnings) {
      return formatCondition(condition?.matchHitAttribute || condition?.matchHitAttributeOverride, condition?.matchOperator, condition?.matches, { warnings, raw: condition });
    }

    function formatActionCondition(action, warnings) {
      return formatCondition(action?.conditionMatchFromAttribute, action?.conditionMatchOperator, action?.conditionMatchToAttribute, {
        warnings,
        raw: action,
        forceAnyOf: Array.isArray(action?.conditionMatchToAttribute) && action.conditionMatchToAttribute.length > 0,
        valueSeparator: ",",
      });
    }

    function formatConcatenatedValue(action, warnings) {
      const options = Array.isArray(action?.concatOptions) ? action.concatOptions : [];
      if (!options.length) {
        warnings.push("Concatenated value action has no concatOptions.");
        return "concatenated value ()";
      }

      const delimiter = action.delimiter || "";
      const separator = delimiter ? ` ${delimiter} ` : " ";
      const parts = options.map((option) => {
        if (option?.value === "customvalue") {
          return String(option?.customvalue ?? "");
        }
        return String(option?.value ?? "");
      });

      return `concatenated value (${parts.join(separator)})`;
    }

    function formatSetValueAction(action, warnings) {
      const destination = action?.matchFromAttribute || "";
      const source = action?.matchToAttribute || "";

      if (!destination) {
        warnings.push("setvalueof action is missing matchFromAttribute.");
      }

      if (source === "customvalue") {
        return `overwrite value of ${destination} with custom value ${quoteValue(action?.customValue ?? "")}`;
      }

      if (source === "concatenatedvalue") {
        return `overwrite value of ${destination} with ${formatConcatenatedValue(action, warnings)}`;
      }

      if (!source) {
        warnings.push("setvalueof action is missing matchToAttribute.");
        return `overwrite value of ${destination} with [Unsupported empty source]`;
      }

      return `overwrite value of ${destination} with ${source}`;
    }

    function formatSetEventAction(action, warnings) {
      const eventName = action?.setEvent || action?.matchFromAttribute || "";
      if (!eventName) {
        warnings.push("setevent action is missing setEvent/matchFromAttribute.");
      }

      const eventValueType = action?.eventMatchToAttribute || action?.actionQueryVar || "customvalue";
      const value = action?.customEventValue !== undefined && action?.customEventValue !== "" ? action.customEventValue : "1";

      if (eventValueType === "customvalue" || action?.actionQueryVar === "customvalue") {
        return `set ${eventName} to custom value ${quoteValue(value)}`;
      }

      return `set ${eventName} to ${value}`;
    }

    function formatDeleteValueAction(action, warnings) {
      const destination = action?.matchFromAttribute || "";
      if (!destination) {
        warnings.push("deletevalueof action is missing matchFromAttribute.");
        return "delete value of [Unsupported empty destination]";
      }
      return `delete value of ${destination}`;
    }

    function formatAction(action, warnings) {
      let actionText = "";

      if (action?.actionOperator === "setvalueof") {
        actionText = formatSetValueAction(action, warnings);
      } else if (action?.actionOperator === "setevent") {
        actionText = formatSetEventAction(action, warnings);
      } else if (action?.actionOperator === "deletevalueof") {
        actionText = formatDeleteValueAction(action, warnings);
      } else {
        const operator = action?.actionOperator || "missing";
        warnings.push(`Unsupported action operator: ${operator}`);
        actionText = `[Unsupported actionOperator: ${operator}]`;
      }

      if (isEnabled(action?.actionConditionOn) && action?.conditionMatchFromAttribute) {
        return `${formatActionCondition(action, warnings)}, then ${actionText}`;
      }

      return actionText;
    }

    function transformRule(rule, index) {
      const warnings = [];
      const output = {
        editable: rule.editable === 1 || rule.editable === true || rule.editable === "1",
        title: rule.title,
        comment: rule.comment,
      };

      const formattedRules = (rule.rules || []).map((condition) => formatRuleCondition(condition, warnings));
      if (formattedRules.length) {
        if (formattedRules.length > 1 && rule.junction) {
          output.matchOn = rule.junction;
        }
        output.rules = formattedRules;
      }

      output.actions = (rule.actions || []).map((action) => formatAction(action, warnings));

      const formattedElseActions = (rule.elseActions || []).map((action) => formatAction(action, warnings));
      if (formattedElseActions.length) {
        output.elseActions = formattedElseActions;
      }

      output.ruleNum = index + 1;

      if (warnings.length) {
        output._exporterWarnings = Array.from(new Set(warnings));
        output._exporterRaw = rule;
      }

      return output;
    }

    const transformed = filtered.map((rule, index) => transformRule(rule, index));

    logs.push(`Transformed ${transformed.length} rules successfully.`);
    logs.push(`SUCCESSFUL: Processing rules extracted.`);

    return [{
      rsid: extractRSID(),
      processing_rules: transformed,
    }];
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
