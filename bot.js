const { App } = require('@slack/bolt');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize the Bolt app
const app = new App({
    token: process.env.BOT_TOKEN,
    signingSecret: process.env.CLIENT_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
});

// Plugin loader function
const loadPlugins = async (app) => {
    const pluginsDir = path.join(__dirname, 'plugins');
    
    // Create plugins directory if it doesn't exist
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir);
    }

    // Read all files from plugins directory
    const pluginFiles = fs.readdirSync(pluginsDir)
        .filter(file => file.endsWith('.js'));

    // Load each plugin
    for (const file of pluginFiles) {
        try {
            const plugin = require(path.join(pluginsDir, file));
            if (typeof plugin === 'function') {
                await plugin(app);
                console.log(`Loaded plugin: ${file}`);
            }
        } catch (error) {
            console.error(`Error loading plugin ${file}:`, error);
        }
    }
};

// Start the app and load plugins
(async () => {
    // Load plugins before starting the app
    await loadPlugins(app);
    
    // Start the app
    await app.start();
    console.log('⚡️ Bolt app is running!');
})();
