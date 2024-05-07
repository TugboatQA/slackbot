# Tugboat Slack Bot

## Run a copy of the bot

Clone this repo `git clone git@gitlab.lullabot.com:Lullabot/slackbot.git`.

Copy _config.example.js_ to _config.js_ and fill in the appropriate values. You'll need a Slack API token.

Then:

```
npm install
node index.js
```

## Writing new commands

The bot is based on the [Botkit](https://github.com/howdyai/botkit) library. You're probably most interested in [responding to messages and events](https://botkit.ai/docs/core.html#receiving-messages-and-events).

New commands live in _lib/plugins.js_, and are automatically loaded.

Import the active Botkit controller with:

```javascript
const controller = require('../controller');
```

Check out _src/plugins/hello.js_ for an example.
=======
In order to run the bot you need a Slack API access token.

Configure, and start the bot:

1. Copy _config.example.js_ to _config.js_. And enter your Slack API access token
1. Install all the dependencies with `yarn install`
1. Start the bot with `yarn start`
