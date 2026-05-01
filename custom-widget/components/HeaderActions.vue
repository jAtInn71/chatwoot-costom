<script>
import { mapGetters } from 'vuex';
import { IFrameHelper, RNHelper } from 'widget/helpers/utils';
import { popoutChatWindow } from '../helpers/popoutHelper';
import FluentIcon from 'shared/components/FluentIcon/Index.vue';
import ElevenLabsVoiceButton from 'widget/components/ElevenLabsVoiceButton.vue';
import configMixin from 'widget/mixins/configMixin';
import { CONVERSATION_STATUS } from 'shared/constants/messages';
import { toggleStatus } from 'widget/api/conversation';

export default {
  name: 'HeaderActions',
  components: { FluentIcon, ElevenLabsVoiceButton },
  mixins: [configMixin],
  props: {
    showPopoutButton: { type: Boolean, default: false },
    showEndConversationButton: { type: Boolean, default: true },
  },
  data() {
    return {
      isEndingChat: false,
      showConfirmExitChat: false,
    };
  },
  computed: {
    ...mapGetters({
      conversationAttributes: 'conversationAttributes/getConversationParams',
      canUserEndConversation: 'appConfig/getCanUserEndConversation',
      widgetColor: 'appConfig/getWidgetColor',
      elevenLabsEnabled: 'appConfig/getElevenLabsEnabled',
    }),
    conversationStatus() {
      return this.conversationAttributes.status;
    },
    isIframe() { return IFrameHelper.isIFrame(); },
    isRNWebView() { return RNHelper.isRNWebView(); },
    showHeaderActions() {
      return this.isIframe || this.isRNWebView || this.hasWidgetOptions;
    },
    hasWidgetOptions() {
      return this.showPopoutButton || this.conversationStatus === 'open';
    },
    canEndChat() {
      return [
        CONVERSATION_STATUS.OPEN,
        CONVERSATION_STATUS.SNOOZED,
        CONVERSATION_STATUS.PENDING,
      ].includes(this.conversationStatus);
    },
    showCallButton() { return this.elevenLabsEnabled; },
  },
  methods: {
    popoutWindow() {
      this.sendCloseMessage();
      const { location: { origin }, chatwootWebChannel: { websiteToken }, authToken } = window;
      popoutChatWindow(origin, websiteToken, this.$root.$i18n.locale, authToken);
    },

    // Clear ONLY the identity keys — NOT all storage
    // Clearing too much (like 'widget') breaks message sending on next open
    clearIdentityKeys() {
      const IDENTITY_KEYS = [
        'cwc-unique-id',
        'cw_contact_uuid',
        'cw_conversation_id',
        'chatwoot_contact_id',
        'chatwoot_conversation_id',
        'chatwootContactIdentity',
        'cwc-session',
      ];
      IDENTITY_KEYS.forEach(k => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
      // Clear cookies
      document.cookie.split(';').forEach(c => {
        const name = c.trim().split('=')[0];
        if (name.startsWith('cw_') || name.startsWith('cwc')) {
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        }
      });
      // Clear window globals
      try { delete window.chatwootContactIdentity; } catch (_) {}
      try { delete window.chatwootConversationId; } catch (_) {}
      try { delete window.authToken; } catch (_) {}
    },

    // Reset only conversation + contact Vuex state
    // Do NOT reset auth or appConfig — those are needed for widget to keep working
    resetVuexStore() {
      const s = this.$store;
      try { s.commit('conversation/clearConversations'); } catch (_) {}
      try { s.commit('contacts/clearContact'); } catch (_) {}
      try { s.commit('contacts/SET_CONTACT', {}); } catch (_) {}
      try {
        s.commit('conversationAttributes/setConversationParams', {
          status: null, id: null, meta: {},
        });
      } catch (_) {}
    },

    sendCloseMessage() {
      if (IFrameHelper.isIFrame()) {
        IFrameHelper.sendMessage({ event: 'closeWindow' });
      } else if (RNHelper.isRNWebView) {
        RNHelper.sendMessage({ type: 'close-widget' });
      }
    },

    // Tell parent page to call $chatwoot.reset()
    // This clears the SDK session token on the host page
    sendResetToParent() {
      if (IFrameHelper.isIFrame()) {
        IFrameHelper.sendMessage({ event: 'resetSession' });
      }
    },

    requestExitChat() {
      this.showConfirmExitChat = !this.showConfirmExitChat;
    },

    dismissConfirms() {
      this.showConfirmExitChat = false;
    },

    // ── EXIT CHAT — NO RELOAD ────────────────────────────────────────────
    // Previous version used window.location.reload() which caused:
    //   → Widget full restart = 6+ API calls every time
    //   → Hit ngrok 40 req/min limit → 429 → messages stop sending
    //
    // Fix: use Vue router to navigate to 'home' instead of reloading.
    //   → Zero extra API calls
    //   → Vuex is cleared so conversationSize = 0
    //   → Home.vue sees no conversation → shows pre-chat form ✅
    //   → Parent SDK reset clears the contact token on host page ✅
    // ────────────────────────────────────────────────────────────────────
    async endChat() {
      if (this.isEndingChat) return;
      this.isEndingChat = true;
      this.showConfirmExitChat = false;

      try {
        // 1. Resolve conversation on server (1 API call only)
        if ([
          CONVERSATION_STATUS.OPEN,
          CONVERSATION_STATUS.SNOOZED,
          CONVERSATION_STATUS.PENDING,
        ].includes(this.conversationStatus)) {
          try { await toggleStatus(); } catch (_) {}
        }

        // 2. Clear only identity keys from storage
        //    (NOT all keys — clearing widget/config keys breaks message sending)
        this.clearIdentityKeys();

        // 3. Reset conversation + contact from Vuex memory
        this.resetVuexStore();

        // 4. Tell parent to reset SDK session token (no API call — just postMessage)
        this.sendResetToParent();

        // 5. Navigate to home via Vue router — NO reload, zero extra API calls
        //    Home.vue checks conversationSize → 0 → shows pre-chat form ✅
        await this.$router.replace({ name: 'home' });

        // 6. Close widget
        this.sendCloseMessage();

      } catch (e) {
        // Fallback
        this.clearIdentityKeys();
        this.resetVuexStore();
        this.sendResetToParent();
        try { await this.$router.replace({ name: 'home' }); } catch (_) {}
        this.sendCloseMessage();
      } finally {
        this.isEndingChat = false;
      }
    },
  },
};
</script>

<!-- eslint-disable-next-line vue/no-root-v-if -->
<template>
  <div v-if="showHeaderActions" class="actions flex items-center gap-1">

    <!-- 📞 ElevenLabs AI Call button -->
    <ElevenLabsVoiceButton
      v-if="showCallButton"
      :color="widgetColor"
      size="medium"
      class="header-call-btn"
    />

    <!-- ✖ Exit Chat button — with confirmation popover -->
    <div v-if="canEndChat && showEndConversationButton" class="relative">
      <button
        class="header-action-btn exit-chat-btn"
        :class="{ active: showConfirmExitChat }"
        :disabled="isEndingChat"
        title="Exit & Close Chat"
        @click="requestExitChat"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 17L21 12L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Confirmation popover -->
      <div v-if="showConfirmExitChat" class="confirm-popover">
        <p class="confirm-text">
          End and close this chat?
          <span class="confirm-sub">
            Conversation will be resolved.<br />
            Next open will start fresh.
          </span>
        </p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-cancel" @click="dismissConfirms">Cancel</button>
          <button
            class="confirm-btn confirm-ok confirm-ok--exit"
            :disabled="isEndingChat"
            @click="endChat"
          >
            <span v-if="isEndingChat" class="spinner" />
            <span v-else>Exit Chat</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Popout button -->
    <button
      v-if="showPopoutButton"
      class="header-action-btn new-window--button"
      @click="popoutWindow"
    >
      <FluentIcon icon="open" size="20" class="text-n-slate-12" />
    </button>

    <!-- ✕ Close button (RN WebView only) -->
    <button
      class="header-action-btn close-button"
      :class="{ 'rn-close-button': isRNWebView }"
      @click="sendCloseMessage"
    >
      <FluentIcon icon="dismiss" size="22" class="text-n-slate-12" />
    </button>

  </div>
</template>

<style scoped lang="scss">
.actions { position: relative; }

.header-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-body);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
  padding: 0;

  &:hover:not(:disabled) { background: rgba(0,0,0,0.07); transform: scale(1.05); }
  &:active:not(:disabled) { transform: scale(0.95); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  &.active { background: rgba(0,0,0,0.1); }
}

.exit-chat-btn {
  color: #ef4444;
  &:hover:not(:disabled) { background: rgba(239,68,68,0.1); }
  &.active { background: rgba(239,68,68,0.12); }
  svg path { stroke: currentColor; }
}

.close-button { display: none; }
.rn-close-button { display: flex !important; }
.header-call-btn { display: flex; align-items: center; justify-content: center; }
.relative { position: relative; }

.confirm-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 9999;
  min-width: 220px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 10px 24px -4px rgba(0,0,0,0.14);
  padding: 14px 16px 12px;
  border: 1px solid rgba(0,0,0,0.08);
  animation: popoverIn 0.18s cubic-bezier(0.34,1.56,0.64,1);

  &::before {
    content: '';
    position: absolute;
    top: -6px; right: 10px;
    width: 12px; height: 12px;
    background: #ffffff;
    border-left: 1px solid rgba(0,0,0,0.08);
    border-top: 1px solid rgba(0,0,0,0.08);
    transform: rotate(45deg);
    border-radius: 2px 0 0 0;
  }
}

@keyframes popoverIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.confirm-text {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.45;
}
.confirm-sub {
  display: block;
  font-size: 11.5px;
  font-weight: 400;
  color: #64748b;
  margin-top: 4px;
  line-height: 1.4;
}
.confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }

.confirm-btn {
  border: none;
  border-radius: 7px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
  &:active { transform: scale(0.97); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.confirm-cancel {
  background: #f1f5f9;
  color: #475569;
  &:hover { background: #e2e8f0; }
}

.confirm-ok {
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
}
.confirm-ok--exit {
  background: #ef4444;
  &:hover:not(:disabled) { background: #dc2626; }
}

.spinner {
  display: inline-block;
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.dark {
  .confirm-popover {
    background: #1e293b;
    border-color: rgba(255,255,255,0.1);
    &::before { background: #1e293b; border-color: rgba(255,255,255,0.1); }
  }
  .confirm-text { color: #f1f5f9; }
  .confirm-sub  { color: #94a3b8; }
  .confirm-cancel { background: #334155; color: #cbd5e1; &:hover { background: #475569; } }
  .header-action-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
}
</style>