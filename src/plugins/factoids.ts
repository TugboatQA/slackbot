import { App } from '@slack/bolt';
import { GenericMessageEvent } from '@slack/types/dist/events/message';
import { AppMentionEvent } from '@slack/types/dist/events/app';
import { BlockAction, ButtonAction } from '@slack/bolt';
import * as fs from 'fs';
import * as path from 'path';
import { Plugin, Storage } from '../types';

interface Fact {
    index: string;
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

// Storage helper functions
const storageDir = path.join(__dirname, '..', '..', 'data');
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

const factoidsPlugin: Plugin = async (app: App): Promise<void> => {
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
                    ...(msg.thread_ts && { thread_ts: msg.thread_ts })
                });
                return;
            }

            const sortedKeys = keys.sort().map(key => factoids.data[key].key);

            await say({
                text: `Available factoids: ${sortedKeys.join(', ')}`,
                ...(msg.thread_ts && { thread_ts: msg.thread_ts })
            });
        } catch (error) {
            console.error('Error listing factoids:', error);
            await say({
                text: "Sorry, there was an error listing the factoids.",
                ...(msg.thread_ts && { thread_ts: msg.thread_ts })
            });
        }
    });

    // Query a factoid
    app.message(/^!factoid:\s*([^.,!?\s]+)\?$/, async ({ message, context, client, say }) => {
        if (!context?.matches?.[1]) return;

        const msg = message as GenericMessageEvent;
        const index = context.matches[1].trim();
        const team = context.teamId || 'default';
        
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
                ...(msg.thread_ts && { thread_ts: msg.thread_ts })
            });
        }
    });

    // Set factoid - only through direct mentions
    app.event('app_mention', async ({ event, client, say, context }) => {
        const mention = event as AppMentionEvent;
        // Remove the bot mention and any leading/trailing whitespace
        const text = mention.text.replace(/<@[^>]+>\s*/, '').trim();
        
        // Match "X is Y" pattern
        const setMatches = text.match(/^(.+?)\s(is|are)\s(<reply>)?(.+)$/);
        if (setMatches) {
            const team = context.teamId || 'default';
            const index = setMatches[1]?.trim();
            
            if (!index) return;

            const user = await getUser(client, index);

            const fact: Fact = {
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
                        thread_ts: mention.thread_ts || mention.ts
                    });
                } catch (err) {
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
                    thread_ts: mention.ts
                });

                // Handle button actions
                app.action(new RegExp(`${actionId}_(update|append|cancel)`), async ({ action, ack, respond }) => {
                    await ack();
                    
                    const buttonAction = (action as ButtonAction) as unknown as { value: string };
                    const choice = buttonAction.value;

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
            const team = context.teamId || 'default';
            const index = forgetMatches[1].trim();
            const factoids = await loadFacts(team);
            
            const user = await getUser(client, index);
            const factIndex = user ? user.id : index.toLowerCase();
            
            if (factoids.data[factIndex]) {
                delete factoids.data[factIndex];
                await saveFacts(team, factoids);
                await say({
                    text: `I've forgotten about "${index}"`,
                    thread_ts: mention.thread_ts || mention.ts
                });
            } else {
                await say({
                    text: `I don't have any factoid for "${index}"`,
                    thread_ts: mention.thread_ts || mention.ts
                });
            }
        }
    });
};

export default factoidsPlugin; 