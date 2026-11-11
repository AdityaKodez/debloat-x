(() => {
  "use strict";

  const root = document.documentElement;
  const OFF_CLASS = "dx-off";
  const OFF_KEY = "debloat-x:off";
  const PROFILE_KEY = "debloat-x:profile";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const X_LOGO_PATH =
    "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
  const DESKTOP_QUERY = window.matchMedia("(min-width: 701px)");
  const PROFILE_SELECTOR = '[data-testid="AppTabBar_Profile_Link"]';
  const SEARCH_SELECTOR = '[data-testid="primaryColumn"] [data-testid="SearchBox_Search_Input"]';
  const ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
  const UPSELL_SELECTOR = '[data-testid="primaryColumn"] a[href="/i/premium_sign_up"]';
  const MEDIA_SELECTOR = 'article [data-testid="tweetPhoto"], article [data-testid="videoPlayer"]';
  const NEW_POSTS_SELECTOR = '[role="status"] button:has([data-testid="pillLabel"])';
  const PROFILE_PATH = /^\/[A-Za-z0-9_]{1,15}$/;
  const POST_PATH = /^\/[A-Za-z0-9_]{1,15}\/status\/\d+/;
  // Pages that use X's full-width layout. Every other page gets the centered content column
  // from the first frame, so the column never resizes when the sidebar mounts.
  const WIDE_ROUTES = ["/settings", "/i/chat", "/messages", "/i/grok"];
  // Modal URLs open over the current page (write, photo viewer, display settings).
  // They keep the page's route so the page behind the modal does not change layout.
  const MODAL_PATH = /^\/compose\/|^\/i\/(display|keyboard_shortcuts)\b|\/status\/\d+\/(photo|video|analytics)\b/;

  // Local storage is synchronous, so the off state is known before X renders anything.
  // chrome.storage stays the source of truth and refreshes this mirror below.
  const readLocal = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const writeLocal = (key, value) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (error) {
      console.warn("Debloat X could not write local storage.", error);
    }
  };

  let enabled = readLocal(OFF_KEY) !== "1";
  root.classList.toggle(OFF_CLASS, !enabled);

  const startsWithAny = (path, prefixes) => prefixes.some((prefix) => path === prefix || path.startsWith(prefix + "/"));

  const NAV_ITEMS = [
    { key: "home", label: "home", path: "/home", native: '[data-testid="AppTabBar_Home_Link"]', match: (path) => path === "/home" },
    { key: "explore", label: "explore", hint: "/", path: "/explore", native: '[data-testid="AppTabBar_Explore_Link"]', match: (path) => startsWithAny(path, ["/explore", "/search"]) },
    { key: "notifications", label: "notifications", path: "/notifications", native: '[data-testid="AppTabBar_Notifications_Link"]', count: true, match: (path) => startsWithAny(path, ["/notifications"]) },
    { key: "chat", label: "chat", path: "/i/chat", native: '[data-testid="AppTabBar_DirectMessage_Link"]', count: true, match: (path) => startsWithAny(path, ["/i/chat", "/messages"]) },
    { key: "history", label: "history", path: "/i/history", native: 'header[role="banner"] a[href="/i/history"]', match: (path) => startsWithAny(path, ["/i/history", "/i/bookmarks"]) },
    {
      key: "profile",
      label: "profile",
      path: "/",
      native: PROFILE_SELECTOR,
      match: (path, profilePath) => {
        if (!profilePath) return false;
        const current = path.toLowerCase();
        const own = profilePath.toLowerCase();
        return (current === own || current.startsWith(own + "/")) && !current.startsWith(own + "/status/");
      },
    },
  ];

  const ACTION_ITEMS = [
    { key: "write", label: "write", hint: "n", path: "/compose/post", native: '[data-testid="SideNav_NewTweet_Button"]' },
    { key: "settings", label: "settings", path: "/settings", match: (path) => startsWithAny(path, ["/settings"]) },
  ];

  const ALL_ITEMS = [...NAV_ITEMS, ...ACTION_ITEMS];
  const ITEMS_BY_KEY = new Map(ALL_ITEMS.map((item) => [item.key, item]));
  const itemLinks = new Map();

  const cachedProfile = readLocal(PROFILE_KEY);
  let profilePath = cachedProfile && PROFILE_PATH.test(cachedProfile) ? cachedProfile : "";
  let nav = null;
  let glassFilter = null;
  let nativeHeader = null;
  let lastPath = "";

  const nativeObserver = new MutationObserver(() => updateNav(true));
  const themeObserver = new MutationObserver(() => syncTheme());

  const setText = (node, value) => {
    if (node.textContent !== value) node.textContent = value;
  };

  const setAttr = (node, name, value) => {
    if (value === null) {
      if (node.hasAttribute(name)) node.removeAttribute(name);
    } else if (node.getAttribute(name) !== value) {
      node.setAttribute(name, value);
    }
  };

  const isEditable = (target) =>
    target instanceof Element &&
    !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]');

  const navigate = (path) => {
    if (location.pathname === path) return;
    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  };

  const focusSearch = (attempt = 0) => {
    if (document.querySelector('[role="dialog"][aria-modal="true"], #layers [role="dialog"]')) return;
    const input = document.querySelector(SEARCH_SELECTOR);
    if (input) {
      input.focus();
      return;
    }
    if (attempt === 0) {
      const nativeTarget = document.querySelector('[data-testid="AppTabBar_Explore_Link"]');
      if (nativeTarget) nativeTarget.click();
      else navigate("/explore");
    }
    if (attempt < 40) setTimeout(() => focusSearch(attempt + 1), 50);
  };

  function activate(key) {
    const item = ITEMS_BY_KEY.get(key);
    if (!item) return;
    const nativeTarget = item.native && document.querySelector(item.native);
    if (nativeTarget) {
      nativeTarget.click();
    } else if (key === "profile" && !profilePath) {
      console.warn("Debloat X has not found your profile link yet.");
    } else {
      navigate(key === "profile" ? profilePath : item.path);
    }
  }

  const buildLogo = () => {
    const link = document.createElement("a");
    link.className = "dx-logo";
    link.href = "/home";
    link.dataset.dxKey = "home";
    link.setAttribute("aria-label", "home");
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", X_LOGO_PATH);
    svg.append(path);
    link.append(svg);
    return link;
  };

  // An inline SVG filter lets the post back button refract the content behind it.
  const buildGlassFilter = () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.id = "dx-glass";
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const noise = document.createElementNS(SVG_NS, "feTurbulence");
    noise.setAttribute("type", "fractalNoise");
    noise.setAttribute("baseFrequency", "0.015 0.025");
    noise.setAttribute("numOctaves", "2");
    noise.setAttribute("result", "noise");
    const displacement = document.createElementNS(SVG_NS, "feDisplacementMap");
    displacement.setAttribute("in", "SourceGraphic");
    displacement.setAttribute("in2", "noise");
    displacement.setAttribute("scale", "8");
    displacement.setAttribute("xChannelSelector", "R");
    displacement.setAttribute("yChannelSelector", "G");
    filter.append(noise, displacement);
    svg.append(filter);
    return svg;
  };

  const buildItem = (item) => {
    const link = document.createElement("a");
    link.className = "dx-item";
    link.href = item.path;
    link.dataset.dxKey = item.key;
    const label = document.createElement("span");
    label.className = "dx-label";
    label.textContent = item.label;
    const meta = document.createElement("span");
    meta.className = item.hint ? "dx-hint" : "dx-count";
    meta.textContent = item.hint || "";
    link.append(label, meta);
    itemLinks.set(item.key, link);
    return link;
  };

  const buildGroup = (items) => {
    const group = document.createElement("div");
    group.className = "dx-group";
    group.append(...items.map(buildItem));
    return group;
  };

  const buildNav = () => {
    const element = document.createElement("nav");
    element.id = "dx-nav";
    element.setAttribute("aria-label", "Debloat X navigation");
    element.append(buildLogo(), buildGroup(NAV_ITEMS), buildGroup(ACTION_ITEMS));
    element.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest("a[data-dx-key]") : null;
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      activate(link.dataset.dxKey);
    });
    return element;
  };

  const readCount = (nativeLink) => {
    if (!nativeLink) return "";
    const label = nativeLink.getAttribute("aria-label") || "";
    const fromLabel = label.match(/(\d[\d,.]*\+?)\s+unread/i);
    if (fromLabel) return fromLabel[1];
    for (const node of nativeLink.querySelectorAll("span, div")) {
      if (node.children.length) continue;
      const text = node.textContent.trim();
      if (/^\d+\+?$/.test(text)) return text;
    }
    return "";
  };

  // X writes the saved theme into the server-rendered <body style>, so this is correct on the first frame.
  const syncTheme = () => {
    const channels = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
    if (!channels || channels.length < 3) return;
    const [red, green, blue] = channels.map(Number);
    const theme = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.5 ? "light" : "dark";
    if (root.dataset.dxTheme !== theme) root.dataset.dxTheme = theme;
  };

  const watchNativeNav = () => {
    const header = document.querySelector('header[role="banner"]');
    if (header === nativeHeader) return;
    nativeObserver.disconnect();
    nativeHeader = header;
    if (header) {
      nativeObserver.observe(header, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "href"] });
    }
  };

  function updateNav(force = false) {
    if (!nav) return;
    syncRoute();
    const searchInput = document.querySelector(SEARCH_SELECTOR);
    if (searchInput && searchInput.placeholder !== "search") searchInput.placeholder = "search";
    const path = location.pathname;
    const liveProfile = document.querySelector(PROFILE_SELECTOR)?.getAttribute("href") || "";
    if (liveProfile && PROFILE_PATH.test(liveProfile) && liveProfile !== profilePath) {
      profilePath = liveProfile;
      writeLocal(PROFILE_KEY, profilePath);
      force = true;
    }
    if (!force && path === lastPath) return;
    lastPath = path;
    for (const item of ALL_ITEMS) {
      const link = itemLinks.get(item.key);
      if (item.key === "profile" && profilePath) setAttr(link, "href", profilePath);
      setAttr(link, "aria-current", item.match?.(path, profilePath) ? "page" : null);
      if (item.count) setText(link.lastElementChild, readCount(document.querySelector(item.native)));
    }
  }

  const isPromoted = (article) => {
    for (const span of article.querySelectorAll("span")) {
      if (span.children.length) continue;
      const text = span.textContent.trim();
      if ((text === "Ad" || text === "Promoted") && !span.closest('[data-testid="tweetText"], [data-testid="User-Name"] a')) {
        return true;
      }
    }
    return false;
  };

  const checkArticle = (article) => {
    const cell = article.closest('[data-testid="cellInnerDiv"]');
    if (!cell) return;
    if (isPromoted(article)) setAttr(cell, "data-dx-promoted", "");
    else setAttr(cell, "data-dx-promoted", null);
  };

  // CSS hides the known card shape. This catches the same card if X changes its nesting depth.
  const markUpsell = (link) => {
    let node = link.parentElement;
    for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
      if (node.matches('[data-testid="primaryColumn"], [data-testid="cellInnerDiv"]')) return;
      const style = getComputedStyle(node);
      if (style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.borderRadius !== "0px") {
        setAttr(node, "data-dx-upsell", "");
        return;
      }
    }
  };

  // X draws the rounded border around a post's photos or video on an ancestor a few levels up.
  // Mark that frame so CSS can give it the double border without relying on X's nesting depth.
  const markMedia = (media) => {
    let node = media.parentElement;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      if (node.matches("article, [data-dx-media]")) return;
      const style = getComputedStyle(node);
      if (parseFloat(style.borderTopWidth) > 0 && parseFloat(style.borderTopLeftRadius) > 0) {
        setAttr(node, "data-dx-media", "");
        return;
      }
    }
  };

  // Explore keeps Today's News (as a plain "title … time" list) and the post feed.
  // Trends, who to follow and their "show more" links are hidden.
  const CELL_SELECTOR = '[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]';
  const markShowPosts = (cell) => {
    for (const button of cell.querySelectorAll('button, [role="button"]')) {
      const label = button.textContent.replace(/\s+/g, " ").trim();
      const isShowPosts = !button.closest("article") && /^show\s+[\d,.]+\s+posts?$/i.test(label);
      setAttr(button, "data-dx-show-posts", isShowPosts ? "" : null);
    }
  };
  const HIDE_IN_EXPLORE = '[data-testid="UserCell"], a[href^="/i/connect_people"], a[href^="/i/trends"]';
  const TIME_TEXT = /^(\d+)\s*(s|m|h|d|sec|secs|min|mins|minutes?|hours?|hrs?|days?)\b(\s+ago)?$|^(trending now|live)$/i;

  const cellTexts = (cell) => {
    const texts = [];
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest('.dx-news, [data-testid^="UserAvatar"]')) continue;
      const text = node.textContent.replace(/\s+/g, " ").trim();
      if (text) texts.push(text);
    }
    return texts;
  };

  const shortTime = (text) => {
    const match = text.split("·", 1)[0].trim().match(TIME_TEXT);
    if (!match) return "";
    if (match[4]) return match[4].toLowerCase() === "live" ? "live" : "now";
    return match[1] + match[2][0].toLowerCase();
  };

  const classifyExploreCell = (cell) => {
    if (cell.querySelector("article")) return { kind: null };
    if (cell.querySelector(HIDE_IN_EXPLORE)) return { kind: "hide" };
    const heading = cell.querySelector('h2, [role="heading"]');
    if (heading) {
      if (/news/i.test(heading.textContent)) return { kind: "news-head" };
      return { kind: /who to follow|trends/i.test(heading.textContent) ? "hide" : null };
    }
    // X uses "trend" for both news stories and topics. Only topics have a More menu.
    const trend = cell.querySelector('[data-testid="trend"]');
    if (trend?.querySelector('button[aria-label="More"]')) return { kind: "hide" };
    const texts = cellTexts(cell);
    // Empty section dividers survive after trends and recommendations are hidden.
    // Keep loading indicators and controls while X is still populating a cell.
    if (!texts.length) return { kind: cell.querySelector('[role="progressbar"], [aria-busy="true"], img, video, button, a[href]') ? null : "hide" };
    const time = texts.map(shortTime).find(Boolean) || "";
    const title = trend?.querySelector('[dir="ltr"]')?.textContent.trim() || "";
    const target = cell.querySelector('[role="link"]:not(.dx-news), a[href]:not(.dx-news)');
    if (trend && !time) return { kind: null };
    return title && target ? { kind: "news", title, time, target } : { kind: null };
  };

  const renderNews = (cell, { title, time, target }) => {
    let row = cell.querySelector(":scope > .dx-news");
    const href = target.getAttribute("href");
    const tag = href ? "a" : "button";
    if (row && row.localName !== tag) {
      row.remove();
      row = null;
    }
    if (!row) {
      row = document.createElement(tag);
      row.className = "dx-news";
      if (!href) row.type = "button";
      const label = document.createElement("span");
      label.className = "dx-news-title";
      const meta = document.createElement("span");
      meta.className = "dx-news-time";
      row.append(label, meta);
      row.addEventListener("click", (event) => {
        if (event.button !== 0 || (row.hasAttribute("href") && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))) return;
        event.preventDefault();
        row.dxTarget?.click();
      });
      cell.append(row);
    }
    row.dxTarget = target;
    row.dataset.title = title;
    setAttr(row, "href", href);
    setText(row.firstElementChild, title);
    setText(row.lastElementChild, time);
  };

  const processExploreCell = (cell) => {
    const result = classifyExploreCell(cell);
    setAttr(cell, "data-dx-explore", result.kind);
    if (result.kind === "news") renderNews(cell, result);
    else cell.querySelector(":scope > .dx-news")?.remove();
  };

  const scanExplore = (cells) => {
    if (root.dataset.dxRoute !== "explore") return;
    for (const cell of cells) if (cell.isConnected) processExploreCell(cell);
  };

  const scanAdded = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(ARTICLE_SELECTOR)) {
      checkArticle(node);
    } else {
      const host = node.closest(ARTICLE_SELECTOR);
      if (host) {
        const text = node.textContent;
        if (text.includes("Ad") || text.includes("Promoted")) checkArticle(host);
      } else {
        for (const article of node.querySelectorAll(ARTICLE_SELECTOR)) checkArticle(article);
      }
    }
    if (node.matches(UPSELL_SELECTOR)) markUpsell(node);
    else for (const link of node.querySelectorAll(UPSELL_SELECTOR)) markUpsell(link);
    if (node.matches(MEDIA_SELECTOR)) markMedia(node);
    else for (const media of node.querySelectorAll(MEDIA_SELECTOR)) markMedia(media);
    if (node.matches(CELL_SELECTOR)) markShowPosts(node);
    else for (const cell of node.querySelectorAll(CELL_SELECTOR)) markShowPosts(cell);
  };

  function syncRoute() {
    const path = location.pathname;
    if (root.dataset.dxRoute && MODAL_PATH.test(path)) return;
    const route =
      path === "/home"
        ? "home"
        : startsWithAny(path, ["/explore"])
          ? "explore"
          : WIDE_ROUTES.some((prefix) => startsWithAny(path, [prefix]))
            ? "wide"
            : POST_PATH.test(path)
              ? "post"
              : "page";
    if (root.dataset.dxRoute !== route) {
      root.dataset.dxRoute = route;
      if (route === "explore") queueMicrotask(() => scanExplore(document.querySelectorAll(CELL_SELECTOR)));
    }
  }

  const sync = () => {
    syncRoute();
    if (!document.body) return;
    if (!glassFilter) glassFilter = buildGlassFilter();
    if (!glassFilter.isConnected) document.body.prepend(glassFilter);
    if (!nav) {
      nav = buildNav();
      syncTheme();
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
    }
    if (!nav.isConnected) document.body.prepend(nav);
    watchNativeNav();
    updateNav();
  };

  // MutationObserver callbacks run as microtasks after X commits DOM and before the browser paints.
  // That keeps every JS-driven change out of the visible frames.
  const onMutations = (records) => {
    if (!enabled) return;
    sync();
    const exploreCells = new Set();
    const onExplore = root.dataset.dxRoute === "explore";
    for (const record of records) {
      for (const node of record.addedNodes) scanAdded(node);
      const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      const cell = target?.closest(CELL_SELECTOR);
      if (cell) markShowPosts(cell);
      if (!onExplore) continue;
      if (cell) exploreCells.add(cell);
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches(CELL_SELECTOR)) exploreCells.add(node);
        for (const found of node.querySelectorAll(CELL_SELECTOR)) exploreCells.add(found);
      }
    }
    scanExplore(exploreCells);
  };

  const setEnabled = (value) => {
    enabled = value;
    writeLocal(OFF_KEY, enabled ? null : "1");
    root.classList.toggle(OFF_CLASS, !enabled);
    if (enabled) {
      sync();
      if (document.body) scanAdded(document.body);
      scanExplore(document.querySelectorAll(CELL_SELECTOR));
    }
  };

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === ".") {
        if (!enabled || !DESKTOP_QUERY.matches || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat || isEditable(event.target)) return;
        if (document.querySelector('[role="dialog"][aria-modal="true"], #layers [role="dialog"]')) return;
        const button = [...document.querySelectorAll(NEW_POSTS_SELECTOR)].find(
          (candidate) => !candidate.disabled && candidate.getAttribute("aria-disabled") !== "true" && candidate.getClientRects().length && getComputedStyle(candidate).visibility === "visible",
        );
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        button.click();
        return;
      }
      if (!enabled || !DESKTOP_QUERY.matches || event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], #layers [role="dialog"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      focusSearch();
    },
    true,
  );

  // Route changes update the route attribute synchronously, before X renders the next page.
  globalThis.navigation?.addEventListener?.("currententrychange", () => enabled && sync());
  window.addEventListener("popstate", () => enabled && sync());
  new MutationObserver(onMutations).observe(root, { childList: true, characterData: true, subtree: true });
  syncRoute();
  if (enabled) sync();

  const storage = globalThis.chrome?.storage?.local;
  if (storage) {
    storage
      .get({ enabled: true })
      .then((result) => {
        const next = result.enabled !== false;
        if (next !== enabled) setEnabled(next);
      })
      .catch((error) => console.error("Debloat X could not read its on/off setting.", error));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.enabled) setEnabled(changes.enabled.newValue !== false);
    });
  }
})();
