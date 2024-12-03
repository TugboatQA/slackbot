# Lullabot Slack Bot

A Slack bot built with the [Bolt framework](https://tools.slack.dev/bolt-js/) that provides various utility functions for the Lullabot Slack workspace.

This provides a modular architecture for adding new features to the bot.

## Development

### Prerequisites

- Node.js (v18 or higher recommended)
- npm
- A Slack workspace with admin access
- Slack bot token and app-level token

### Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your Slack tokens:

```
BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
CLIENT_SIGNING_SECRET=your-signing-secret
```

### Development Commands

```bash
npm run dev      # Run in development mode with ts-node
npm run build    # Build TypeScript to JavaScript
npm start        # Build and run the production version
npm run watch    # Watch for changes and rebuild
```

### Creating New Plugins

Plugins are written in TypeScript and should be placed in the `src/plugins` directory. Each plugin should:

1. Import required types:

```typescript
import { App } from '@slack/bolt';
import { Plugin } from '../types';
```

2. Export a default function that implements the Plugin type:

```typescript
const myPlugin: Plugin = async (app: App): Promise<void> => {
    // Your plugin code here
};

export default myPlugin;
```

3. Use proper type annotations for Slack events:

```typescript
import { GenericMessageEvent } from '@slack/types/dist/events/message';
import { AppMentionEvent } from '@slack/types/dist/events/app';

app.message(/pattern/, async ({ message, say }) => {
    const msg = message as GenericMessageEvent;
    // Handle message
});
```

## Plugins

### Help

Access documentation and command information for all bot features.

Features:
- Lists all available plugins and their commands
- Provides detailed help for specific plugins
- Responds in threads for better organization
- Supports multiple query formats

Examples:
```
@bot help                 # Show all commands
@bot commands             # Show all commands
@bot plugins              # List available plugins
@bot help factoids        # Show factoids help
@bot help karma           # Show karma help
```

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

Track and manage karma points for users and things in your Slack workspace.

Features:
- Give or take karma points using ++ or --
- Query karma levels for users or items
- Prevents self-karma manipulation
- Supports user mentions and plain text
- Persistent storage per team
- Thread-aware responses

Examples:

**Give/Take Karma:**
```
@user++                    # Give karma to user
@user--                    # Take karma from user
cats++                     # Give karma to thing
tacos--                    # Take karma from thing
:emoji:++                  # Give karma to emoji
```

**Query Karma:**
```
karma @user               # Query user's karma
karma cats               # Query thing's karma
@bot karma @user         # Query via mention
```

Note: Users cannot give or take karma from themselves.

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

### Botsnack

Give the bot a treat and receive a message of gratitude!

Features:
- Responds to "botsnack" with random thank you messages
- Supports both direct messages and mentions
- Includes emoji reactions

Examples:
```
botsnack              # Give the bot a snack
@bot botsnack         # Give the bot a snack (with mention)
```

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
