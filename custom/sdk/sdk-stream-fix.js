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

  // ── 1b. Patch ReadableStream to silence "enqueue on closed stream" ──────
  // Chatwoot's bundled axios/fetch adapter sometimes tries to enqueue a chunk
  // after the stream is already closed (race during Next.js App Router nav).
  // Wrap the native ReadableStream so controller.enqueue() is a safe no-op
  // when the stream is already closed. The restore block puts the original back.
  try {
    var NativeRS = w.ReadableStream;
    if (NativeRS) {
      w.ReadableStream = function(underlyingSource, strategy) {
        var wrappedSource;
        if (underlyingSource && typeof underlyingSource.start === 'function') {
          var origStart = underlyingSource.start;
          wrappedSource = Object.create(underlyingSource);
          wrappedSource.start = function(controller) {
            var origEnqueue = controller.enqueue.bind(controller);
            controller.enqueue = function(chunk) {
              try { origEnqueue(chunk); } catch(e) {
                if (e && e.message && e.message.indexOf('closed') !== -1) return;
                throw e;
              }
            };
            return origStart.call(underlyingSource, controller);
          };
        } else {
          wrappedSource = underlyingSource;
        }
        return new NativeRS(wrappedSource, strategy);
      };
      w.ReadableStream.prototype = NativeRS.prototype;
      Object.keys(NativeRS).forEach(function(k) {
        try { w.ReadableStream[k] = NativeRS[k]; } catch(_){}
      });
    }
  } catch (_) {}

  // ── 2. Protect window.onmessage from being overwritten ─────────────────
  // Many SDKs (including Chatwoot upstream) do window.onmessage = fn which
  // kills ALL other postMessage listeners (Sanity Live, Stripe, OAuth, etc.)
  // We intercept the assignment: the FIRST setter (Chatwoot's own SDK) is
  // allowed through natively so the iframe ↔ parent communication works.
  // Subsequent setters are captured via addEventListener so they don't
  // clobber Chatwoot's handler.
  w.__cwOnMessageHandlers = [];
  var _cwOnMsgCount = 0;
  var _origOnMessageDesc = Object.getOwnPropertyDescriptor(w, 'onmessage');
  try {
    Object.defineProperty(w, 'onmessage', {
      configurable: true,
      get: function() {
        if (_origOnMessageDesc && _origOnMessageDesc.get) {
          return _origOnMessageDesc.get.call(w);
        }
        return w._cwCurrentOnMessage || null;
      },
      set: function(fn) {
        _cwOnMsgCount++;
        if (_cwOnMsgCount === 1) {
          // First call is Chatwoot's own SDK — let it set natively
          if (_origOnMessageDesc && _origOnMessageDesc.set) {
            _origOnMessageDesc.set.call(w, fn);
          }
          w._cwCurrentOnMessage = fn;
        } else if (typeof fn === 'function') {
          // Later calls from other SDKs — redirect to addEventListener
          w.__cwOnMessageHandlers.push(fn);
          w.addEventListener('message', fn);
        }
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
