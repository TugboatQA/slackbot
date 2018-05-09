const util = require('util');

const controller = require('../controller');
const slackbot = require('../slackbot');

// Listener: Retrieve a factoid.
// Using controller.on instead of controller.hears here because the latter
// will cause execution of any other .hears to be skipped after the first
// one that matches. And the pattern we use here is super greedy so we want
// to allow other skills to also match strings that end with a "?" or "!".
controller.on(['ambient', 'direct_mention', 'direct_message'], async (bot, message) => {
    if (message.text) {
        const matches = /^(.*?)[?|!]$/.exec(message.text);
        if (matches) {
            const fact = await getFact(bot, message, matches[1].trim());
            const user = await slackbot.getUser(fact.key, bot);
            if (fact) {
                bot.reply(message, factString(fact, user));
            }
        }
    }
});

// Listener: Setting and updating factoids
controller.hears(/^(.+?)\s(is|are)\s(&lt;reply&gt;)?(.+)$/, ['direct_mention', 'direct_message'], setFact);

// Listener: Delete a factoid
controller.hears(/^forget\s(.*?)$/, ['direct_mention', 'direct_message'], forgetFact);

async function getFact(bot, message, key) {
    const factoids = await loadFacts(message.team);
    const user = await slackbot.getUser(key, bot);

    let fact;
    if (user) {
        fact = factoids[user.id];
    } else {
        fact = factoids[key.toLowerCase()];
    }

    return fact || null;
}

async function setFact(bot, message) {
    const fact = {
        key: message.match[1].trim(),
        be: message.match[2].trim(),
        reply: !!message.match[3],
        value: [message.match[4].trim()],
    };

    const existing = await getFact(bot, message, fact.key);

    if (!existing) {
        try {
            await saveFact(message.team, fact);
            bot.reply(message, 'Got it!');
        } catch (err) {
            bot.reply(message, `There was a problem saving the factoid. ${err}`);
        }
    } else {
        const responses = [
            {
                pattern: bot.utterances.yes,
                callback: async (response, convo) => {
                    try {
                        await saveFact(message.team, fact);
                        convo.say("Okay, I've overwritten the existing factoid");
                        convo.say(factString(fact));
                    } catch (err) {
                        convo.say(`There was a problem saving the factoid. ${err}`);
                    }
                    convo.next();
                },
            },
            {
                pattern: bot.utterances.no,
                callback: (response, convo) => {
                    convo.say("Okay, I'll leave it as is.");
                    convo.next();
                },
            },
            {
                pattern: 'append',
                callback: async (response, convo) => {
                    try {
                        existing.value = existing.value.concat(fact.value);
                        await saveFact(message.team, existing);
                        convo.say("Okay, I've updated it");
                        convo.say(factString(existing));
                    } catch (err) {
                        convo.say(`There was a problem appending the factoid. ${err}`);
                    }
                    convo.next();
                },
            },
        ];

        bot.startConversation(message, async (err, convo) => {
            const user = await slackbot.getUser(existing.key);
            const text = user ? user.real_name : fact.key;
            convo.say(`I already have a factoid for "${text}". It says "${factString(existing, user)}"`);
            convo.addQuestion('Do you want me to update it? Say YES, NO, or APPEND', responses, {}, 'default');
        });
    }
}

async function forgetFact(bot, message) {
    const fact = await getFact(bot, message, message.match[1].trim());
    const user = await slackbot.getUser(fact.key, bot);
    const text = user ? user.real_name : fact.key;

    const factoids = await loadFacts(message.team);
    const responses = [
        {
            pattern: bot.utterances.yes,
            callback: async (response, convo) => {
                try {
                    delete factoids[fact.key];
                    await util.promisify(controller.storage.teams.save)(factoids);
                    convo.say(`Okay, I have forgotten about "${text}"`);
                } catch (err) {
                    convo.say(`There was a problem forgetting about "${text}". ${err}`);
                }
                convo.next();
            },
        },
        {
            pattern: bot.utterances.no,
            callback: (response, convo) => {
                convo.say("Okay, I'll leave it as is.");
                convo.next();
            },
        },
    ];

    bot.startConversation(message, (err, convo) => {
        convo.addQuestion(`Are you sure you want me to forget "${text}"? Say YES, or NO`, responses, {}, 'default');
    });
}

async function saveFact(team, { key, be = 'is', reply = false, value }) {
    const factoids = await loadFacts(team);
    factoids[key] = { key, be, reply, value };
    await util.promisify(controller.storage.teams.save)(factoids);
}

function factString(fact, user) {
    let result = '';

    fact.value.forEach(value => {
        if (!result) {
            if (fact.reply) {
                result += value;
            } else {
                const text = user ? user.real_name : fact.key;
                result += `${text} ${fact.be} ${fact.value}`;
            }
        } else {
            result += ` and also ${value}`;
        }
    });

    return result;
}

async function loadFacts(team) {
    let factoids;

    try {
        factoids = await util.promisify(controller.storage.teams.get)(`${team}_factoids`);
    } catch (err) {
        factoids = {};
    }

    factoids.id = `${team}_factoids`;
    return factoids;
}
