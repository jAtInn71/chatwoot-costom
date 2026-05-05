<script>
import TeamAvailability from 'widget/components/TeamAvailability.vue';
import { mapGetters } from 'vuex';
import { useRouter } from 'vue-router';
import configMixin from 'widget/mixins/configMixin';
import ArticleContainer from '../components/pageComponents/Home/Article/ArticleContainer.vue';
export default {
  name: 'Home',
  components: {
    ArticleContainer,
    TeamAvailability,
  },
  mixins: [configMixin],
  setup() {
    const router = useRouter();
    return { router };
  },
  computed: {
    ...mapGetters({
      availableAgents: 'agent/availableAgents',
      conversationSize: 'conversation/getConversationSize',
      unreadMessageCount: 'conversation/getUnreadMessageCount',
      currentUser: 'contacts/getCurrentUser',
    }),
    // A user is truly "known" only if they have a name or email populated.
    // After clearCurrentUser, these are empty strings — so this returns false
    // and the pre-chat form is always shown to a fresh/cleared user.
    hasKnownContact() {
      // Debug logging
      const hasName = !!(this.currentUser?.name);
      const hasEmail = !!(this.currentUser?.email);
      const result = hasName || hasEmail;
      console.log(`👤 hasKnownContact: ${result} (name: "${this.currentUser?.name}", email: "${this.currentUser?.email}")`);
      return result;
    },
  },
  mounted() {
    // Auto-navigate when widget loads. This ensures that after page reload
    // (triggered by exit chat), the widget shows the appropriate page:
    // pre-chat form for fresh users, or messages for existing conversations.
    // Only navigate if no specific child route is already active.
    if (this.$route.name === 'home') {
      this.startConversation();
    }

    // Watch for widget visibility changes to reset form on reopen
    this.watchWidgetVisibility();
  },
  beforeUnmount() {
    // Clean up visibility observer when component unmounts
    if (this.visibilityObserver) {
      this.visibilityObserver();
    }
  },
  methods: {
    watchWidgetVisibility() {
      // Detect when widget becomes visible again and reset form
      let wasHidden = document.hidden;
      
      const handleVisibilityChange = () => {
        const isNowVisible = !document.hidden;
        console.log(`📱 Visibility change: wasHidden=${wasHidden}, isNowVisible=${isNowVisible}`);
        
        // If widget was hidden and is now visible, reset the conversation
        if (wasHidden && isNowVisible && this.$route.name === 'messages') {
          console.log('🔄 Widget reopened - resetting to pre-chat form');
          this.startConversation();
        }
        wasHidden = !isNowVisible;
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Store cleanup function
      this.visibilityObserver = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    },
    startConversation() {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🏠 startConversation() called');
      console.log(`   preChatFormEnabled: ${this.preChatFormEnabled}`);
      console.log(`   conversationSize: ${this.conversationSize}`);
      console.log(`   hasKnownContact: ${this.hasKnownContact}`);
      console.log(`   Current route: ${this.$route.name}`);
      
      // Show pre-chat form if:
      //   1. Pre-chat form is enabled, AND
      //   2. Either there is no existing conversation OR the contact was cleared
      //      (hasKnownContact is false after exitChat wipes the store)
      // IMPORTANT: On second close/open, always show the form if pre-chat is enabled
      if (this.preChatFormEnabled) {
        // Always show form if no conversation or contact data cleared
        // This ensures fresh start on every widget open
        if (!this.conversationSize || !this.hasKnownContact) {
          console.log('✅ Navigating to prechat-form');
          return this.router.replace({ name: 'prechat-form' });
        } else {
          console.log('ℹ️ Has known contact + conversation - showing messages');
        }
      } else {
        console.log('ℹ️ preChatFormEnabled is false - showing messages');
      }
      
      console.log('✅ Navigating to messages');
      return this.router.replace({ name: 'messages' });
    },
  },
};
</script>

<template>
  <div class="z-50 flex flex-col justify-end flex-1 w-full p-4 gap-4">
    <TeamAvailability
      :available-agents="availableAgents"
      :has-conversation="!!conversationSize"
      :unread-count="unreadMessageCount"
      @start-conversation="startConversation"
    />

    <ArticleContainer />
  </div>
</template>