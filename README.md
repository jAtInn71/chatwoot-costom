# Chatwoot with ElevenLabs Voice Integration

This is a customized Chatwoot instance featuring a built-in AI Voice Assistant powered by ElevenLabs.

## Architecture

- **Chatwoot Dashboard**: `http://localhost:3000`
- **Voice Agent**: Hardcoded in the widget assets for all inboxes.

## Features

1.  **AI Voice Button**: A microphone icon appears in the Chatwoot widget when the text input is empty.
2.  **Simple Deployment**: Standard Chatwoot architecture with patched widget assets.

## Getting Started

1.  **Start the services**:
    ```bash
    docker compose up -d
    ```
2.  **Test the Widget**:
    Embed your Chatwoot script into any HTML page to see the voice button.

## Configuration

The ElevenLabs Agent ID is currently hardcoded to `agent_6601kc1fqeecfc88s7d52jde0syq`. 

To change the Agent ID:
1. Update `custom-widget/store/modules/appConfig.js`.
2. Rebuild the frontend assets (requires Node.js environment).
3. Rebuild the Docker image.
