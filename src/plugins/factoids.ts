import { App } from '@slack/bolt';
import { GenericMessageEvent } from '@slack/types/dist/events/message';
import { AppMentionEvent } from '@slack/types/dist/events/app';
import { BlockAction, ButtonAction } from '@slack/bolt';
import * as fs from 'fs';
import * as path from 'path';
import { Plugin, Storage } from '../types';
import patternRegistry from '../services/pattern-registry';

interface Fact {
    key: string;
    be: string;
    reply: boolean;
    value: string[];
}

interface FactoidStorage extends Storage {
    data: {
        [key: string]: Fact;
    };
}

// Keep track of pending forget requests
interface ForgetRequest {
    key: string;
    team: string;
    channel: string;
    thread_ts?: string;
    timestamp: number;
}

// Map of user ID to their pending forget request
const pendingForgetRequests: Map<string, ForgetRequest> = new Map();

// Cleanup old requests every 10 minutes (600000 ms)
setInterval(() => {
    const now = Date.now();
    for (const [userId, request] of pendingForgetRequests.entries()) {
        // Remove requests older than 5 minutes
        if (now - request.timestamp > 300000) {
            pendingForgetRequests.delete(userId);
        }
    }
}, 600000);

// Storage helper functions
const storageDir = path.join(__dirname, '..', '..', 'data', 'teams');
const getStoragePath = (team: string): string => path.join(storageDir, `${team}_factoids.json`);

async function loadFacts(team: string): Promise<FactoidStorage> {
    try {
        await fs.promises.mkdir(storageDir, { recursive: true });
        const data = await fs.promises.readFile(getStoragePath(team), 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { id: `${team}_factoids`, data: {} };
    }
}

async function saveFacts(team: string, factoids: FactoidStorage): Promise<void> {
    await fs.promises.mkdir(storageDir, { recursive: true });
    await fs.promises.writeFile(getStoragePath(team), JSON.stringify(factoids, null, 2));
}

interface SlackUser {
    id: string;
    profile?: {
        real_name?: string;
    };
    real_name?: string;
}

// Helper function to get user info
async function getUser(client: any, text: string): Promise<SlackUser | null> {
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

function factString(fact: Fact): string {
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

// HTML entity decoder
function decodeHtmlEntities(text: string): string {
    return text.replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");
}

// Replace the isReservedCommand function with this simplified version
function isReservedCommand(text: string): boolean {
    // Check if the text matches any registered pattern from other plugins
    const isReserved = patternRegistry.matchesAnyPattern(text);
    
    if (isReserved) {
        console.log(`Skipping factoid creation for command that matches another plugin: "${text}"`);
    }
    
    return isReserved;
}

const factoidsPlugin: Plugin = async (app: App): Promise<void> => {
    // Register factoid patterns with the registry
    patternRegistry.registerPattern(/^!factoid:\s*list$/i, 'factoids', 1);
    patternRegistry.registerPattern(/^forget\s+(.+)$/i, 'factoids', 1);
    patternRegistry.registerPattern(/^(YES|NO)$/i, 'factoids', 0.5); // Lower priority for YES/NO
    patternRegistry.registerPattern(/^([^?!]+)[!?]$/, 'factoids', 1); // Updated to allow spaces in factoid names
    
    // Also register patterns that can be handled in direct mentions (app_mention events)
    patternRegistry.registerPattern(/^([^?!]+)[!?]$/, 'factoids:app_mention', 1); // Updated to allow spaces in direct mentions

    // Add new list command
    app.message(/^!factoid:\s*list$/i, async ({ message, say, context }) => {
        const msg = message as GenericMessageEvent;
        const team = context.teamId || 'default';
        
        try {
            const factoids = await loadFacts(team);
            const keys = Object.keys(factoids.data);
            
            if (keys.length === 0) {
                await say({
                    text: "No factoids stored yet.",
                    thread_ts: msg.thread_ts || msg.ts // Always reply in a thread
                });
                return;
            }

            const sortedKeys = keys.sort().map(key => factoids.data[key].key);

            await say({
                text: `Available factoids: ${sortedKeys.join(', ')}`,
                thread_ts: msg.thread_ts || msg.ts // Always reply in a thread
            });
        } catch (error) {
            console.error('Error listing factoids:', error);
            await say({
                text: "Sorry, there was an error listing the factoids.",
                thread_ts: msg.thread_ts || msg.ts // Always reply in a thread
            });
        }
    });

    // Query a factoid - triggered by a pattern followed by ? or !
    app.message(/^([^?!]+)[!?]$/, async ({ message, context, client, say }) => {
        if (!context?.matches?.[1]) return;

        const msg = message as GenericMessageEvent;
        const rawQuery = context.matches[1].trim();
        const index = rawQuery.toLowerCase();
        const team = context.teamId || 'default';
        
        const factoids = await loadFacts(team);
        
        // First check if the query contains a user mention
        const userMentionMatch = rawQuery.match(/<@([UW][A-Z0-9]+)>/);
        let fact = null;
        
        if (userMentionMatch) {
            // If query has a user mention like "<@U12345>", look up by that user ID
            const userId = userMentionMatch[1];
            fact = factoids.data[userId] || null;
            
            // If no fact found by user ID, try with the full mention format
            if (!fact) {
                fact = factoids.data[`<@${userId}>`] || null;
            }
        } else {
            // Try to resolve as a user if there's no direct mention
            const user = await getUser(client, rawQuery);
            
            if (user) {
                // Try the user ID first
                fact = factoids.data[user.id] || null;
                
                // If no fact found, try with the full mention format
                if (!fact) {
                    fact = factoids.data[`<@${user.id}>`] || null;
                }
            } else {
                // Fall back to standard text lookup
                fact = factoids.data[index] || null;
            }
        }

        if (fact) {
            await say({
                text: factString(fact),
                ...(msg.thread_ts && { thread_ts: msg.thread_ts })
            });
        }
    });

    // Handle YES/NO responses to forget confirmation
    app.message(/^(YES|NO)$/i, async ({ message, say }) => {
        const msg = message as GenericMessageEvent;
        const userId = msg.user;
        const pendingRequest = pendingForgetRequests.get(userId);
        
        // If there's no pending request for this user, ignore
        if (!pendingRequest) return;
        
        // Remove the pending request
        pendingForgetRequests.delete(userId);
        
        // If NO, cancel the forget operation
        if (msg.text?.toUpperCase() === 'NO') {
            await say({
                text: `Okay, I'll keep the factoid for "${pendingRequest.key}".`,
                ...(msg.thread_ts && { thread_ts: msg.thread_ts })
            });
            return;
        }
        
        // If YES, proceed with forgetting
        try {
            const factoids = await loadFacts(pendingRequest.team);
            // Since ForgetRequest.key is defined as a string (not optional), we can use it directly
            if (factoids.data[pendingRequest.key]) {
                delete factoids.data[pendingRequest.key];
                await saveFacts(pendingRequest.team, factoids);
                await say({
                    text: `Okay, I have forgotten about "${pendingRequest.key}"`,
                    ...(msg.thread_ts && { thread_ts: msg.thread_ts })
                });
            } else {
                await say({
                    text: `I don't know anything about "${pendingRequest.key}"`,
                    ...(msg.thread_ts && { thread_ts: msg.thread_ts })
                });
            }
        } catch (err) {
            console.error('Error forgetting factoid:', err);
            await say({
                text: `There was a problem forgetting the factoid: ${err}`,
                ...(msg.thread_ts && { thread_ts: msg.thread_ts })
            });
        }
    });

    // Set factoid - only through direct mentions
    app.event('app_mention', async ({ event, client, say, context }) => {
        const mention = event as AppMentionEvent;
        // Remove the bot mention, decode HTML entities, and trim
        const text = decodeHtmlEntities(mention.text.replace(/<@[^>]+>\s*/, '').trim());

        // Handle query factoid pattern first (patterns followed by ? or !)
        const queryMatch = text.match(/^([^?!]+)[!?]$/);
        if (queryMatch) {
            const rawQuery = queryMatch[1].trim();
            const index = rawQuery.toLowerCase();
            const team = context.teamId || 'default';
            
            const factoids = await loadFacts(team);
            
            // First check if the query contains a user mention
            const userMentionMatch = rawQuery.match(/<@([UW][A-Z0-9]+)>/);
            let fact = null;
            
            if (userMentionMatch) {
                // If query has a user mention like "<@U12345>", look up by that user ID
                const userId = userMentionMatch[1];
                fact = factoids.data[userId] || null;
                
                // If no fact found by user ID, try with the full mention format
                if (!fact) {
                    fact = factoids.data[`<@${userId}>`] || null;
                }
            } else {
                // Try to resolve as a user if there's no direct mention
                const user = await getUser(client, rawQuery);
                
                if (user) {
                    // Try the user ID first
                    fact = factoids.data[user.id] || null;
                    
                    // If no fact found, try with the full mention format
                    if (!fact) {
                        fact = factoids.data[`<@${user.id}>`] || null;
                    }
                } else {
                    // Fall back to standard text lookup
                    fact = factoids.data[index] || null;
                }
            }

            if (fact) {
                await say({
                    text: factString(fact),
                    thread_ts: mention.thread_ts || mention.ts
                });
                return;
            }
        }

        // Handle YES/NO responses to forget confirmation in mentions
        if (/^(YES|NO)$/i.test(text)) {
            // Make sure the user ID is a string
            const userId = mention.user || '';
            const pendingRequest = pendingForgetRequests.get(userId);
            
            // If there's no pending request for this user, ignore
            if (!pendingRequest) return;
            
            // Remove the pending request
            pendingForgetRequests.delete(userId);
            
            // If NO, cancel the forget operation
            if (text.toUpperCase() === 'NO') {
                await say({
                    text: `Okay, I'll keep the factoid for "${pendingRequest.key}".`,
                    thread_ts: mention.thread_ts || mention.ts
                });
                return;
            }
            
            // If YES, proceed with forgetting
            try {
                const factoids = await loadFacts(pendingRequest.team);
                // Since ForgetRequest.key is defined as a string (not optional), we can use it directly
                if (factoids.data[pendingRequest.key]) {
                    delete factoids.data[pendingRequest.key];
                    await saveFacts(pendingRequest.team, factoids);
                    await say({
                        text: `Okay, I have forgotten about "${pendingRequest.key}"`,
                        thread_ts: mention.thread_ts || mention.ts
                    });
                } else {
                    await say({
                        text: `I don't know anything about "${pendingRequest.key}"`,
                        thread_ts: mention.thread_ts || mention.ts
                    });
                }
            } catch (err) {
                console.error('Error forgetting factoid:', err);
                await say({
                    text: `There was a problem forgetting the factoid: ${err}`,
                    thread_ts: mention.thread_ts || mention.ts
                });
            }
            return;
        }

        // Handle forget command
        const forgetMatch = text.match(/^forget\s+(.+)$/i);
        if (forgetMatch) {
            const team = context.teamId || 'default';
            const key = forgetMatch[1]?.trim().toLowerCase();

            if (!key) return;

            try {
                const factoids = await loadFacts(team);
                if (factoids.data[key]) {
                    // Create a pending forget request
                    if (mention.user) {
                        pendingForgetRequests.set(mention.user, {
                            key,
                            team,
                            channel: mention.channel,
                            thread_ts: mention.thread_ts || mention.ts,
                            timestamp: Date.now()
                        });
                    }
                    
                    // Ask for confirmation
                    await say({
                        text: `Are you sure you want me to forget "${key}"? Say YES, or NO`,
                        thread_ts: mention.thread_ts || mention.ts
                    });
                } else {
                    await say({
                        text: `I don't know anything about "${key}"`,
                        thread_ts: mention.thread_ts || mention.ts
                    });
                }
            } catch (err) {
                console.error('Error checking factoid:', err);
                await say({
                    text: `There was a problem checking the factoid: ${err}`,
                    thread_ts: mention.thread_ts || mention.ts
                });
            }
            return;
        }
        
        // Match "X is Y" pattern
        const setMatches = text.match(/^(.+?)\s+(is|are)\s+(.+)$/i);
        if (setMatches) {
            const team = context.teamId || 'default';
            const key = setMatches[1]?.trim();
            
            if (!key) return;
            
            // Skip if the key is a reserved command
            if (isReservedCommand(key)) return;

            // Check if the key contains a user mention
            const userMentionMatch = key.match(/<@([UW][A-Z0-9]+)>/);
            let storeKey = key.toLowerCase();
            let displayKey = key;
            let userId = null;

            if (userMentionMatch) {
                // If the key directly contains a user mention, use the user ID as the storage key
                userId = userMentionMatch[1];
                storeKey = userId;
                displayKey = key; // Preserve the original mention format for display
            } else {
                // Try to resolve as a user if there's no direct mention
                const user = await getUser(client, key);
                if (user) {
                    userId = user.id;
                    storeKey = userId;
                    displayKey = `<@${userId}>`;
                }
            }

            let value = setMatches[3]?.trim() || '';
            const hasReply = value.startsWith('<reply>');
            
            // If it's a reply, remove the <reply> tag from the value
            if (hasReply) {
                value = value.replace(/^<reply>\s*/, '').trim();
            }

            const fact: Fact = {
                key: displayKey,
                be: setMatches[2]?.trim() || 'is',
                reply: hasReply,
                value: [value]
            };

            const factoids = await loadFacts(team);
            const existing = factoids.data[storeKey];

            if (!existing) {
                try {
                    factoids.data[storeKey] = fact;
                    await saveFacts(team, factoids);
                    await say({ 
                        text: 'Got it!',
                        thread_ts: mention.thread_ts || mention.ts
                    });
                } catch (err) {
                    console.error('Error saving factoid:', err);
                    await say({ 
                        text: `There was a problem saving the factoid: ${err}`,
                        thread_ts: mention.thread_ts || mention.ts
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
                    thread_ts: mention.thread_ts || mention.ts
                });

                // Handle button actions
                app.action(new RegExp(`${actionId}_(update|append|cancel)`), async ({ action, ack, respond }) => {
                    await ack();
                    
                    const buttonAction = (action as ButtonAction) as unknown as { value: string };
                    const choice = buttonAction.value;

                    try {
                        if (choice === 'update') {
                            factoids.data[storeKey] = fact;
                            await saveFacts(team, factoids);
                            await respond({
                                text: `✅ Updated! New factoid is:\n"${factString(fact)}"`,
                                replace_original: true
                            });
                        } else if (choice === 'append') {
                            factoids.data[storeKey].value = factoids.data[storeKey].value.concat(fact.value);
                            await saveFacts(team, factoids);
                            await respond({
                                text: `✅ Appended! Updated factoid is now:\n"${factString(factoids.data[storeKey])}"`,
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
    });
};

export default factoidsPlugin; 