# ── Stage 1: Build Node.js assets with proper Node environment ────────────────
FROM node:18-alpine AS builder

WORKDIR /build

# Copy only necessary files for building
COPY custom-widget/components/ ./custom-widget/components/
COPY custom-widget/store/ ./custom-widget/store/
COPY custom-widget/i18n/ ./custom-widget/i18n/
COPY custom-widget/patches/configMixin.js ./custom-widget/patches/

# Note: Vite assets are already pre-built in chatwoot base image
# This stage is for any custom widget builds needed

# ── Stage 2: Final Chatwoot image with custom patches ─────────────────────────
FROM chatwoot/chatwoot:latest

# Build arguments for ElevenLabs configuration
ARG VITE_ELEVENLABS_AGENT_ID=agent_6601kc1fqeecfc88s7d52jde0syq
ARG VITE_ELEVENLABS_VOICE_ID=
ARG VITE_ELEVENLABS_AGENT_NAME=AI Assistant

# Set environment variables for build
ENV VITE_ELEVENLABS_AGENT_ID=${VITE_ELEVENLABS_AGENT_ID}
ENV VITE_ELEVENLABS_VOICE_ID=${VITE_ELEVENLABS_VOICE_ID}
ENV VITE_ELEVENLABS_AGENT_NAME=${VITE_ELEVENLABS_AGENT_NAME}

# ── Backend patches (Ruby / ERB) ─────────────────────────────────────────────
COPY custom-widget/patches/web_widget.rb /app/app/models/channel/web_widget.rb
COPY custom-widget/patches/show.html.erb /app/app/views/widgets/show.html.erb
COPY custom-widget/patches/_inbox.json.jbuilder /app/app/views/api/v1/models/_inbox.json.jbuilder
COPY custom-widget/patches/inboxes_controller.rb /app/app/controllers/api/v1/accounts/inboxes_controller.rb
COPY custom-widget/patches/ConfigurationPage.vue /app/app/javascript/dashboard/routes/dashboard/settings/inbox/settingsPage/ConfigurationPage.vue
COPY custom-widget/patches/20260408000001_add_elevenlabs_to_channel_web_widgets.rb \
     /app/db/migrate/20260408000001_add_elevenlabs_to_channel_web_widgets.rb

# ── Widget source overrides (will be picked up by running Chatwoot) ─────────────
COPY custom-widget/components/ChatInputWrap.vue /app/app/javascript/widget/components/ChatInputWrap.vue
COPY custom-widget/components/ElevenLabsVoiceButton.vue /app/app/javascript/widget/components/ElevenLabsVoiceButton.vue
COPY custom-widget/components/HeaderActions.vue /app/app/javascript/widget/components/HeaderActions.vue
COPY custom-widget/store/index.js /app/app/javascript/widget/store/index.js
COPY custom-widget/store/modules/appConfig.js /app/app/javascript/widget/store/modules/appConfig.js
COPY custom-widget/store/modules/elevenlabsVoice.js /app/app/javascript/widget/store/modules/elevenlabsVoice.js
COPY custom-widget/patches/configMixin.js /app/app/javascript/widget/mixins/configMixin.js
COPY custom-widget/i18n/en.json /app/app/javascript/widget/i18n/en.json

# ── Labels ────────────────────────────────────────────────────────────────────
LABEL org.opencontainers.image.title="Chatwoot with ElevenLabs Voice"
LABEL org.opencontainers.image.description="Chatwoot custom image with ElevenLabs voice integration (per-inbox toggle)"
LABEL elevenlabs.agent_id="${VITE_ELEVENLABS_AGENT_ID}"