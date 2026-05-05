import { API, WEBSITE_TOKEN } from 'widget/helpers/axios';

// Build a widget API URL that always includes the website_token.
//
// WHY NOT use window.location.search directly?
// ─────────────────────────────────────────────
// window.location.search reflects the iframe's *current* URL query string.
// During exit-chat, clearCurrentUser() calls window.history.replaceState()
// to strip session params from the URL. If website_token were ever stripped
// there, every API call after that would send website_token = null → 404.
//
// Instead we use WEBSITE_TOKEN, which is captured once at module load time
// (in axios.js) from the original iframe URL before any replaceState() runs.
// This makes all API calls immune to URL mutations.
const buildContactUrl = endpoint => {
  const base = `/api/v1/${endpoint}`;
  if (!WEBSITE_TOKEN) return base;
  return `${base}?website_token=${WEBSITE_TOKEN}`;
};

export default {
  get() {
    return API.get(buildContactUrl('widget/contact'));
  },
  update(userObject) {
    return API.patch(buildContactUrl('widget/contact'), userObject);
  },
  setUser(identifier, userObject) {
    return API.patch(buildContactUrl('widget/contact/set_user'), {
      identifier,
      ...userObject,
    });
  },
  setCustomAttributes(customAttributes = {}) {
    return API.patch(buildContactUrl('widget/contact'), {
      custom_attributes: customAttributes,
    });
  },
  deleteCustomAttribute(customAttribute) {
    return API.post(
      buildContactUrl('widget/contact/destroy_custom_attributes'),
      { custom_attributes: [customAttribute] }
    );
  },
};