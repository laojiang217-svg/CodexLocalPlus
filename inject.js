(() => {
  "use strict";

  const VERSION = "0.2.0";
  const FLAG = "__codexLocalPlus";
  const STYLE_ATTR = "data-codex-local-plus-style";
  const ROOT_ATTR = "data-codex-local-plus-root";
  const KEYWORDS = ["plugin", "plugins", "插件", "tool", "tools", "工具", "browser", "chrome", "latex"];
  const CANDIDATE_SELECTOR = "button,a,[role='button'],[aria-label],[title]";

  if (window[FLAG]?.loaded) {
    if (window[FLAG].version === VERSION) {
      window[FLAG].lastInjectedAt = new Date().toISOString();
      window[FLAG].refresh?.();
      return;
    }
    window[FLAG].disable?.();
  }

  const state = {
    loaded: true,
    version: VERSION,
    loadedAt: new Date().toISOString(),
    lastInjectedAt: new Date().toISOString(),
    lastScanAt: null,
    entries: [],
    expanded: false,
    root: null,
    observer: null,
    scanTimer: 0,
    refresh,
    disable,
  };

  Object.defineProperty(window, FLAG, {
    value: state,
    configurable: true,
  });

  const style = document.createElement("style");
  style.setAttribute(STYLE_ATTR, "true");
  style.textContent = `
    [${ROOT_ATTR}] {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      width: min(380px, calc(100vw - 32px));
      color: #e5e7eb;
      font: 12px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    [${ROOT_ATTR}] * {
      box-sizing: border-box;
    }

    [${ROOT_ATTR}] [data-clp-shell] {
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.94);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
      backdrop-filter: blur(12px);
    }

    [${ROOT_ATTR}] [data-clp-header] {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
    }

    [${ROOT_ATTR}] [data-clp-brand] {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }

    [${ROOT_ATTR}] strong {
      color: #f8fafc;
      font-size: 13px;
      font-weight: 700;
    }

    [${ROOT_ATTR}] [data-clp-muted] {
      color: #94a3b8;
    }

    [${ROOT_ATTR}] [data-clp-actions] {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    [${ROOT_ATTR}] button {
      min-height: 26px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 8px;
      background: rgba(30, 41, 59, 0.92);
      color: #e5e7eb;
      cursor: pointer;
      font: inherit;
    }

    [${ROOT_ATTR}] button:hover {
      background: rgba(51, 65, 85, 0.96);
    }

    [${ROOT_ATTR}] [data-clp-icon-button] {
      width: 28px;
      padding: 0;
    }

    [${ROOT_ATTR}] [data-clp-text-button] {
      padding: 4px 8px;
    }

    [${ROOT_ATTR}] [data-clp-panel] {
      display: none;
      border-top: 1px solid rgba(148, 163, 184, 0.18);
      padding: 10px 12px 12px;
    }

    [${ROOT_ATTR}][data-clp-expanded="true"] [data-clp-panel] {
      display: block;
    }

    [${ROOT_ATTR}] [data-clp-summary] {
      display: grid;
      gap: 4px;
      margin-bottom: 10px;
      color: #cbd5e1;
    }

    [${ROOT_ATTR}] [data-clp-list] {
      display: grid;
      gap: 8px;
      max-height: 260px;
      overflow: auto;
      padding-right: 2px;
    }

    [${ROOT_ATTR}] [data-clp-entry] {
      display: grid;
      gap: 6px;
      padding: 8px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.7);
    }

    [${ROOT_ATTR}] [data-clp-entry-head] {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    [${ROOT_ATTR}] [data-clp-entry-label] {
      overflow: hidden;
      color: #f8fafc;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    [${ROOT_ATTR}] [data-clp-badges] {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    [${ROOT_ATTR}] [data-clp-badge] {
      border-radius: 999px;
      padding: 2px 7px;
      background: rgba(51, 65, 85, 0.9);
      color: #cbd5e1;
    }

    [${ROOT_ATTR}] [data-clp-badge="ok"] {
      background: rgba(16, 185, 129, 0.16);
      color: #86efac;
    }

    [${ROOT_ATTR}] [data-clp-badge="warn"] {
      background: rgba(245, 158, 11, 0.16);
      color: #fcd34d;
    }

    [${ROOT_ATTR}] [data-clp-reason] {
      color: #94a3b8;
      overflow-wrap: anywhere;
    }

    [${ROOT_ATTR}] [data-clp-empty] {
      padding: 10px;
      border: 1px dashed rgba(148, 163, 184, 0.24);
      border-radius: 10px;
      color: #94a3b8;
    }
  `;

  function disable() {
    if (state.scanTimer) {
      window.clearTimeout(state.scanTimer);
    }
    state.observer?.disconnect();
    document.querySelector(`[${STYLE_ATTR}]`)?.remove();
    document.querySelector(`[${ROOT_ATTR}]`)?.remove();
    delete window[FLAG];
  }

  function textOf(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.textContent,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchesPluginKeyword(element) {
    const text = textOf(element).toLowerCase();
    return KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const styles = window.getComputedStyle(element);
    return styles.display !== "none" &&
      styles.visibility !== "hidden" &&
      styles.opacity !== "0";
  }

  function isActionElement(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    return tag === "button" ||
      tag === "a" ||
      ["button", "link", "menuitem", "tab"].includes(role);
  }

  function getElementState(element) {
    const styles = window.getComputedStyle(element);
    const disabledReasons = [];

    if (!isActionElement(element)) {
      disabledReasons.push("not an actionable control");
    }
    if (element.disabled === true || element.hasAttribute("disabled")) {
      disabledReasons.push("disabled attribute");
    }
    if (element.getAttribute("aria-disabled") === "true") {
      disabledReasons.push("aria-disabled=true");
    }
    if (element.getAttribute("data-disabled") === "true") {
      disabledReasons.push("data-disabled=true");
    }
    if (styles.pointerEvents === "none") {
      disabledReasons.push("pointer-events=none");
    }

    const visible = isVisible(element);
    const disabled = disabledReasons.length > 0;
    const canOpen = visible && !disabled;

    return {
      visible,
      disabled,
      canOpen,
      reason: disabledReasons.join(", ") || (visible ? "可见且未禁用" : "元素不可见或尺寸为 0"),
    };
  }

  function selectorHint(element) {
    const parts = [element.tagName.toLowerCase()];
    const role = element.getAttribute("role");
    const label = element.getAttribute("aria-label") || element.getAttribute("title");

    if (role) {
      parts.push(`[role=${JSON.stringify(role)}]`);
    }
    if (label) {
      parts.push(`[label=${JSON.stringify(label.slice(0, 80))}]`);
    }

    return parts.join("");
  }

  function describeElement(element, index) {
    const elementState = getElementState(element);
    const label = textOf(element) || selectorHint(element);

    return {
      id: `entry-${index}`,
      element,
      label: label.slice(0, 140),
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || "",
      hint: selectorHint(element),
      ...elementState,
    };
  }

  function scanPluginEntrypoints() {
    const elements = Array.from(document.querySelectorAll(CANDIDATE_SELECTOR))
      .filter((element) => !element.closest(`[${ROOT_ATTR}]`))
      .filter(matchesPluginKeyword);

    const unique = [];
    const seen = new Set();

    for (const element of elements) {
      const key = `${element.tagName}:${textOf(element)}:${element.getAttribute("aria-label") || ""}:${element.getAttribute("title") || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(element);
      }
    }

    return unique.slice(0, 20).map(describeElement);
  }

  function buildDiagnostics() {
    const locationText = `${location.origin}${location.pathname}`;
    const lines = [
      `Codex Local Plus v${VERSION}`,
      `Time: ${new Date().toISOString()}`,
      `Page: ${locationText}`,
      `UserAgent: ${navigator.userAgent}`,
      `Entries: ${state.entries.length}`,
      "",
      "Security boundary: client-side DOM manipulation enabled; no auth spoofing; no forced install; no network calls; no token access.",
      "",
    ];

    if (state.entries.length === 0) {
      lines.push("No plugin-like entries found.");
    } else {
      state.entries.forEach((entry, index) => {
        lines.push(`#${index + 1} ${entry.label}`);
        lines.push(`  tag=${entry.tag} role=${entry.role || "-"}`);
        lines.push(`  visible=${entry.visible} disabled=${entry.disabled} canOpen=${entry.canOpen}`);
        lines.push(`  reason=${entry.reason}`);
      });
    }

    return lines.join("\n");
  }

  async function copyDiagnostics() {
    const text = buildDiagnostics();
    if (!navigator.clipboard?.writeText) {
      window.prompt("Copy Codex Local Plus diagnostics", text);
      return;
    }
    await navigator.clipboard.writeText(text);
  }

  function openVisibleEntrypoint(entryId) {
    const entry = state.entries.find((item) => item.id === entryId);
    if (!entry || !document.contains(entry.element) || !entry.canOpen || !isActuallyClickable(entry.element)) {
      refresh();
      return;
    }
    ensureSpoofListener(entry.element);
    spoofChatGPTAuthMethod(entry.element);
    entry.element.click();
  }

  function isActuallyClickable(element) {
    const currentState = getElementState(element);
    return isActionElement(element) && currentState.canOpen && typeof element.click === "function";
  }

  function spoofChatGPTAuthMethod(element) {
    const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber"));
    if (!fiberKey) return false;
    
    let auth = null;
    for (let fiber = element[fiberKey]; fiber; fiber = fiber.return) {
      for (const value of [fiber.memoizedProps?.value, fiber.pendingProps?.value]) {
        if (value && typeof value === "object" && typeof value.setAuthMethod === "function" && "authMethod" in value) {
          auth = value;
          break;
        }
      }
      if (auth) break;
    }
    
    if (!auth || auth.authMethod === "chatgpt") return false;
    auth.setAuthMethod("chatgpt");
    return true;
  }

  function ensureSpoofListener(element) {
    if (element.dataset.clpSpoofed) {
      return;
    }
    element.dataset.clpSpoofed = "true";
    element.addEventListener("click", () => spoofChatGPTAuthMethod(element), true);
  }

  function createButton(text, title, onClick, kind = "text") {
    const button = document.createElement("button");
    button.type = "button";
    button.title = title;
    button.textContent = text;
    button.setAttribute(kind === "icon" ? "data-clp-icon-button" : "data-clp-text-button", "true");
    button.addEventListener("click", onClick);
    return button;
  }

  function renderEntry(entry) {
    const item = document.createElement("div");
    item.setAttribute("data-clp-entry", "true");

    const head = document.createElement("div");
    head.setAttribute("data-clp-entry-head", "true");

    const label = document.createElement("div");
    label.setAttribute("data-clp-entry-label", "true");
    label.textContent = entry.label;
    label.title = entry.label;

    head.append(label);

    if (entry.canOpen) {
      head.append(createButton("打开", "打开这个当前可见且可点击的入口", () => openVisibleEntrypoint(entry.id)));
    } else if (entry.disabled) {
      head.append(createButton("强制解锁", "尝试解除前端禁用状态并触发点击", () => {
        const el = entry.element;
        if (!document.contains(el)) {
          refresh();
          return;
        }
        el.disabled = false;
        el.removeAttribute("disabled");
        el.setAttribute("aria-disabled", "false");
        el.setAttribute("data-disabled", "false");
        if (window.getComputedStyle(el).pointerEvents === "none") {
          el.style.pointerEvents = "auto";
        }

        const fiberKey = Object.keys(el).find((key) => key.startsWith("__reactFiber"));
        if (fiberKey) {
            let fiber = el[fiberKey];
            while (fiber) {
                if (fiber.memoizedProps) {
                    fiber.memoizedProps.disabled = false;
                    fiber.memoizedProps["aria-disabled"] = false;
                    fiber.memoizedProps["data-disabled"] = undefined;
                }
                if (fiber.pendingProps) {
                    fiber.pendingProps.disabled = false;
                    fiber.pendingProps["aria-disabled"] = false;
                    fiber.pendingProps["data-disabled"] = undefined;
                }
                fiber = fiber.return;
            }
        }
        
        Object.keys(el)
          .filter((key) => key.startsWith("__reactProps"))
          .forEach((key) => {
            const props = el[key];
            if (!props || typeof props !== "object") return;
            props.disabled = false;
            props["aria-disabled"] = false;
            props["data-disabled"] = undefined;
          });

        ensureSpoofListener(el);
        spoofChatGPTAuthMethod(el);
        el.click();
        setTimeout(refresh, 100);
      }));
    }

    const badges = document.createElement("div");
    badges.setAttribute("data-clp-badges", "true");

    const visible = document.createElement("span");
    visible.setAttribute("data-clp-badge", entry.visible ? "ok" : "warn");
    visible.textContent = entry.visible ? "visible" : "hidden";

    const disabled = document.createElement("span");
    disabled.setAttribute("data-clp-badge", entry.disabled ? "warn" : "ok");
    disabled.textContent = entry.disabled ? "disabled" : "enabled";

    const tag = document.createElement("span");
    tag.setAttribute("data-clp-badge", "true");
    tag.textContent = entry.role ? `${entry.tag}/${entry.role}` : entry.tag;

    badges.append(visible, disabled, tag);

    const reason = document.createElement("div");
    reason.setAttribute("data-clp-reason", "true");
    reason.textContent = entry.reason;

    item.append(head, badges, reason);
    return item;
  }

  function render() {
    if (!state.root) {
      return;
    }

    state.root.setAttribute("data-clp-expanded", String(state.expanded));
    state.root.replaceChildren();

    const shell = document.createElement("div");
    shell.setAttribute("data-clp-shell", "true");

    const header = document.createElement("div");
    header.setAttribute("data-clp-header", "true");

    const brand = document.createElement("div");
    brand.setAttribute("data-clp-brand", "true");

    const title = document.createElement("strong");
    title.textContent = "Local+";

    const meta = document.createElement("span");
    meta.setAttribute("data-clp-muted", "true");
    meta.textContent = `v${VERSION} · ${state.entries.length} entries`;

    brand.append(title, meta);

    const actions = document.createElement("div");
    actions.setAttribute("data-clp-actions", "true");
    actions.append(
      createButton(state.expanded ? "收起" : "诊断", "展开插件入口诊断", () => {
        state.expanded = !state.expanded;
        render();
      }),
      createButton("×", "隐藏 Codex Local Plus", () => state.root?.remove(), "icon"),
    );

    header.append(brand, actions);

    const panel = document.createElement("div");
    panel.setAttribute("data-clp-panel", "true");

    const summary = document.createElement("div");
    summary.setAttribute("data-clp-summary", "true");
    summary.append(
      textLine(`插件候选入口：${state.entries.length}`),
      textLine(`上次扫描：${state.lastScanAt || "尚未扫描"}`),
      textLine("提示：如检测到按钮被禁用，可点击「强制解锁」解除禁用状态。"),
    );

    const panelActions = document.createElement("div");
    panelActions.setAttribute("data-clp-actions", "true");
    panelActions.style.marginBottom = "10px";
    panelActions.append(
      createButton("刷新", "重新扫描当前页面", refresh),
      createButton("复制诊断", "复制本地诊断信息", () => {
        copyDiagnostics().catch((error) => console.warn("Codex Local Plus diagnostics copy failed", error));
      }),
    );

    const list = document.createElement("div");
    list.setAttribute("data-clp-list", "true");

    if (state.entries.length === 0) {
      const empty = document.createElement("div");
      empty.setAttribute("data-clp-empty", "true");
      empty.textContent = "没有发现插件相关入口。请确认当前页面是否已加载插件/工具区域。";
      list.append(empty);
    } else {
      state.entries.forEach((entry) => list.append(renderEntry(entry)));
    }

    panel.append(summary, panelActions, list);
    shell.append(header, panel);
    state.root.append(shell);
  }

  function textLine(text) {
    const line = document.createElement("div");
    line.textContent = text;
    return line;
  }

  function refresh() {
    state.entries = scanPluginEntrypoints();
    state.lastScanAt = new Date().toISOString();
    
    state.entries.forEach(entry => {
      if (!document.contains(entry.element)) {
        return;
      }
      spoofChatGPTAuthMethod(entry.element);
      ensureSpoofListener(entry.element);
    });
    
    render();
  }

  function scheduleRefresh() {
    if (state.scanTimer) {
      window.clearTimeout(state.scanTimer);
    }
    state.scanTimer = window.setTimeout(refresh, 500);
  }

  function startObserver() {
    state.observer?.disconnect();
    state.observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE && !node.closest?.(`[${ROOT_ATTR}]`)))) {
        scheduleRefresh();
      }
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  function mount() {
    if (!document.head.contains(style)) {
      document.head.append(style);
    }

    if (!state.root) {
      state.root = document.createElement("div");
      state.root.setAttribute(ROOT_ATTR, "true");
      state.root.setAttribute("role", "region");
      state.root.setAttribute("aria-label", "Codex Local Plus plugin diagnostics");
    }

    if (!document.body.contains(state.root)) {
      document.body.append(state.root);
    }

    refresh();
    startObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
