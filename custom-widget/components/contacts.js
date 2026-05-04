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
    // Clear saved user data so pre-chat form starts fresh on next open
    'chatwoot_user_data',
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

  // Strip cw_conversation (and any other cw_ params) from the iframe's
  // own URL — buildUrl() in contacts API appends window.location.search
  // to every request, so if the JWT is still in the URL it gets re-sent
  // to the server even after localStorage is cleared, causing the server
  // to recognise the old contact and skip the pre-chat form.
  try {
    const url = new URL(window.location.href);
    // Remove every param that could identify the old session
    ['cw_conversation', 'cw_contact', 'cw_d', 'website_token'].forEach(p =>
      url.searchParams.delete(p)
    );
    // Also remove any remaining cw_ prefixed params dynamically
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
    // 1. Reset Vuex contact state
    commit(SET_CURRENT_USER, {
      has_email: false,
      has_phone_number: false,
      identifier: null,
      name: '',
      email: '',
      phone_number: '',
    });

    // 2. Remove ALL axios auth headers (X-Auth-Token and api_access_token)
    removeHeader('X-Auth-Token');
    removeHeader('api_access_token');
    removeHeader('user_access_token');

    // 3. Wipe all storage inside the iframe
    clearAllChatwootStorage();

    // 4. Tell the parent page to fully destroy + reload the SDK.
    //    This is the critical step — the iframe src URL itself carries
    //    the ?cw_conversation=JWT param that makes the server recognise
    //    the old contact and skip the pre-chat form. The only way to
    //    remove it is to let the parent tear down the whole iframe and
    //    re-inject the SDK script fresh (no JWT in the new src).
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