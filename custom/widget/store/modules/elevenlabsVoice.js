const state = {
  isActive: false,
  isConnecting: false,
  isMuted: false,
  callDuration: 0,
  agentName: 'ElevenLabs AI Assistant',
  transcript: [],
  durationInterval: null,
  error: null,
  conversationId: null,
};

const getters = {
  getIsActive: $state => $state.isActive,
  getIsConnecting: $state => $state.isConnecting,
  getIsMuted: $state => $state.isMuted,
  getCallDuration: $state => $state.callDuration,
  getAgentName: $state => $state.agentName,
  getTranscript: $state => $state.transcript,
  getError: $state => $state.error,
  getConversationId: $state => $state.conversationId,
};

const mutations = {
  SET_ACTIVE($state, value) {
    $state.isActive = value;
  },
  SET_CONNECTING($state, value) {
    $state.isConnecting = value;
  },
  SET_MUTED($state, value) {
    $state.isMuted = value;
  },
  SET_CALL_DURATION($state, value) {
    $state.callDuration = value;
  },
  INCREMENT_DURATION($state) {
    $state.callDuration += 1;
  },
  SET_AGENT_NAME($state, value) {
    $state.agentName = value;
  },
  ADD_TRANSCRIPT($state, { role, text }) {
    $state.transcript.push({ role, text, timestamp: Date.now() });
  },
  CLEAR_TRANSCRIPT($state) {
    $state.transcript = [];
  },
  SET_DURATION_INTERVAL($state, interval) {
    $state.durationInterval = interval;
  },
  SET_ERROR($state, error) {
    $state.error = error;
  },
  SET_CONVERSATION_ID($state, id) {
    $state.conversationId = id;
  },
  RESET_STATE($state) {
    $state.isActive = false;
    $state.isConnecting = false;
    $state.isMuted = false;
    $state.callDuration = 0;
    $state.transcript = [];
    $state.error = null;
    $state.conversationId = null;
    if ($state.durationInterval) {
      clearInterval($state.durationInterval);
      $state.durationInterval = null;
    }
  },
};

const actions = {
  setActive({ commit }, value) {
    commit('SET_ACTIVE', value);
  },
  setConnecting({ commit }, value) {
    commit('SET_CONNECTING', value);
  },
  setError({ commit }, error) {
    commit('SET_ERROR', error);
  },
  async endCall({ commit, state: $state }) {
    if ($state.durationInterval) {
      clearInterval($state.durationInterval);
    }
    commit('RESET_STATE');
  },
  toggleMute({ commit, state: $state }) {
    commit('SET_MUTED', !$state.isMuted);
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
