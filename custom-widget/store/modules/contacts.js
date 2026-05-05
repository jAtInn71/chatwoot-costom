import { sendMessage } from 'widget/helpers/utils';
import ContactsAPI from '../../api/contacts';
import { SET_USER_ERROR } from '../../constants/errorTypes';
import { setHeader, removeHeader } from '../../helpers/axios';

const state = {
  currentUser: {},
};

const SET_CURRENT_USER = 'SET_CURRENT_USER';

const parseErrorData = error =>
  error && error.response && error.response.data ? error.response.data : error;

export const updateWidgetAuthToken = widgetAuthToken => {
  if (widgetAuthToken) {
    setHeader(widgetAuthToken);
    sendMessage({
      event: 'setAuthCookie',
      data: { widgetAuthToken },
    });
  }
};

const clearAllChatwootStorage = () => {
  const explicitKeys = [
    'cwc-unique-id',
    'cwc-session',
    'cw_contact_uuid',
    'cw_conversation',
    'cw_conversation_id',
    'chatwoot_contact_id',
    'chatwoot_conversation_id',
    'chatwootContactIdentity',
    'user_color',
    'user_uuid',
    'cw_d',
    'cw_auth_token',
    'widget_auth_token',
  ];
  explicitKeys.forEach(k => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });

  [localStorage, sessionStorage].forEach(storage => {
    Object.keys(storage)
      .filter(k =>
        k.includes('chatwoot') ||
        k.includes('cw_') ||
        k.includes('cwc') ||
        k.includes('widget_auth')
      )
      // PRESERVE chatwoot_user_data - don't delete it
      .filter(k => k !== 'chatwoot_user_data')
      .forEach(k => storage.removeItem(k));
  });

  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    if (
      name.includes('chatwoot') ||
      name.includes('cw_') ||
      name.includes('cwc') ||
      name === 'cw_d'
    ) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${location.hostname}`;
    }
  });

  // Clear cw_conversation from the iframe's own URL query params
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('cw_conversation');
    window.history.replaceState({}, '', url.toString());
  } catch (_) {}
};

export const getters = {
  getCurrentUser(_state) {
    return _state.currentUser;
  },
};

export const actions = {
  get: async ({ commit }) => {
    try {
      const { data } = await ContactsAPI.get();
      commit(SET_CURRENT_USER, data);
    } catch (error) {
      // If 404, conversation is invalid — clear stale data
      if (error.response?.status === 404) {
        console.warn('⚠️ Contact not found (404) - clearing stale data');
        // Clear conversation-related session data
        sessionStorage.removeItem('cw_contact_uuid');
        sessionStorage.removeItem('cw_conversation_id');
      }
      // Ignore error
    }
  },

  // Load user data that was saved during exitChat
  loadSavedUserData: ({ commit }) => {
    try {
      const savedUserData = localStorage.getItem('chatwoot_user_data');
      if (savedUserData) {
        const userData = JSON.parse(savedUserData);
        if (userData.name || userData.email) {
          commit(SET_CURRENT_USER, {
            has_email: !!userData.email,
            has_phone_number: !!userData.phone_number,
            identifier: null,
            name: userData.name || '',
            email: userData.email || '',
            phone_number: userData.phone_number || '',
          });
        }
      }
    } catch (error) {
      // Ignore error if localStorage is corrupted
    }
  },

  update: async ({ dispatch }, { user }) => {
    try {
      await ContactsAPI.update(user);
      dispatch('get');
    } catch (error) {
      // Ignore error
    }
  },

  setUser: async ({ dispatch }, { identifier, user: userObject }) => {
    try {
      const {
        email,
        name,
        avatar_url,
        identifier_hash: identifierHash,
        phone_number,
        company_name,
        city,
        country_code,
        description,
        custom_attributes,
        social_profiles,
      } = userObject;
      const user = {
        email,
        name,
        avatar_url,
        identifier_hash: identifierHash,
        phone_number,
        additional_attributes: {
          company_name,
          city,
          description,
          country_code,
          social_profiles,
        },
        custom_attributes,
      };
      const {
        data: { widget_auth_token: widgetAuthToken },
      } = await ContactsAPI.setUser(identifier, user);
      updateWidgetAuthToken(widgetAuthToken);
      dispatch('get');
      if (identifierHash || widgetAuthToken) {
        dispatch('conversation/clearConversations', {}, { root: true });
        dispatch('conversation/fetchOldConversations', {}, { root: true });
        dispatch('conversationAttributes/getAttributes', {}, { root: true });
      }
    } catch (error) {
      const data = parseErrorData(error);
      sendMessage({ event: 'error', errorType: SET_USER_ERROR, data });
    }
  },

  setCustomAttributes: async (_, customAttributes = {}) => {
    try {
      await ContactsAPI.setCustomAttributes(customAttributes);
    } catch (error) {
      // Ignore error
    }
  },

  deleteCustomAttribute: async (_, customAttribute) => {
    try {
      await ContactsAPI.deleteCustomAttribute(customAttribute);
    } catch (error) {
      // Ignore error
    }
  },

  clearCurrentUser: ({ commit, state }) => {
    // Reset conversation state but KEEP user data for next session
    // User data is saved in localStorage and will be shown on next open
    commit(SET_CURRENT_USER, {
      has_email: false,
      has_phone_number: false,
      identifier: null,
      name: '',
      email: '',
      phone_number: '',
    });

    // Remove axios auth header
    removeHeader('X-Auth-Token');

    // Wipe conversation-related storage only (keep user_data for form pre-fill)
    const explicitKeys = [
      'cwc-unique-id',
      'cwc-session',
      'cw_contact_uuid',
      'cw_conversation',
      'cw_conversation_id',
      'chatwoot_contact_id',
      'chatwoot_conversation_id',
      'chatwootContactIdentity',
      'user_color',
      'user_uuid',
      'cw_d',
      'cw_auth_token',
      'widget_auth_token',
    ];
    explicitKeys.forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });

    [localStorage, sessionStorage].forEach(storage => {
      Object.keys(storage)
        .filter(k =>
          k.includes('chatwoot') ||
          k.includes('cw_') ||
          k.includes('cwc') ||
          k.includes('widget_auth')
        )
        // PRESERVE chatwoot_user_data so form can be pre-filled on reopen
        .filter(k => k !== 'chatwoot_user_data')
        .forEach(k => storage.removeItem(k));
    });

    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (
        name.includes('chatwoot') ||
        name.includes('cw_') ||
        name.includes('cwc') ||
        name === 'cw_d'
      ) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${location.hostname}`;
      }
    });

    try {
      const url = new URL(window.location.href);
      ['cw_conversation', 'cw_contact', 'cw_d', 'website_token'].forEach(p =>
        url.searchParams.delete(p)
      );
      [...url.searchParams.keys()]
        .filter(k => k.startsWith('cw_') || k.startsWith('cwc'))
        .forEach(k => url.searchParams.delete(k));
      window.history.replaceState({}, '', url.toString());
    } catch (_) {}

    console.log('✅ Conversation cleared (user data preserved for next session)');

    // Tell the parent page to fully destroy + reload the SDK
    sendMessage({ event: 'exitChat' });
  },

  resetOnApiError: ({ commit }) => {
    // Called when API returns 404 — clear stale session and reset to pre-chat
    console.warn('🔄 Resetting widget due to stale conversation (404)');
    
    // Clear conversation state
    commit(SET_CURRENT_USER, {
      has_email: false,
      has_phone_number: false,
      identifier: null,
      name: '',
      email: '',
      phone_number: '',
    });

    // Clear stale session/conversation IDs
    const staleKeys = [
      'cw_contact_uuid',
      'cw_conversation',
      'cw_conversation_id',
      'chatwoot_contact_id',
      'chatwoot_conversation_id',
      'cw_d',
    ];
    
    [localStorage, sessionStorage].forEach(storage => {
      staleKeys.forEach(k => storage.removeItem(k));
    });

    console.log('✅ Widget reset - user can now start fresh conversation');
  },
};

export const mutations = {
  [SET_CURRENT_USER]($state, user) {
    $state.currentUser = { ...user };
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};