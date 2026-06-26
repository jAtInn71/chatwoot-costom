// ── Chatwoot Voice + Widget Extensions ───────────────────────────────────────
// Appended to sdk.js at Docker build time — runs on every parent page that
// loads sdk.js. Nothing extra needed in the embed snippet.
//
// FEATURES bundled here (all host-page-safe — no global API patching):
//
//  1. WIDGET STATE PERSISTENCE
//     If widget was open when user navigated away, auto-open it on the new page.
//     Works for both text chat and voice. Uses localStorage key 'cw_widget_open'.
//
//  2. FLOATING "END CALL" BUTTON
//     Red pulsing button appears on the page when a voice call is active.
//     Visible even when widget bubble is minimized. Click to end the call.
//
//  4. PRE-CHAT FORM AUTO-FILL from website cookies (see below).
//
//  (Former Feature 3 — voice-aware SPA navigation — was removed; it re-ran
//   host page scripts and broke modern frameworks. See the note further down.)
//
// ─────────────────────────────────────────────────────────────────────────────
// ── Native API Shield (restore) — INERT ─────────────────────────────────────
// This block used to restore native browser APIs saved by the prefix script
// (sdk-stream-fix.js). That prefix has been removed, so window.__cwNativeAPIs
// is undefined and this block early-returns (no-op). Kept for now so old
// cached builds degrade safely; can be deleted in a later cleanup.
;(function () {
  var s = window.__cwNativeAPIs;
  if (!s) return;
  var w = window, d = document, h = w.history;

  // Only restore if the SDK actually changed it (avoid overwriting with undefined
  // on browsers that don't support a given API).
  function r(obj, key, orig) {
    try {
      if (orig !== undefined && obj[key] !== orig) obj[key] = orig;
    } catch (_) {}
  }

  // Streaming
  r(w, 'ReadableStream',       s.ReadableStream);
  r(w, 'WritableStream',       s.WritableStream);
  r(w, 'TransformStream',      s.TransformStream);
  // Fetch / Network
  r(w, 'fetch',                s.fetch);
  r(w, 'Request',              s.Request);
  r(w, 'Response',             s.Response);
  r(w, 'Headers',              s.Headers);
  r(w, 'AbortController',      s.AbortController);
  r(w, 'AbortSignal',          s.AbortSignal);
  r(w, 'XMLHttpRequest',       s.XMLHttpRequest);
  r(w, 'EventSource',          s.EventSource);
  r(w, 'WebSocket',            s.WebSocket);
  // Navigation / History
  if (h) {
    r(h, 'pushState',          s.historyPushState);
    r(h, 'replaceState',       s.historyReplaceState);
  }
  // URL
  r(w, 'URL',                  s.URL);
  r(w, 'URLSearchParams',      s.URLSearchParams);
  // Observers
  r(w, 'MutationObserver',     s.MutationObserver);
  r(w, 'IntersectionObserver', s.IntersectionObserver);
  r(w, 'ResizeObserver',       s.ResizeObserver);
  r(w, 'PerformanceObserver',  s.PerformanceObserver);
  // Messaging
  r(w, 'MessageChannel',       s.MessageChannel);
  r(w, 'MessagePort',          s.MessagePort);
  r(w, 'BroadcastChannel',     s.BroadcastChannel);
  // Promises / Async
  r(w, 'Promise',              s.Promise);
  r(w, 'queueMicrotask',       s.queueMicrotask);
  // Timers
  r(w, 'setTimeout',           s.setTimeout);
  r(w, 'clearTimeout',         s.clearTimeout);
  r(w, 'setInterval',          s.setInterval);
  r(w, 'clearInterval',        s.clearInterval);
  r(w, 'requestAnimationFrame',    s.requestAnimationFrame);
  r(w, 'cancelAnimationFrame',     s.cancelAnimationFrame);
  r(w, 'requestIdleCallback',      s.requestIdleCallback);
  r(w, 'cancelIdleCallback',       s.cancelIdleCallback);
  // Events
  r(w, 'CustomEvent',          s.CustomEvent);
  r(w, 'Event',                s.Event);
  // DOM (document methods — only restore if they were captured)
  try {
    if (s.createElement)      d.createElement      = s.createElement;
    if (s.createElementNS)    d.createElementNS    = s.createElementNS;
    if (s.createTreeWalker)   d.createTreeWalker   = s.createTreeWalker;
    if (s.querySelector)      d.querySelector      = s.querySelector;
    if (s.querySelectorAll)   d.querySelectorAll   = s.querySelectorAll;
  } catch (_) {}

  // ── Restore window.onmessage ──────────────────────────────────────────
  // The prefix made onmessage a non-overwritable property that captures
  // any handler the SDK tried to set via addEventListener instead.
  // Now remove that guard so the host page can use onmessage normally.
  try {
    // Remove the captured handlers that Chatwoot set via the trapped setter
    // (they're already registered as addEventListener — no data loss)
    var trapped = w.__cwOnMessageHandlers || [];
    // Delete the property descriptor to restore normal behavior
    delete w.onmessage;
    // If delete didn't work (some engines), redefine as writable
    if (Object.getOwnPropertyDescriptor(w, 'onmessage')) {
      Object.defineProperty(w, 'onmessage', {
        configurable: true,
        writable: true,
        value: null,
      });
    }
    delete w.__cwOnMessageHandlers;
  } catch (_) {}

  // ── Restore prototypes if polluted ────────────────────────────────────
  try {
    var snap = w.__cwProtoSnapshot;
    if (snap) {
      var currentArrayKeys = Object.getOwnPropertyNames(Array.prototype);
      currentArrayKeys.forEach(function (k) {
        if (snap.ArrayProtoKeys.indexOf(k) === -1) {
          try { delete Array.prototype[k]; } catch (_) {}
        }
      });
      var currentObjKeys = Object.getOwnPropertyNames(Object.prototype);
      currentObjKeys.forEach(function (k) {
        if (snap.ObjectProtoKeys.indexOf(k) === -1) {
          try { delete Object.prototype[k]; } catch (_) {}
        }
      });
      delete w.__cwProtoSnapshot;
    }
  } catch (_) {}

  delete w.__cwNativeAPIs;
})();

;(function () {
  if (window._cwVoiceInstalled) return;
  window._cwVoiceInstalled = true;

  // Shared flag — true while a voice call is in progress
  window._cwVoiceActive = false;


  // localStorage key for widget open/close state
  var WIDGET_OPEN_KEY = 'cw_widget_open';

  // ════════════════════════════════════════════════════════════════════════
  // FEATURE 1 — Widget state persistence across page navigation
  // ════════════════════════════════════════════════════════════════════════
  //
  // Flow:
  //   Page A: widget open  → localStorage: cw_widget_open = "true"
  //   Navigate to Page B   → widget closes (browser default)
  //   chatwoot:ready fires → reads "true" → auto-opens widget after 800ms
  //
  // During voice SPA navigation the page is NOT reloaded, so chatwoot:ready
  // does NOT fire — no conflict with feature 3 below.

  // ════════════════════════════════════════════════════════════════════════
  // FEATURE 4 — Pre-chat form auto-fill from website cookies
  // ════════════════════════════════════════════════════════════════════════
  //
  // Reads user data from website cookies (set at login) and sends it to the
  // Chatwoot iframe so the pre-chat form opens pre-filled.
  // Customer can still edit/clear any field before submitting.
  //
  // ⚙️  CONFIGURE: Set your website's cookie names below.
  //     Open DevTools → Application → Cookies → find the keys after login.

  var PREFILL_COOKIE_KEYS = {
    name:  'user_name',   // ← apne cookie ka naam yahan daalo
    email: 'user_email',  // ← apne cookie ka naam yahan daalo
    phone: 'user_phone',  // ← apne cookie ka naam yahan daalo (optional)
  };

  function readCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function sendPrefillData() {
    var name  = readCookie(PREFILL_COOKIE_KEYS.name);
    var email = readCookie(PREFILL_COOKIE_KEYS.email);
    var phone = readCookie(PREFILL_COOKIE_KEYS.phone);

    if (!name && !email && !phone) return; // not logged in — skip

    document.querySelectorAll('iframe').forEach(function (f) {
      try {
        f.contentWindow.postMessage({
          event: 'prefill-form-data',
          name:  name  || '',
          email: email || '',
          phone: phone || '',
        }, '*');
      } catch (_) {}
    });
  }

  // ── Fix iframe audio autoplay permission ────────────────────────────────
  // Only patches the Chatwoot iframe (by ID), not every iframe on the page.
  function fixIframeAudioPermission() {
    try {
      var f = document.getElementById('chatwoot_live_chat_widget');
      if (!f || !f.getAttribute) return;
      var allow = f.getAttribute('allow') || '';
      var needs = ['microphone', 'autoplay', 'camera'];
      var missing = needs.filter(function(p) { return !allow.includes(p); });
      if (missing.length > 0) {
        f.setAttribute('allow', (allow + '; ' + missing.join('; ')).trim());
      }
    } catch (_) {}
  }

  // Run once immediately; then observe only direct children of body (not subtree)
  // so framework DOM updates (React, Vue, Svelte) don't trigger this.
  fixIframeAudioPermission();
  try {
    var _iframeObserver = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        for (var j = 0; j < mutations[i].addedNodes.length; j++) {
          var node = mutations[i].addedNodes[j];
          if (node.id === 'cw-widget-holder' || node.id === 'chatwoot_live_chat_widget') {
            fixIframeAudioPermission();
            return;
          }
        }
      }
    });
    if (document.body) {
      _iframeObserver.observe(document.body, { childList: true });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        _iframeObserver.observe(document.body, { childList: true });
      });
    }
  } catch (_) {}

  // ── Custom bubble icon support ───────────────────────────────────────────
  // Intercepts the 'loaded' chatwoot-widget postMessage (sent by the widget
  // iframe) to read customBubbleIconUrl/Size directly from channelConfig.
  // This works regardless of which sdk.js is served.
  var _cwCustomBubbleIconUrl = null;
  var _cwCustomBubbleIconSize = 60;
  var _cwWidgetColor = null;

  function _applyCwBubbleIcon() {
    if (!_cwCustomBubbleIconUrl) return false;
    var bubble = document.querySelector('.woot-widget-bubble:not(.woot--close)');
    if (!bubble) return false;

    // Hide SVG so it doesn't render on top of background layers
    var svg = bubble.querySelector('svg');
    if (svg) svg.style.display = 'none';

    var iconUrl = "url('" + _cwCustomBubbleIconUrl.replace(/'/g, "\\'") + "')";
    var sizePct = (_cwCustomBubbleIconSize || 60) + '%';
    var bgColor = _cwWidgetColor || '#1f93ff';
    var isGradient = bgColor.includes('gradient');

    if (isGradient) {
      // Gradient: layer icon on top of gradient using background-image shorthand
      bubble.style.backgroundImage = iconUrl + ', ' + bgColor;
      bubble.style.backgroundSize = sizePct + ', cover';
      bubble.style.backgroundPosition = 'center, center';
      bubble.style.backgroundRepeat = 'no-repeat, no-repeat';
      bubble.style.backgroundColor = '';
    } else {
      // Solid color: background-image only has the icon; color goes in background-color
      bubble.style.backgroundImage = iconUrl;
      bubble.style.backgroundSize = sizePct;
      bubble.style.backgroundPosition = 'center';
      bubble.style.backgroundRepeat = 'no-repeat';
      bubble.style.backgroundColor = bgColor;
    }
    return true;
  }

  // Intercept the chatwoot-widget 'loaded' string message to get channelConfig
  window.addEventListener('message', function (e) {
    try {
      if (typeof e.data !== 'string' || e.data.indexOf('chatwoot-widget:') !== 0) return;
      var msg = JSON.parse(e.data.replace('chatwoot-widget:', ''));
      if (msg.event !== 'loaded') return;

      var ch = msg.config && msg.config.channelConfig;
      if (!ch || !ch.customBubbleIconUrl) return;

      _cwCustomBubbleIconUrl = ch.customBubbleIconUrl;
      _cwCustomBubbleIconSize = ch.customBubbleIconSize || 60;
      _cwWidgetColor = ch.widgetColor || '#1f93ff';

      // Bubble may not exist yet — poll until it appears
      var attempts = 0;
      var poll = setInterval(function () {
        if (_applyCwBubbleIcon() || ++attempts > 40) clearInterval(poll);
      }, 150);
    } catch (_) {}
  });

  // Outer-scope so the postMessage listener can reset it when call starts/ends.
  var _prevWidgetOpen = null;

  // Also re-apply on chatwoot:ready (handles page re-navigation edge cases)
  window.addEventListener('chatwoot:ready', function () {
    setTimeout(function () { _applyCwBubbleIcon(); }, 200);
  });

  window.addEventListener('chatwoot:ready', function () {

    // ── Restore widget state from previous page ──────────────────────────
    // On mobile (≤666px) never auto-open — user must tap the bubble manually.
    try {
      var _isMobileScreen = window.matchMedia('(max-width: 666px)').matches;
      if (!_isMobileScreen && localStorage.getItem(WIDGET_OPEN_KEY) === 'true') {
        setTimeout(function () {
          try {
            if (window.$chatwoot && !window.$chatwoot.isOpen) {
              window.$chatwoot.toggle('open');
            }
          } catch (_) {}
        }, 800);
      }
    } catch (_) {}

    // ── Save widget state + sync floating button ──────────────────────────
    // Events fire when available; polling catches everything else.
    // _prevWidgetOpen is declared in outer scope so postMessage listener can reset it.
    function _syncFloatingBtn(isOpen) {
      try { localStorage.setItem(WIDGET_OPEN_KEY, isOpen ? 'true' : 'false'); } catch (_) {}
      if (_prevWidgetOpen === isOpen) return; // no change — nothing to do
      _prevWidgetOpen = isOpen;

      if (window._cwVoiceActive) {
        if (isOpen) {
          hideBtn();   // widget opened: call UI visible inside widget
        } else {
          showBtn();   // widget closed: show floating End Call button
        }
      }
    }

    window.addEventListener('chatwoot:on-open',  function () {
      _syncFloatingBtn(true);
      setTimeout(sendPrefillData, 300);
    });
    window.addEventListener('chatwoot:on-close', function () {
      _syncFloatingBtn(false);
    });

    // Polling fallback — fires every 400ms so state-change is caught quickly
    // even if chatwoot:on-open / chatwoot:on-close events are not dispatched.
    setInterval(function () {
      try {
        if (window.$chatwoot) _syncFloatingBtn(!!window.$chatwoot.isOpen);
      } catch (_) {}
    }, 400);

  });

  // ════════════════════════════════════════════════════════════════════════
  // FEATURE 2 — Floating "End Call" button
  // ════════════════════════════════════════════════════════════════════════

  var BTN_ID = 'cw-voice-end-btn';

  function getBtn() { return document.getElementById(BTN_ID); }

  function showBtn() {
    var btn = getBtn();
    if (btn) { btn.style.display = 'flex'; return; }

    if (!document.getElementById('cw-voice-style')) {
      var s = document.createElement('style');
      s.id = 'cw-voice-style';
      s.textContent =
        '@keyframes cwPulse{0%,100%{box-shadow:0 4px 16px rgba(239,68,68,.55)}' +
        '50%{box-shadow:0 4px 28px rgba(239,68,68,.18)}}' +
        ' #cw-voice-end-btn:hover{background:#dc2626!important}';
      document.head.appendChild(s);
    }

    btn = document.createElement('button');
    btn.id  = BTN_ID;
    btn.title = 'End Voice Call';
    btn.innerHTML =
      '<span style="position:relative;display:block;min-width:64px;line-height:1;">' +
        '<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;width:16px;height:16px;pointer-events:none;">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:block;">' +
            '<path d="M3.5 14.5c5.5-5 11.5-5 17 0 .8.7.9 2 0 2.7l-2.1 1.6c-.5.4-1.2.4-1.7 0l-2-1.7' +
            'a1.5 1.5 0 0 1-.5-1.1V14a9.8 9.8 0 0 0-4.4 0v0c0 .4-.2.8-.5 1.1l-2 1.6c-.5.4-1.2.4-1.7 0' +
            'L3.5 15c-.5-.6-.4-1.7 0-2.5Z" transform="rotate(135 12 12)"/>' +
          '</svg>' +
        '</span>' +
        '<span style="display:block;width:100%;text-align:center;font-size:13px;font-weight:600;letter-spacing:.01em;line-height:1;">End Call</span>' +
      '</span>';

    btn.style.cssText = [
      'position:fixed', 'bottom:90px', 'right:20px', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:#ef4444', 'color:#fff', 'border:none', 'outline:none',
      'padding:11px 20px', 'border-radius:999px', 'cursor:pointer',
      'font-family:inherit', 'transition:background .15s',
      'animation:cwPulse 1.6s ease-in-out infinite'
    ].join(';');

    btn.onclick = function () {
      // Disable button immediately so double-clicks don't fire twice.
      btn.disabled = true;
      btn.style.opacity = '0.6';
      // Tell widget iframe to end the call.
      document.querySelectorAll('iframe').forEach(function (f) {
        try { f.contentWindow.postMessage({ event: 'end-voice-call-from-parent' }, '*'); } catch (e) {}
      });
      // Fallback: if widget doesn't respond in 3s, hide button ourselves.
      setTimeout(function () {
        window._cwVoiceActive = false;
        hideBtn();
      }, 3000);
    };

    document.body.appendChild(btn);
  }

  function hideBtn() {
    var btn = getBtn();
    if (btn) btn.style.display = 'none';
  }

  // Auto-open widget after voice reconnect (idempotent — no-op if already open)
  function autoOpenWidget() {
    try {
      if (window.$chatwoot && typeof window.$chatwoot.toggle === 'function') {
        window.$chatwoot.toggle('open');
      }
    } catch (_) {}
  }

  // ════════════════════════════════════════════════════════════════════════
  // FEATURE 3 — Voice-aware SPA navigation  [REMOVED]
  // ════════════════════════════════════════════════════════════════════════
  //
  // The old fetch-and-swap SPA navigation (spaNavigate / ensureSpaContainer +
  // link-click interceptor) was removed because it re-executed every page
  // <script> on navigation. On modern frameworks (React, Next.js App Router,
  // Vue, Svelte, Sanity Live) that re-execution corrupts hydration and
  // streaming state — it caused:
  //   "Failed to execute 'enqueue' on 'ReadableStreamDefaultController':
  //    Cannot enqueue a chunk into a readable stream that is closed"
  //
  // It is also unnecessary:
  //   • SPA frameworks already do client-side routing WITHOUT a full reload,
  //     and the Chatwoot iframe lives directly in <body> (outside the framework
  //     root), so an active voice call survives navigation on its own.
  //   • Plain multi-page HTML sites (full reloads) should use the standalone
  //     voice-popup.html, which runs the call in its own window and survives
  //     parent-page reloads.
  //
  // Result: the host page is now framework-agnostic — sdk.js only adds the
  // iframe widget + a few safe DOM helpers, and never patches globals or
  // re-runs host scripts.

  // ════════════════════════════════════════════════════════════════════════
  // postMessage listener — bridges Features 2 & 4
  // ════════════════════════════════════════════════════════════════════════

  // ── Voice call state indicators ────────────────────────────────
  // Widget OPEN  → the widget's own red pulsing phone button (ElevenLabsVoiceButton)
  //               is already visible inside the chat panel — nothing needed here.
  // Widget CLOSED → show the floating "End Call" button outside the bubble.
  // Hard-refresh sites → always show floating "End Call" (popup handles the call).

  function applyVoiceState(isActive, autoOpen) {
    window._cwVoiceActive = !!isActive;
    if (isActive) {
      // Read live widget state — prefer $chatwoot.isOpen (real-time) over localStorage.
      var widgetOpen = false;
      try {
        if (window.$chatwoot) {
          widgetOpen = !!window.$chatwoot.isOpen;
        } else {
          widgetOpen = (localStorage.getItem(WIDGET_OPEN_KEY) === 'true');
        }
      } catch (_) {
        widgetOpen = (localStorage.getItem(WIDGET_OPEN_KEY) === 'true');
      }

      if (!widgetOpen) {
        showBtn();
      } else {
        hideBtn();
      }
      if (autoOpen) autoOpenWidget();
    } else {
      hideBtn();
    }
  }

  window.addEventListener('message', function (e) {
    try {
      var data = e.data;
      if (!data || typeof data !== 'object') return;
      var ev = data.event;
      // Only handle Chatwoot-prefixed voice events — ignore everything else
      if (typeof ev !== 'string' || ev.indexOf('cw-') !== 0) return;

      if (ev === 'cw-voice-call-started') {
        window._cwVoiceActive = true;
        applyVoiceState(true, false);
        _prevWidgetOpen = null;
      } else if (ev === 'cw-voice-call-ended') {
        window._cwVoiceActive = false;
        applyVoiceState(false, false);
        _prevWidgetOpen = null;
      }
    } catch (_) {}
  });

}());
