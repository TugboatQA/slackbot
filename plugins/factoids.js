const fs = require('fs').promises;
const path = require('path');

// Storage helper functions
const storageDir = path.join(__dirname, '..', 'data');
const getStoragePath = (team) => path.join(storageDir, `${team}_factoids.json`);

async function loadFacts(team) {
    try {
        await fs.mkdir(storageDir, { recursive: true });
        const data = await fs.readFile(getStoragePath(team), 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { id: `${team}_factoids`, data: {} };
    }
}

async function saveFacts(team, factoids) {
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(getStoragePath(team), JSON.stringify(factoids, null, 2));
}

async function getUser(client, text) {
    const userMatch = text.match(/<@([UW][A-Z0-9]+)>/);
    if (userMatch) {
        try {
            const result = await client.users.info({ user: userMatch[1] });
            return result.user;
        } catch (error) {
            console.error('Error fetching user:', error);
            return null;
        }
    }
    return null;
}

function factString(fact) {
    let result = '';
    fact.value.forEach(value => {
        if (!result) {
            if (fact.reply) {
                result += value;
            } else {
                result += `${fact.key} ${fact.be} ${value}`;
            }
        } else {
            result += ` and also ${value}`;
        }
    });
    return result;
}

module.exports = async (app) => {
    // Register plugin patterns
    app.registerPlugin('factoids', [
        /^!factoid:/i,  // All factoid commands start with this
    ]);

    // Query a factoid
    app.message(/^!factoid:\s*([^.,!?\s]+)\?$/, async ({ message, context, client, say }) => {
        if (!context?.matches?.[1]) return;

        const key = context.matches[1].trim().toLowerCase();
        const team = message.team || 'default';
        
        try {
            const factoids = await loadFacts(team);
            const user = await getUser(client, key);
            
            let fact = null;
            if (user) {
                fact = factoids.data[user.id] || null;
                if (fact) fact.index = user.id;
            } else {
                fact = factoids.data[key] || null;
                if (fact) fact.index = key;
            }

            if (fact) {
                await say({
                    text: factString(fact),
                    ...(message.thread_ts && { thread_ts: message.thread_ts })
                });
            } else {
                await say({
                    text: `No factoid found for "${key}"`,
                    ...(message.thread_ts && { thread_ts: message.thread_ts })
                });
            }
        } catch (error) {
            console.error('Error retrieving factoid:', error);
            await say({
                text: "Sorry, there was an error retrieving the factoid.",
                thread_ts: message.thread_ts
            });
        }
    });

    // Set or update factoid
    app.message(/^!factoid:\s*(.+?)\s+(is|are)\s+(<reply>)?\s*(.+)$/i, async ({ message, context, client, say }) => {
        if (!context?.matches) return;

        const [, key, be, isReply, value] = context.matches;
        const team = message.team || 'default';

        try {
            const user = await getUser(client, key);
            const fact = {
                index: user ? user.id : key.toLowerCase(),
                key: user ? `<@${user.id}>` : key.toLowerCase(),
                be: be.trim(),
                reply: !!isReply,
                value: [value.trim()]
            };

            const factoids = await loadFacts(team);
            const existing = factoids.data[fact.index];

            if (!existing) {
                factoids.data[fact.index] = fact;
                await saveFacts(team, factoids);
                await say({
                    text: 'Factoid saved!',
                    thread_ts: message.thread_ts
                });
            } else {
                // Handle update with buttons
                await say({
                    blocks: [
                        {
                            type: "section",
                            text: {
                                type: "mrkdwn",
                                text: `I already have a factoid for "${existing.key}". It says:\n"${factString(existing)}"`
                            }
                        },
                        {
                            type: "actions",
                            block_id: "factoid_actions",
                            elements: [
                                {
                                    type: "button",
                                    text: {
                                        type: "plain_text",
                                        text: "Update",
                                        emoji: true
                                    },
                                    value: "update",
                                    action_id: `factoid_update_${Date.now()}`
                                },
                                {
                                    type: "button",
                                    text: {
                                        type: "plain_text",
                                        text: "Append",
                                        emoji: true
                                    },
                                    value: "append",
                                    action_id: `factoid_append_${Date.now()}`
                                },
                                {
                                    type: "button",
                                    text: {
                                        type: "plain_text",
                                        text: "Cancel",
                                        emoji: true
                                    },
                                    value: "cancel",
                                    style: "danger",
                                    action_id: `factoid_cancel_${Date.now()}`
                                }
                            ]
                        }
                    ],
                    text: `I already have a factoid for "${existing.key}". What would you like to do?`,
                    thread_ts: message.thread_ts
                });
            }
        } catch (error) {
            console.error('Error saving factoid:', error);
            await say({
                text: "Sorry, there was an error saving the factoid.",
                thread_ts: message.thread_ts
            });
        }
    });

    // Delete factoid
    app.message(/^!factoid:\s*forget\s+(.+)$/i, async ({ message, context, client, say }) => {
        if (!context?.matches?.[1]) return;

        const key = context.matches[1].trim();
        const team = message.team || 'default';

        try {
            const factoids = await loadFacts(team);
            const user = await getUser(client, key);
            const factIndex = user ? user.id : key.toLowerCase();
            
            if (factoids.data[factIndex]) {
                delete factoids.data[factIndex];
                await saveFacts(team, factoids);
                await say({
                    text: `I've forgotten about "${key}"`,
                    thread_ts: message.thread_ts
                });
            } else {
                await say({
                    text: `I don't have any factoid for "${key}"`,
                    thread_ts: message.thread_ts
                });
            }
        } catch (error) {
            console.error('Error deleting factoid:', error);
            await say({
                text: "Sorry, there was an error deleting the factoid.",
                thread_ts: message.thread_ts
            });
        }
    });

    // Handle factoid update/append actions
    app.action(/^factoid_(update|append|cancel)_\d+$/, async ({ action, ack, respond, body }) => {
        await ack();
        
        const choice = action.value;
        const team = body.team.id || 'default';

        try {
            // Extract the original factoid key from the message text
            const messageText = body.message.text;
            const keyMatch = messageText.match(/factoid for "([^"]+)"/);
            if (!keyMatch) throw new Error('Could not determine factoid key');

            const key = keyMatch[1];
            const factoids = await loadFacts(team);
            
            // Find the factoid
            const factIndex = key.startsWith('<@') ? key.match(/<@([^>]+)>/)[1] : key.toLowerCase();
            
            if (!factoids.data[factIndex]) {
                await respond({
                    text: "Sorry, I can't find that factoid anymore.",
                    replace_original: true
                });
                return;
            }

            if (choice === 'update') {
                // Update logic here
                // You'll need to store the new value somewhere
                await respond({
                    text: `✅ Updated factoid for "${key}"`,
                    replace_original: true
                });
            } else if (choice === 'append') {
                // Append logic here
                await respond({
                    text: `✅ Appended to factoid for "${key}"`,
                    replace_original: true
                });
            } else {
                await respond({
                    text: '❌ Cancelled - keeping the existing factoid.',
                    replace_original: true
                });
            }
        } catch (error) {
            console.error('Error handling factoid action:', error);
            await respond({
                text: "Sorry, there was an error processing your request.",
                replace_original: false
            });
        }
    });
};
