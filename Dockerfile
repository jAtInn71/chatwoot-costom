# ── Stage 1: Node.js build environment ────────────────────────────────────────
FROM node:18-alpine AS node-builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /chatwoot-src

# Clone Chatwoot source to get node_modules and vite config
RUN apk add --no-cache git && \
    git clone --depth 1 https://github.com/chatwoot/chatwoot.git . && \
    pnpm install --frozen-lockfile

# Copy custom Vue files BEFORE building
COPY custom-widget/components/ChatInputWrap.vue app/javascript/widget/components/ChatInputWrap.vue
COPY custom-widget/components/ElevenLabsVoiceButton.vue app/javascript/widget/components/ElevenLabsVoiceButton.vue
COPY custom-widget/components/HeaderActions.vue app/javascript/widget/components/HeaderActions.vue
COPY custom-widget/store/index.js app/javascript/widget/store/index.js
COPY custom-widget/store/modules/appConfig.js app/javascript/widget/store/modules/appConfig.js
COPY custom-widget/store/modules/elevenlabsVoice.js app/javascript/widget/store/modules/elevenlabsVoice.js
COPY custom-widget/patches/configMixin.js app/javascript/widget/mixins/configMixin.js
COPY custom-widget/i18n/en.json app/javascript/widget/i18n/locale/en.json

# Build the widget assets
ARG VITE_ELEVENLABS_AGENT_ID=agent_6601kc1fqeecfc88s7d52jde0syq
ARG VITE_ELEVENLABS_VOICE_ID=
ARG VITE_ELEVENLABS_AGENT_NAME=AI Assistant

ENV VITE_ELEVENLABS_AGENT_ID=${VITE_ELEVENLABS_AGENT_ID}
ENV VITE_ELEVENLABS_VOICE_ID=${VITE_ELEVENLABS_VOICE_ID}
ENV VITE_ELEVENLABS_AGENT_NAME=${VITE_ELEVENLABS_AGENT_NAME}

RUN NODE_OPTIONS="--max-old-space-size=4096" \
    node_modules/.bin/vite build --config vite.config.ts

# ── Stage 2: Final Chatwoot image ─────────────────────────────────────────────
FROM chatwoot/chatwoot:latest

ARG VITE_ELEVENLABS_AGENT_ID=agent_6601kc1fqeecfc88s7d52jde0syq
ARG VITE_ELEVENLABS_VOICE_ID=
ARG VITE_ELEVENLABS_AGENT_NAME=AI Assistant

ENV VITE_ELEVENLABS_AGENT_ID=${VITE_ELEVENLABS_AGENT_ID}
ENV VITE_ELEVENLABS_VOICE_ID=${VITE_ELEVENLABS_VOICE_ID}
ENV VITE_ELEVENLABS_AGENT_NAME=${VITE_ELEVENLABS_AGENT_NAME}

# Copy freshly built assets from node builder
COPY --from=node-builder /chatwoot-src/public/vite /app/public/vite

# Backend patches
COPY custom-widget/patches/web_widget.rb /app/app/models/channel/web_widget.rb
COPY custom-widget/patches/show.html.erb /app/app/views/widgets/show.html.erb
COPY custom-widget/patches/_inbox.json.jbuilder /app/app/views/api/v1/models/_inbox.json.jbuilder
COPY custom-widget/patches/inboxes_controller.rb /app/app/controllers/api/v1/accounts/inboxes_controller.rb
COPY custom-widget/patches/ConfigurationPage.vue /app/app/javascript/dashboard/routes/dashboard/settings/inbox/settingsPage/ConfigurationPage.vue
COPY custom-widget/patches/20260408000001_add_elevenlabs_to_channel_web_widgets.rb \
     /app/db/migrate/20260408000001_add_elevenlabs_to_channel_web_widgets.rb

# Vue source files
COPY custom-widget/components/ChatInputWrap.vue /app/app/javascript/widget/components/ChatInputWrap.vue
COPY custom-widget/components/ElevenLabsVoiceButton.vue /app/app/javascript/widget/components/ElevenLabsVoiceButton.vue
COPY custom-widget/components/HeaderActions.vue /app/app/javascript/widget/components/HeaderActions.vue
COPY custom-widget/store/index.js /app/app/javascript/widget/store/index.js
COPY custom-widget/store/modules/appConfig.js /app/app/javascript/widget/store/modules/appConfig.js
COPY custom-widget/store/modules/elevenlabsVoice.js /app/app/javascript/widget/store/modules/elevenlabsVoice.js
COPY custom-widget/patches/configMixin.js /app/app/javascript/widget/mixins/configMixin.js
COPY custom-widget/i18n/en.json /app/app/javascript/widget/i18n/locale/en.json

LABEL org.opencontainers.image.title="Chatwoot with ElevenLabs Voice + New Chat + Exit Chat"
LABEL org.opencontainers.image.description="Chatwoot custom image with ElevenLabs voice integration and header action buttons"