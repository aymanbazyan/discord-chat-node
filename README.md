A small app to host a discord chatbot

You can connect the bot to ollama locally or gemini API

## User Personalization

The bot now supports personalized interactions based on user information. When a user first interacts with the bot in direct messages, they'll be prompted to provide required information (name, city, etc.) using the `!ai input` command.

### Features

- User information is collected and stored securely
- System instructions are personalized with user data
- Bot will not process or store any messages until required information is complete
- No history is saved before user profile is completed
- Easily extensible to add more information fields

### Usage

In direct messages with the bot:

```
!ai input name YourName
!ai input city YourCity
```

Once all required fields are provided, the bot will confirm your information and you can begin chatting normally.

### Customization

To use personalized data in your Gemini prompts, include placeholders in your system instruction:

```
Hello <name>! I see you're from <city>. How can I help you today?
```

These placeholders will be automatically replaced with the user's information.

You can add additional required fields by modifying the `REQUIRED_FIELDS` array in `src/utils/userInfoManager.js`.
