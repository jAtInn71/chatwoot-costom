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
      // Ignore error
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

  clearCurrentUser: ({ commit }) => {
    commit(SET_CURRENT_USER, {
      has_email: false,
      has_phone_number: false,
      identifier: null,
      name: '',
      email: '',
      phone_number: '',
    });
    removeHeader('X-Auth-Token');
    clearAllChatwootStorage();
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