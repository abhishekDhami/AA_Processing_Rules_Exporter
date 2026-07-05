/*
 * AA Processing Rules Exporter - Console Script
 * Repository: https://github.com/abhishekDhami/AA_Processing_Rules_Exporter
 *
 * Usage:
 * 1. Open Adobe Analytics Processing Rules page.
 * 2. Wait until rules are fully loaded.
 * 3. Open DevTools > Console.
 * 4. Paste this complete script and press Enter.
 *
 * Privacy/Security:
 * - Runs locally in your browser.
 * - Does not send data to any server.
 * - Does not use fetch, XMLHttpRequest, sendBeacon, or external network calls.
 * - Downloads the extracted Processing Rules as a local JSON file.
 */

(async function aaProcessingRulesConsoleExporter() {
  "use strict";

  const EXPORTER_NAME = "AA Processing Rules Exporter";
  const EXPORTER_VERSION = "console-1.1.0";
  const DEFAULT_MAX_RETRIES = 30;
  const DEFAULT_RETRY_DELAY_MS = 800;

  function log(message) {
    console.log(`[${EXPORTER_NAME}] ${message}`);
  }

  function warn(message) {
    console.warn(`[${EXPORTER_NAME}] ${message}`);
  }

  function error(message) {
    console.error(`[${EXPORTER_NAME}] ${message}`);
  }

  function sanitizeFilenamePart(value) {
    return String(value || "unknown")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "unknown";
  }

  function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Delay revoke slightly so Chromium has time to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function generateLogContent(message, diagnostics = {}) {
    const timestamp = new Date().toISOString();
    const lines = [
      "=== AA Processing Rules Exporter - Console Diagnostic Log ===",
      `Version: ${EXPORTER_VERSION}`,
      `Timestamp: ${timestamp}`,
      "",
      `Error: ${message}`,
      "",
    ];

    if (diagnostics.title) {
      lines.push(`Page Title: ${diagnostics.title}`);
    }

    if (diagnostics.href) {
      lines.push(`Page URL: ${diagnostics.href}`);
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

    lines.push(
      "",
      "--- Troubleshooting ---",
      "1. Verify you are on the Adobe Analytics Processing Rules page.",
      "2. Wait for the page to fully load before running the script.",
      "3. If the rules are inside an iframe, select the correct frame in DevTools Console and run this script again.",
      "4. If the issue persists, report it on GitHub:",
      "https://github.com/abhishekDhami/AA_Processing_Rules_Exporter/issues",
    );

    return lines.join("\n");
  }

  function downloadLogFile(message, diagnostics = {}) {
    const logContent = generateLogContent(message, diagnostics);
    downloadTextFile(logContent, `aa-rules-extractor-log_${Date.now()}.txt`, "text/plain");
  }

  function extractRSID() {
    // 1. Primary selector used by the Processing Rules UI.
    const selectedRsid = document.querySelector("#selected_rsid");
    if (selectedRsid && selectedRsid.value) return selectedRsid.value;

    // 2. Secondary list fallback.
    const rsidList = document.querySelector("#rsidlist");
    if (rsidList && rsidList.value) return rsidList.value;

    // 3. Adobe page config fallback.
    if (window.Omniture && window.Omniture.Config && window.Omniture.Config.reportSuiteName) {
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
    const currentHref = window.location && window.location.href ? window.location.href : "";
    const hasDynamicProcessingRules = currentHref.includes("feature=DynamicProcessingRules");

    return {
      title: hasDynamicProcessingRules ? `${pageTitle}|feature=DynamicProcessingRules` : pageTitle,
      href: currentHref,
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
          } catch (parseError) {
            logs.push(`Script ${scriptIndex}: JSON parse error - ${parseError.message}.`);
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

    logs.push("No scripts with valid 'createRuleSetsFromUI' found.");
    return null;
  }

  async function waitForRules(maxRetries = DEFAULT_MAX_RETRIES, delay = DEFAULT_RETRY_DELAY_MS, logs = []) {
    logs.push(`Waiting for rules with max ${maxRetries} retries (${delay}ms between each).`);

    for (let i = 0; i < maxRetries; i++) {
      const rules = findRulesInPage(logs);
      if (rules) {
        logs.push(`Rules found on retry ${i + 1}.`);
        return rules;
      }

      if (i < maxRetries - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }
    }

    logs.push(`Timeout: Rules not found after ${maxRetries} retries.`);
    return null;
  }

  function normalizeRawRules(rawRules, logs) {
    logs.push("Raw data received, attempting to validate structure.");

    if (rawRules && rawRules.rules && Array.isArray(rawRules.rules)) {
      logs.push("Detected nested structure: extracting 'rules' property.");
      return rawRules.rules;
    }

    if (rawRules && rawRules.ruleSets && Array.isArray(rawRules.ruleSets)) {
      logs.push("Detected nested structure: extracting 'ruleSets' property.");
      return rawRules.ruleSets;
    }

    if (rawRules && rawRules.data && Array.isArray(rawRules.data)) {
      logs.push("Detected nested structure: extracting 'data' property.");
      return rawRules.data;
    }

    logs.push("Using raw data as-is (no nested properties detected).");
    return rawRules;
  }

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
    const forceAnyOf = options.forceAnyOf === true;
    const valueSeparator = options.valueSeparator || ", ";
    const knownOperators = ["isset", "isnotset", "equals", "notequals", "contains", "notcontains", "startswith", "notstartswith", "endswith", "notendswith"];

    if (!attribute || !operator) {
      warnings.push("Condition is missing an attribute or operator.");
      return "[Unsupported condition: missing attribute/operator]";
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
    return formatCondition(condition && (condition.matchHitAttribute || condition.matchHitAttributeOverride), condition && condition.matchOperator, condition && condition.matches, { warnings });
  }

  function formatActionCondition(action, warnings) {
    return formatCondition(action && action.conditionMatchFromAttribute, action && action.conditionMatchOperator, action && action.conditionMatchToAttribute, {
      warnings,
      forceAnyOf: Array.isArray(action && action.conditionMatchToAttribute) && action.conditionMatchToAttribute.length > 0,
      valueSeparator: ",",
    });
  }

  function formatConcatenatedValue(action, warnings) {
    const options = Array.isArray(action && action.concatOptions) ? action.concatOptions : [];
    if (!options.length) {
      warnings.push("Concatenated value action has no concatOptions.");
      return "concatenated value ()";
    }

    const delimiter = action.delimiter || "";
    const separator = delimiter ? ` ${delimiter} ` : " ";
    const parts = options.map((option) => {
      if (option && option.value === "customvalue") {
        return String(option.customvalue ?? "");
      }
      return String((option && option.value) ?? "");
    });

    return `concatenated value (${parts.join(separator)})`;
  }

  function formatSetValueAction(action, warnings) {
    const destination = (action && action.matchFromAttribute) || "";
    const source = (action && action.matchToAttribute) || "";

    if (!destination) {
      warnings.push("setvalueof action is missing matchFromAttribute.");
    }

    if (source === "customvalue") {
      return `overwrite value of ${destination} with custom value ${quoteValue((action && action.customValue) ?? "")}`;
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
    const eventName = (action && (action.setEvent || action.matchFromAttribute)) || "";
    if (!eventName) {
      warnings.push("setevent action is missing setEvent/matchFromAttribute.");
    }

    const eventValueType = (action && (action.eventMatchToAttribute || action.actionQueryVar)) || "customvalue";
    const value = action && action.customEventValue !== undefined && action.customEventValue !== "" ? action.customEventValue : "1";

    if (eventValueType === "customvalue" || (action && action.actionQueryVar === "customvalue")) {
      return `set ${eventName} to custom value ${quoteValue(value)}`;
    }

    return `set ${eventName} to ${value}`;
  }

  function formatDeleteValueAction(action, warnings) {
    const destination = (action && action.matchFromAttribute) || "";
    if (!destination) {
      warnings.push("deletevalueof action is missing matchFromAttribute.");
      return "delete value of [Unsupported empty destination]";
    }
    return `delete value of ${destination}`;
  }

  function formatAction(action, warnings) {
    let actionText = "";

    if (action && action.actionOperator === "setvalueof") {
      actionText = formatSetValueAction(action, warnings);
    } else if (action && action.actionOperator === "setevent") {
      actionText = formatSetEventAction(action, warnings);
    } else if (action && action.actionOperator === "deletevalueof") {
      actionText = formatDeleteValueAction(action, warnings);
    } else {
      const operator = (action && action.actionOperator) || "missing";
      warnings.push(`Unsupported action operator: ${operator}`);
      actionText = `[Unsupported actionOperator: ${operator}]`;
    }

    if (isEnabled(action && action.actionConditionOn) && action && action.conditionMatchFromAttribute) {
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

  function transformRules(rawRules, logs) {
    if (!Array.isArray(rawRules)) {
      logs.push(`FAILED: Data is not an array. Type: ${typeof rawRules}.`);
      return null;
    }

    logs.push(`Valid array with ${rawRules.length} items received.`);

    const filtered = rawRules.filter((rule) => {
      if (rule.hidden === 0 || rule.hidden === "0" || rule.hidden === false) {
        return true;
      }
      return rule.hidden !== 1 && rule.hidden !== "1";
    });

    logs.push(`Filtered ${rawRules.length} items to ${filtered.length} visible rules.`);

    const transformed = filtered.map((rule, index) => transformRule(rule, index));
    const warningCount = transformed.reduce((count, rule) => count + (Array.isArray(rule._exporterWarnings) ? rule._exporterWarnings.length : 0), 0);

    logs.push(`Transformed ${transformed.length} rules successfully.`);
    if (warningCount) {
      logs.push(`Completed with ${warningCount} exporter warning(s). Unsupported raw UI objects were preserved in _exporterRaw.`);
    }

    return transformed;
  }

  async function extractRules() {
    const logs = [];
    logs.push(`Extraction started for page: "${document.title}"`);

    const rawRulesResult = await waitForRules(DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY_MS, logs);

    if (!rawRulesResult) {
      logs.push("FAILED: No processing rules found after wait period.");
      return {
        error: "Processing rules not loaded yet. Please wait a few seconds and try again. Make sure the Processing Rules page is fully loaded.",
        diagnostics: getDiagnostics({ reason: "rules_not_loaded", steps: logs }),
      };
    }

    const normalizedRules = normalizeRawRules(rawRulesResult, logs);
    const transformedRules = transformRules(normalizedRules, logs);

    if (!transformedRules) {
      return {
        error: "Processing rules were found, but the page returned an unexpected format.",
        diagnostics: getDiagnostics({ reason: "unexpected_format", steps: logs }),
      };
    }

    logs.push("SUCCESSFUL: Processing rules extracted.");

    return [{
      rsid: extractRSID(),
      processing_rules: transformedRules,
    }];
  }

  try {
    log("Starting export. Please wait...");

    const result = await extractRules();

    if (!result || result.error) {
      const message = result && result.error ? result.error : "Unable to extract processing rules.";
      error(message);
      if (result && result.diagnostics) {
        warn("A diagnostic log file will be downloaded.");
        downloadLogFile(message, result.diagnostics);
      }
      return;
    }

    const reportSuiteExport = Array.isArray(result) ? result[0] : result;
    const rsid = sanitizeFilenamePart(reportSuiteExport && reportSuiteExport.rsid);
    const filename = `processing_rules_${rsid}_${Date.now()}.json`;
    downloadTextFile(JSON.stringify(result, null, 2), filename, "application/json");

    log(`Downloaded successfully: ${filename}`);
    log(`Exported ${reportSuiteExport.processing_rules.length} processing rules for RSID: ${reportSuiteExport.rsid || "unknown"}`);
  } catch (exception) {
    const message = exception && exception.message ? exception.message : String(exception);
    error(`Extraction failed: ${message}`);
    downloadLogFile(message, getDiagnostics({ reason: "exception", steps: [`EXCEPTION: ${message}`] }));
  }
})();
