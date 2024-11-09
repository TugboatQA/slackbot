const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

class CharacterManager {
    constructor(client) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.client = client;
        this.conversationHistory = new Map();
        this.character = null;
        this.defaultCharacter = process.env.DEFAULT_CHARACTER || 'default';
        this.capabilities = null;
        this.pluginPatterns = new Map();
    }

    async loadPluginCapabilities() {
        try {
            const pluginsDir = path.join(__dirname);
            const files = await fs.readdir(pluginsDir);
            const plugins = files.filter(file => file.endsWith('.js') && file !== 'character.js');
            
            const capabilities = [];
            
            for (const plugin of plugins) {
                const pluginPath = path.join(pluginsDir, plugin);
                const content = await fs.readFile(pluginPath, 'utf8');
                
                // Extract plugin documentation and capabilities
                const pluginName = plugin.replace('.js', '');
                const docComments = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
                const examples = content.match(/Examples?:[\s\S]*?\*\//g) || [];
                
                capabilities.push({
                    name: pluginName,
                    description: this.extractPluginDescription(docComments),
                    examples: this.extractExamples(examples)
                });
            }

            this.capabilities = capabilities;
            return capabilities;
        } catch (error) {
            console.error('Failed to load plugin capabilities:', error);
            return [];
        }
    }

    extractPluginDescription(docComments) {
        if (!docComments.length) return '';
        const description = docComments[0]
            .replace(/\/\*\*|\*\/|\*/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('@'))
            .join(' ')
            .trim();
        return description;
    }

    extractExamples(examples) {
        if (!examples.length) return [];
        return examples[0]
            .replace(/Examples?:|\*\//g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('*'))
            .map(line => line.replace(/^\s*-\s*/, ''));
    }

    generateCapabilitiesPrompt() {
        if (!this.capabilities) return '';

        const capabilitiesText = this.capabilities.map(plugin => {
            const examples = plugin.examples.length ? 
                `\nExamples:\n${plugin.examples.map(ex => `- ${ex}`).join('\n')}` : '';
            
            return `${plugin.name}:\n${plugin.description}${examples}`;
        }).join('\n\n');

        return `
Available bot capabilities:

${capabilitiesText}

When responding to users, you can reference and explain these capabilities when relevant to the conversation. Use the exact command syntax from the examples when suggesting commands.`;
    }

    async loadPluginPatterns() {
        try {
            const pluginsDir = path.join(__dirname);
            const files = await fs.readdir(pluginsDir);
            const plugins = files.filter(file => file.endsWith('.js') && file !== 'character.js');
            
            for (const plugin of plugins) {
                const pluginPath = path.join(pluginsDir, plugin);
                const content = await fs.readFile(pluginPath, 'utf8');
                
                // Extract regex patterns from the plugin
                const patterns = this.extractPatterns(content);
                if (patterns.length > 0) {
                    this.pluginPatterns.set(plugin, patterns);
                }
            }
        } catch (error) {
            console.error('Failed to load plugin patterns:', error);
        }
    }

    extractPatterns(content) {
        const patterns = [];
        
        // Match app.message() calls with regex patterns
        const messageRegexes = content.match(/app\.message\([/].*?[/]i?[),]/g) || [];
        messageRegexes.forEach(match => {
            const pattern = match.match(/[/](.*?)[/]i?[),]$/);
            if (pattern && pattern[1]) {
                patterns.push(new RegExp(pattern[1], 'i'));
            }
        });

        // Match string patterns in app.message()
        const messageStrings = content.match(/app\.message\(['"].*?['"]/) || [];
        messageStrings.forEach(match => {
            const pattern = match.match(/['"](.+?)['"]/);
            if (pattern && pattern[1]) {
                patterns.push(new RegExp(escapeRegExp(pattern[1]), 'i'));
            }
        });

        // Match app.event() calls
        const eventPatterns = content.match(/app\.event\(['"].*?['"]/g) || [];
        eventPatterns.forEach(match => {
            const pattern = match.match(/['"](.+?)['"]/);
            if (pattern && pattern[1]) {
                patterns.push(pattern[1]);
            }
        });

        // Add common command patterns that might not be in regex form
        const commandMatches = content.match(/(?:command|cmd):\s*['"](.+?)['"]/g) || [];
        commandMatches.forEach(match => {
            const pattern = match.match(/['"](.+?)['"]/);
            if (pattern && pattern[1]) {
                patterns.push(new RegExp(escapeRegExp(pattern[1]), 'i'));
            }
        });

        // Look for factoid-style patterns
        if (content.includes('factoid') || content.includes('forget')) {
            patterns.push(/^forget\s+.+$/i);
            patterns.push(/^.+\s+is\s+.+$/i);
            patterns.push(/^.+\?$/i);
        }

        return patterns;
    }

    isPluginCommand(text, isMention = false) {
        // Check for explicit factoid command
        if (text.startsWith('!factoid:')) {
            return true;
        }

        // Check karma patterns
        const karmaPatterns = [
            /^karma\s+@\w+/i,
            /^karma\s+\w+$/i,
            /\s*@\w+\+\+$/,
            /\s*@\w+\-\-$/,
            /\s*\w+\+\+$/,
            /\s*\w+\-\-$/
        ];

        // Check explicit command patterns first
        if (karmaPatterns.some(pattern => pattern.test(text))) {
            return true;
        }

        // Then check plugin-specific patterns
        for (const [plugin, patterns] of this.pluginPatterns) {
            for (const pattern of patterns) {
                if (typeof pattern === 'string') {
                    // Handle event patterns
                    continue;
                } else if (pattern instanceof RegExp) {
                    // Handle regex patterns
                    if (pattern.test(text)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // Helper function to escape special regex characters
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async loadCharacter(characterName = null) {
        try {
            const charToLoad = characterName || this.defaultCharacter;
            const characterPath = path.join(__dirname, 'characters', `${charToLoad}.character.json`);
            const characterData = await fs.readFile(characterPath, 'utf8');
            this.character = JSON.parse(characterData);
            
            // Load capabilities and patterns if not already loaded
            if (!this.capabilities) {
                await this.loadPluginCapabilities();
                await this.loadPluginPatterns();
            }
            
            console.log(`Loaded character: ${this.character.name}`);
        } catch (error) {
            console.error(`Failed to load character ${characterName}. Falling back to default.`);
            if (characterName !== 'default') {
                await this.loadCharacter('default');
            } else {
                throw error;
            }
        }
    }

    async listAvailableCharacters() {
        try {
            const charactersDir = path.join(__dirname, 'characters');
            const files = await fs.readdir(charactersDir);
            return files
                .filter(file => file.endsWith('.character.json'))
                .map(file => file.replace('.character.json', ''));
        } catch (error) {
            console.error('Failed to list characters:', error);
            return [];
        }
    }

    async generateResponse(message, channelId) {
        if (!this.character) {
            throw new Error('No character configuration loaded');
        }

        if (!this.conversationHistory.has(channelId)) {
            this.conversationHistory.set(channelId, []);
        }
        const history = this.conversationHistory.get(channelId);

        history.push({ role: 'user', content: message });

        while (history.length > 10) {
            history.shift();
        }

        try {
            const completion = await this.openai.chat.completions.create({
                model: this.character.settings.model,
                messages: [
                    { 
                        role: 'system', 
                        content: `${this.character.systemPrompt}\n\n${this.generateCapabilitiesPrompt()}`
                    },
                    ...history
                ],
                temperature: this.character.settings.temperature,
                max_tokens: this.character.settings.max_tokens
            });

            const response = completion.choices[0].message.content;
            history.push({ role: 'assistant', content: response });
            
            return response;
        } catch (error) {
            console.error('OpenAI API Error:', error);
            return "I'm having trouble processing that request right now. Please try again later.";
        }
    }

    clearConversationHistory(channelId) {
        this.conversationHistory.set(channelId, []);
    }
}

module.exports = async (app) => {
    let characterManager;
    
    try {
        characterManager = new CharacterManager(app.client);
        await characterManager.loadCharacter();
    } catch (error) {
        console.error('Failed to initialize CharacterManager:', error);
        return;
    }

    // Register plugin patterns - no command patterns, just for logging
    app.registerPlugin('character', []);

    // Handle direct messages
    app.message(async ({ message, client, say }) => {
        // Only handle DMs or mentions
        const isMention = message.text?.includes(`<@${client.botUserId}>`);
        if (message.channel_type !== 'im' && !isMention) return;

        // Skip bot messages
        if (message.bot_id || message.subtype === 'bot_message') return;

        // Clean up the message text
        const cleanMessage = message.text.replace(/<@[^>]+>\s*/, '').trim();

        // Check if this message should be handled by another plugin
        for (const [pluginName, patterns] of app.pluginRegistry) {
            if (pluginName === 'character') continue;
            if (app.isPluginPattern(pluginName, cleanMessage)) {
                return; // Let other plugin handle it
            }
        }

        // Generate AI response
        try {
            const response = await characterManager.generateResponse(cleanMessage, message.channel);
            await say({
                text: response,
                thread_ts: message.thread_ts
            });
        } catch (error) {
            console.error('Error handling message:', error);
            await say({
                text: "I'm having trouble processing that request right now. Please try again later.",
                thread_ts: message.thread_ts
            });
        }
    });

    // Handle app mentions
    app.event('app_mention', async ({ event, client, say }) => {
        if (event.bot_id || event.subtype === 'bot_message') return;

        const cleanMessage = event.text.replace(/<@[^>]+>\s*/, '').trim();

        // Check if this message should be handled by another plugin
        for (const [pluginName, patterns] of app.pluginRegistry) {
            if (pluginName === 'character') continue;
            if (app.isPluginPattern(pluginName, cleanMessage)) {
                return; // Let other plugin handle it
            }
        }

        // Generate AI response
        try {
            const response = await characterManager.generateResponse(cleanMessage, event.channel);
            await say({
                text: response,
                thread_ts: event.thread_ts
            });
        } catch (error) {
            console.error('Error handling mention:', error);
            await say({
                text: "I'm having trouble processing that request right now. Please try again later.",
                thread_ts: event.thread_ts
            });
        }
    });
}; 