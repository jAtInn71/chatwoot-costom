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
  },
  mounted() {
    if (this.$route.name === 'home') {
      this.startConversation();
    }
  },
  methods: {
    startConversation() {
      // If pre-chat form is enabled AND there is no active conversation,
      // always show the pre-chat form. This covers:
      //   - First visit (no conversation at all)
      //   - After exit-chat (conversation cleared, storage wiped)
      //   - After 404 on fetchOldConversations (store stays empty)
      // We do NOT check currentUser here because the contacts/get fetch
      // is async and may not have resolved yet — conversationSize is the
      // only reliable synchronous signal we need.
      if (this.preChatFormEnabled && !this.conversationSize) {
        return this.router.replace({ name: 'prechat-form' });
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