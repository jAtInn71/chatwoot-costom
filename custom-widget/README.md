# Chatwoot Voice Widget - ElevenLabs Integration

## What Was Done

Added a voice call button inside the Chatwoot chat widget that connects to ElevenLabs Conversational AI.

### Files Modified/Created

| File | Purpose |
|------|---------|
| `components/ElevenLabsVoiceButton.vue` | Voice button component with modal UI |
| `components/ChatInputWrap.vue` | Modified to include voice button |
| `store/modules/elevenlabsVoice.js` | Vuex store for voice state management |
| `store/modules/appConfig.js` | Added ElevenLabs config (agentId) |
| `store/index.js` | Registered elevenlabsVoice module |
| `i18n/en.json` | Added VOICE_AGENT translations |
| `assets/vite/` | Pre-built widget assets |

### Configuration

Agent ID is set in `store/modules/appConfig.js`:
```javascript
elevenLabsConfig: {
  agentId: 'agent_6601kc1fqeecfc88s7d52jde0syq',
  agentName: 'AI Assistant',
}
```

### How It Works

1. **Button Location**: Voice button appears in chat input area (next to attachment/emoji)
2. **Visibility**: Only shows when text input is empty
3. **Click Action**: Opens modal with ElevenLabs ConvAI widget
4. **Voice Call**: Uses ElevenLabs real-time voice AI

### Making Changes Permanent

The `docker-compose.yaml` mounts the pre-built assets:
```yaml
volumes:
  - ./custom-widget/assets/vite:/app/public/vite:ro
```

This ensures the custom widget survives container restarts.

### Manual Re-apply (if needed)

If you update the Chatwoot image and lose changes:
```bash
/opt/chatwoot/apply-voice-widget.sh
```

### Rebuilding Assets

If you modify Vue components:
```bash
cd /tmp/chatwoot-build
# Make your changes to files in app/javascript/widget/
./node_modules/.bin/vite build
cp -r public/vite /opt/chatwoot/custom-widget/assets/
docker restart chatwoot_rails_1
```

### Translation Keys

```json
"VOICE_AGENT": {
  "START_CALL": "Talk to AI",
  "END_CALL": "End Call",
  "CONNECTING": "Connecting...",
  "MICROPHONE_ACCESS": "Microphone access required."
}
```

## Directory Structure

```
/opt/chatwoot/
├── docker-compose.yaml      # Updated with vite volume mount
├── apply-voice-widget.sh    # Script to re-apply changes
├── custom-widget/
│   ├── components/          # Vue components
│   ├── store/modules/       # Vuex store modules
│   ├── i18n/                # Translations
│   └── assets/vite/         # Pre-built assets (mounted to container)
└── .env                     # Chatwoot environment config
```
