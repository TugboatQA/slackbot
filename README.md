# Lullabot Slack Bot

A Slack bot built with the [Bolt framework](https://tools.slack.dev/bolt-js/) that provides various utility functions for the Lullabot Slack workspace.

This provides a modular architecture for adding new features to the bot.

## Plugins

### Factoids

- Store and retrieve custom responses
- Support for direct responses and templated replies
- Update or append to existing factoids
- Interactive buttons for managing factoid updates
- Delete factoids with the 'forget' command

Examples:

- Query: `X?`
- Set: `@Lullabot X is Y`
- Set with reply: `@LullabotX is <reply>Y`
- Delete: `@Lullabot forget X`

### Karma System

- Give or take karma points using ++ or --
- Query karma levels for users or items
- Prevents self-karma manipulation
- Supports user mentions and plain text

Examples:

- Give karma: `@user++` or `thing++`
- Take karma: `@user--` or `thing--`
- Query karma: `karma @user` or `karma thing`

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

2. Copy the environment template:

   ```bash
   cp .env.defaults .env
   ```

3. Configure your `.env` file with your tokens and secrets:

   - `CLIENT_SIGNING_SECRET`: Found in "Basic Information" > "App Credentials"
   - `BOT_TOKEN`: Found in "OAuth & Permissions" > "Bot User OAuth Token"
   - `SLACK_APP_TOKEN`: Generate in "Basic Information" > "App-Level Tokens" (needs `connections:write`)

4. Install dependencies:

   ```bash
   npm install
   ```

5. Start the bot:

   ```bash
   npm start
   ```

## Required Slack App Permissions

See `slack-app-manifest.json` for required permissions.

## Data Storage

The bot uses file-based JSON storage in the `data` directory for:

- Karma points
- Factoids
- Each team's data is stored in separate files

## Plugin Architecture

The bot uses a modular plugin system. Each feature is implemented as a separate plugin in the `plugins` directory. New functionality can be added by creating new plugin files.

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
- datejs: Date parsing and formatting
- dotenv: Environment variable management

For detailed API documentation and examples, refer to the [Slack Bolt documentation](https://slack.dev/bolt-js).
