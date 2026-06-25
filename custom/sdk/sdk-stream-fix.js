;(function(){
  // ── Native API Shield (prefix) ─────────────────────────────────────────
  // Runs BEFORE Chatwoot's SDK code. Snapshots every browser API that any
  // modern framework depends on. A matching restore block at the end of
  // sdk.js puts them all back so the host page is never affected.
  //
  // Coverage:
  //   Streaming   → Next.js App Router, Remix, SvelteKit, Qwik, Astro
  //   Fetch       → every SSR/SSG framework, service workers
  //   History     → every SPA router (React Router, Vue Router, etc.)
  //   Observers   → lazy loading, virtual scroll, layout shift detection
  //   Events      → SSE streaming (Sanity Live, dev HMR, real-time APIs)
  //   Timers      → animation frames, debounce, testing libs
  //   DOM         → frameworks that cache createElement / createTreeWalker
  //   Messaging   → postMessage (Sanity, Stripe, OAuth popups, iframes)
  //   Prototype   → guards against prototype pollution
  var w = window, d = document;

  // ── 1. Snapshot native APIs ────────────────────────────────────────────
  w.__cwNativeAPIs = {
    // Streaming
    ReadableStream:       w.ReadableStream,
    WritableStream:       w.WritableStream,
    TransformStream:      w.TransformStream,
    // Fetch / Network
    fetch:                w.fetch,
    Request:              w.Request,
    Response:             w.Response,
    Headers:              w.Headers,
    AbortController:      w.AbortController,
    AbortSignal:          w.AbortSignal,
    XMLHttpRequest:       w.XMLHttpRequest,
    EventSource:          w.EventSource,
    WebSocket:            w.WebSocket,
    // Navigation / History
    historyPushState:     w.history && w.history.pushState,
    historyReplaceState:  w.history && w.history.replaceState,
    // URL
    URL:                  w.URL,
    URLSearchParams:      w.URLSearchParams,
    // Observers
    MutationObserver:     w.MutationObserver,
    IntersectionObserver: w.IntersectionObserver,
    ResizeObserver:       w.ResizeObserver,
    PerformanceObserver:  w.PerformanceObserver,
    // Messaging
    MessageChannel:       w.MessageChannel,
    MessagePort:          w.MessagePort,
    BroadcastChannel:     w.BroadcastChannel,
    // Promises / Async
    Promise:              w.Promise,
    queueMicrotask:       w.queueMicrotask,
    // Timers
    setTimeout:           w.setTimeout,
    clearTimeout:         w.clearTimeout,
    setInterval:          w.setInterval,
    clearInterval:        w.clearInterval,
    requestAnimationFrame:    w.requestAnimationFrame,
    cancelAnimationFrame:     w.cancelAnimationFrame,
    requestIdleCallback:      w.requestIdleCallback,
    cancelIdleCallback:       w.cancelIdleCallback,
    // Events
    CustomEvent:          w.CustomEvent,
    Event:                w.Event,
    // DOM
    createElement:        d.createElement && d.createElement.bind(d),
    createElementNS:      d.createElementNS && d.createElementNS.bind(d),
    createTreeWalker:     d.createTreeWalker && d.createTreeWalker.bind(d),
    querySelector:        d.querySelector && d.querySelector.bind(d),
    querySelectorAll:     d.querySelectorAll && d.querySelectorAll.bind(d),
  };

  // ── 2. Protect window.onmessage from being overwritten ─────────────────
  // Many SDKs (including Chatwoot upstream) do window.onmessage = fn which
  // kills ALL other postMessage listeners (Sanity Live, Stripe, OAuth, etc.)
  // We freeze the property so assignment silently fails, and any handler
  // that was meant to be set via onmessage is captured and forwarded via
  // addEventListener instead.
  w.__cwOnMessageHandlers = [];
  var _origOnMessage = w.onmessage;
  try {
    Object.defineProperty(w, 'onmessage', {
      configurable: true,
      get: function() { return _origOnMessage; },
      set: function(fn) {
        if (typeof fn === 'function') {
          w.__cwOnMessageHandlers.push(fn);
          w.addEventListener('message', fn);
        }
        // Don't actually set window.onmessage — prevents overwrite
      }
    });
  } catch (_) {}

  // ── 3. Protect key prototypes from pollution ───────────────────────────
  // Some polyfill libs modify Array/Object/String prototypes. We snapshot
  // the prototype method counts so we can detect and warn.
  w.__cwProtoSnapshot = {
    ArrayProtoKeys:  Object.getOwnPropertyNames(Array.prototype),
    ObjectProtoKeys: Object.getOwnPropertyNames(Object.prototype),
  };

})();
