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

// Helper function to get user info
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
    // Add new list command
    app.message(/^!factoid:\s*list$/i, async ({ message, say }) => {
        const team = message.team || 'default';
        
        try {
            const factoids = await loadFacts(team);
            const keys = Object.keys(factoids.data);
            
            if (keys.length === 0) {
                await say({
                    text: "No factoids stored yet.",
                    ...(message.thread_ts && { thread_ts: message.thread_ts })
                });
                return;
            }

            const sortedKeys = keys.sort().map(key => {
                // If key is a user ID, keep the <@ID> format
                return factoids.data[key].key;
            });

            await say({
                text: `Available factoids: ${sortedKeys.join(', ')}`,
                ...(message.thread_ts && { thread_ts: message.thread_ts })
            });
        } catch (error) {
            console.error('Error listing factoids:', error);
            await say({
                text: "Sorry, there was an error listing the factoids.",
                thread_ts: message.thread_ts
            });
        }
    });

    // Query a factoid
    app.message(/^!factoid:\s*([^.,!?\s]+)\?$/, async ({ message, context, client, say }) => {
        if (!context?.matches?.[1]) return;

        const index = context.matches[1].trim();
        const team = message.team || 'default';
        
        const factoids = await loadFacts(team);
        const user = await getUser(client, index);
        
        let fact = null;
        if (user) {
            fact = factoids.data[user.id] || null;
            if (fact) fact.index = user.id;
        } else {
            fact = factoids.data[index.toLowerCase()] || null;
            if (fact) fact.index = index.toLowerCase();
        }

        if (fact) {
            await say({
                text: factString(fact),
                ...(message.thread_ts && { thread_ts: message.thread_ts })
            });
        }
    });

    // Set factoid - only through direct mentions
    app.event('app_mention', async ({ event, client, say }) => {
        // Remove the bot mention and any leading/trailing whitespace
        const text = event.text.replace(/<@[^>]+>\s*/, '').trim();
        
        // Match "X is Y" pattern
        const setMatches = text.match(/^(.+?)\s(is|are)\s(<reply>)?(.+)$/);
        if (setMatches) {
            const team = event.team || 'default';
            const index = setMatches[1]?.trim();
            
            if (!index) return;

            const user = await getUser(client, index);

            const fact = {
                index: user ? user.id : index.toLowerCase(),
                key: user ? `<@${user.id}>` : index.toLowerCase(),
                be: setMatches[2]?.trim() || 'is',
                reply: !!setMatches[3],
                value: [setMatches[4]?.trim() || '']
            };

            const factoids = await loadFacts(team);
            const existing = factoids.data[fact.index];

            if (!existing) {
                try {
                    factoids.data[fact.index] = fact;
                    await saveFacts(team, factoids);
                    await say({ 
                        text: 'Got it!',
                        ...(event.thread_ts && { thread_ts: event.thread_ts })
                    });
                } catch (err) {
                    await say({ 
                        text: `There was a problem saving the factoid: ${err}`,
                        ...(event.thread_ts && { thread_ts: event.thread_ts })
                    });
                }
            } else {
                // Create a unique action_id for this update
                const actionId = `factoid_update_${Date.now()}`;
                
                // Start a thread for confirmation with buttons
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
                                    action_id: `${actionId}_update`
                                },
                                {
                                    type: "button",
                                    text: {
                                        type: "plain_text",
                                        text: "Append",
                                        emoji: true
                                    },
                                    value: "append",
                                    action_id: `${actionId}_append`
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
                                    action_id: `${actionId}_cancel`
                                }
                            ]
                        }
                    ],
                    text: `I already have a factoid for "${existing.key}". What would you like to do?`,
                    thread_ts: event.ts
                });

                // Handle button actions
                app.action(new RegExp(`${actionId}_(update|append|cancel)`), async ({ action, ack, respond }) => {
                    await ack();
                    
                    const choice = action.value;

                    try {
                        if (choice === 'update') {
                            factoids.data[fact.index] = fact;
                            await saveFacts(team, factoids);
                            await respond({
                                text: `✅ Updated! New factoid is:\n"${factString(fact)}"`,
                                replace_original: true
                            });
                        } else if (choice === 'append') {
                            factoids.data[fact.index].value = factoids.data[fact.index].value.concat(fact.value);
                            await saveFacts(team, factoids);
                            await respond({
                                text: `✅ Appended! Updated factoid is now:\n"${factString(factoids.data[fact.index])}"`,
                                replace_original: true
                            });
                        } else {
                            await respond({
                                text: '❌ Cancelled - keeping the existing factoid.',
                                replace_original: true
                            });
                        }
                    } catch (err) {
                        await respond({
                            text: `Error updating factoid: ${err}`,
                            replace_original: false
                        });
                    }
                });
            }
            return;
        }

        // Match "forget X" pattern
        const forgetMatches = text.match(/^forget\s(.*?)$/);
        if (forgetMatches) {
            const team = event.team || 'default';
            const index = forgetMatches[1].trim();
            const factoids = await loadFacts(team);
            
            const user = await getUser(client, index);
            const factIndex = user ? user.id : index.toLowerCase();
            
            if (factoids.data[factIndex]) {
                delete factoids.data[factIndex];
                await saveFacts(team, factoids);
                await say({
                    text: `I've forgotten about "${index}"`,
                    ...(event.thread_ts && { thread_ts: event.thread_ts })
                });
            } else {
                await say({
                    text: `I don't have any factoid for "${index}"`,
                    ...(event.thread_ts && { thread_ts: event.thread_ts })
                });
            }
        }
    });
};
