# Lullabot Slack Bot

A Slack bot built with the [Bolt framework](https://tools.slack.dev/bolt-js/) that provides various utility functions for the Lullabot Slack workspace.

This provides a modular architecture for adding new features to the bot.

## Plugins

### Character AI

- Provides conversational AI capabilities using OpenAI
- Multiple character personalities available
- Maintains conversation context
- Understands bot capabilities and can explain them
- Responds to direct messages and mentions
- Automatically defers to other plugins for specific commands

The character plugin acts as a fallback handler - it will only respond if no other plugin claims the message. This ensures that specific commands are handled by their respective plugins while general conversation is handled by the AI.

Examples:

- Direct message with the bot
- Mention the bot in a channel: `@Lullabot how do I use Views in Drupal?`

### Command Registration System

The bot uses a plugin registry system where each plugin registers its command patterns. This ensures proper message routing and prevents conflicts between plugins.

Plugins register their patterns using:

```javascript
app.registerPlugin('pluginName', [
    /^command pattern$/i,
    /^another pattern$/i
]);
```

The bot will:

1. Check incoming messages against all registered patterns
2. Route messages to the appropriate plugin
3. Fall back to the character plugin for general conversation
4. Log routing decisions for debugging

### Factoids

- Store and retrieve custom responses using explicit commands
- Support for direct responses and templated replies
- Update or append to existing factoids
- Interactive buttons for managing factoid updates
- Delete factoids with the 'forget' command

Examples:

- Query: `!factoid: drupal?`
- Set: `!factoid: drupal is a content management system`
- Set with reply: `!factoid: greeting is <reply> Hello there!`
- Delete: `!factoid: forget drupal`

### Karma System

- Give or take karma points using ++ or --
- Query karma levels for users or items
- Prevents self-karma manipulation
- Supports user mentions and plain text

Examples:

- Give karma: `@user++` or `thing++`
- Take karma: `@user--` or `thing--`
- Query karma: `karma @user` or `karma thing`

### Out of Office (OOO)

- Integration with BambooHR
- Check who's out of office on any given day
- Supports date queries for future dates
- Shows vacation time and holidays

Examples:

- Today: `ooo?`
- Future date: `ooo next Monday?`
- Specific date: `ooo July 4?`

### Greetings

- Responds to various greeting patterns
- Adds wave reactions to greetings
- Supports both direct messages and mentions
- Fallback to text responses if reactions fail

Examples:

- `hello!`
- `hey!`
- `hi!`
- `:wave:`

### Uptime

- Reports bot uptime statistics
- Shows bot identification information
- Responds to various identity queries

Examples:

- `uptime`
- `identify yourself`
- `who are you`
- `what is your name`

## Setup

1. Create a Slack App at api.slack.com/apps

2. Create an OpenAI API key at platform.openai.com

3. Copy the environment template:

   ```bash
   cp .env.defaults .env
   ```

4. Configure your `.env` file with your tokens and secrets:
   - `CLIENT_SIGNING_SECRET`: Found in "Basic Information" > "App Credentials"
   - `BOT_TOKEN`: Found in "OAuth & Permissions" > "Bot User OAuth Token"
   - `SLACK_APP_TOKEN`: Generate in "Basic Information" > "App-Level Tokens" (needs `connections:write`)
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `DEFAULT_CHARACTER`: Character to use (defaults to 'default')
   - `BAMBOO_TOKEN`: Your BambooHR API key (optional)
   - `BAMBOO_SUBDOMAIN`: Your BambooHR subdomain (optional)

5. Install dependencies:

   ```bash
   npm install
   ```

6. Start the bot:

   ```bash
   npm start
   ```

## Character Configuration

Characters are defined in JSON files within the `plugins/characters/` directory. Each character file defines:

- Personality traits
- Language model settings
- System prompts
- Knowledge base
- Response styles

Example character configuration:

```json
{
    "name": "Character Name",
    "settings": {
        "model": "gpt-4",
        "temperature": 0.7,
        "max_tokens": 500
    },
    "bio": [
        "Character background",
        "Personality traits"
    ],
    "systemPrompt": "Instructions for the AI model"
}
```

### Available Models

The character configuration supports different OpenAI models:

- `gpt-4`: Most capable model, best for complex conversations
- `gpt-4-turbo`: Faster version of GPT-4
- `gpt-4o-mini`: most advanced model in the small models category, and cheapest model

Adjust the model in the character's settings based on your needs.

## Required Slack App Permissions

See `slack-app-manifest.json` for required permissions.

## Data Storage

The bot uses file-based JSON storage in the `data` directory for:

- Karma points
- Factoids
- Each team's data is stored in separate files

## Plugin Architecture

The bot uses a modular plugin system. Each feature is implemented as a separate plugin in the `plugins` directory. New functionality can be added by creating new plugin files.

### Creating a New Plugin

1. Create a new plugin file in the `plugins` directory
2. Export an async function that takes the Bolt app instance as a parameter
3. Register your plugin's command patterns
4. Use Bolt's event system to handle messages and interactions
5. Follow existing patterns for data storage and error handling

Example plugin structure:

```javascript
module.exports = async (app) => {
    // Register plugin patterns
    app.registerPlugin('myplugin', [
        /^mycommand$/i,
        /^another command$/i
    ]);

    // Handle commands
    app.message(/^mycommand$/i, async ({ message, say }) => {
        await say('Command handled!');
    });
};
```

## Contributing

1. Create a new plugin file in the `plugins` directory
2. Export an async function that takes the Bolt app instance as a parameter
3. Use Bolt's event system to handle messages and interactions
4. Follow existing patterns for data storage and error handling

## Maintenance

- Logs are output to console
- Plugin loading errors are handled gracefully
- Data files are stored in JSON format for easy debugging
- Each plugin handles its own error cases

## Dependencies

- @slack/bolt: Slack Bolt framework
- openai: OpenAI API client
- datejs: Date parsing and formatting
- dotenv: Environment variable management

For detailed API documentation and examples, refer to the [Slack Bolt documentation](https://slack.dev/bolt-js).
