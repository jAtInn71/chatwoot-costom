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
      return !!(this.currentUser?.name || this.currentUser?.email);
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
  },
  methods: {
    startConversation() {
      // Show pre-chat form if:
      //   1. Pre-chat form is enabled, AND
      //   2. Either there is no existing conversation OR the contact was cleared
      //      (hasKnownContact is false after exitChat wipes the store)
      // IMPORTANT: On second close/open, always show the form if pre-chat is enabled
      if (this.preChatFormEnabled) {
        // Always show form if no conversation or contact data cleared
        if (!this.conversationSize || !this.hasKnownContact) {
          return this.router.replace({ name: 'prechat-form' });
        }
      }
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