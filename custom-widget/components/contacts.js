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

// Keys that identify a session/conversation — wiped on exit and on 404.
// chatwoot_user_data is intentionally excluded so the form can pre-fill
// the user's name/email on the next visit.
const SESSION_KEYS = [
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

const EMPTY_USER = {
  has_email: false,
  has_phone_number: false,
  identifier: null,
  name: '',
  email: '',
  phone_number: '',
};

/**
 * Wipe all session/conversation storage while keeping chatwoot_user_data
 * so the pre-chat form can pre-fill on next open.
 */
const clearSessionStorage = () => {
  // Explicit keys
  SESSION_KEYS.forEach(k => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });

  // Pattern-based sweep (keep chatwoot_user_data)
  [localStorage, sessionStorage].forEach(storage => {
    Object.keys(storage)
      .filter(
        k =>
          (k.includes('chatwoot') ||
            k.includes('cw_') ||
            k.includes('cwc') ||
            k.includes('widget_auth')) &&
          k !== 'chatwoot_user_data'
      )
      .forEach(k => storage.removeItem(k));
  });

  // Cookies
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

  // Strip session params from the iframe URL so they don't get re-sent
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
      // 404 means the contact/conversation was deleted (e.g. after exit-chat
      // the server resolved the conversation). Clear stale session data and
      // reset to a blank user so the pre-chat form is shown.
      // Home.vue will route to prechat-form because conversationSize stays 0.
      if (error.response?.status === 404) {
        clearSessionStorage();
        removeHeader('X-Auth-Token');
        commit(SET_CURRENT_USER, EMPTY_USER);
      }
      // All other errors are silently ignored.
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

  /**
   * Called by HeaderActions.endChat().
   * Clears local state and storage, then tells the parent to reload the SDK.
   * HeaderActions is responsible for the router.replace('prechat-form') call
   * BEFORE calling this action, so the user never sees the blank messages page.
   */
  clearCurrentUser: ({ commit }) => {
    // 1. Reset Vuex contact state
    commit(SET_CURRENT_USER, EMPTY_USER);

    // 2. Remove axios auth headers
    removeHeader('X-Auth-Token');
    removeHeader('api_access_token');
    removeHeader('user_access_token');

    // 3. Wipe session storage (keep chatwoot_user_data for form pre-fill)
    clearSessionStorage();

    // 4. Tell the parent to fully tear down and reload the SDK iframe.
    //    The exitChat message is sent here; HeaderActions must NOT send it
    //    again to avoid a double reload.
    sendMessage({ event: 'exitChat' });
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