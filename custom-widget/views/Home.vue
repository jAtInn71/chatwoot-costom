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
      isFetchingList: 'conversation/getIsFetchingList',
    }),
  },
  watch: {
    // When isFetchingList flips from true → false, fetchOldConversations is
    // done (with data, or with a 404 that cleared the store).
    // Both conversationSize AND preChatFormEnabled are now settled in Vuex,
    // so we can make a correct routing decision with no race conditions.
    isFetchingList(isNowFetching) {
      if (!isNowFetching && this.$route.name === 'home') {
        this.startConversation();
      }
    },
  },
  mounted() {
    if (this.$route.name === 'home') {
      // If the fetch already finished before we mounted, decide immediately.
      // Otherwise the watcher above handles it once the fetch settles.
      if (!this.isFetchingList) {
        this.startConversation();
      }
    }
  },
  methods: {
    startConversation() {
      // Go to pre-chat form when form is enabled AND no conversation exists.
      // Go to messages in all other cases (form disabled, or existing convo).
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