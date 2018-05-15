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
            if (fact) {
                bot.reply(message, factString(fact));
            }
        }
    }
});

// Listener: Setting and updating factoids
controller.hears(/^(.+?)\s(is|are)\s(&lt;reply&gt;)?(.+)$/, ['direct_mention', 'direct_message'], setFact);

// Listener: Delete a factoid
controller.hears(/^forget\s(.*?)$/, ['direct_mention', 'direct_message'], forgetFact);

async function getFact(bot, message, index) {
    const factoids = await loadFacts(message.team);
    const user = await slackbot.getUser(bot, index);

    let fact;

    if (user) {
        fact = factoids.data[user.id] || null;
        if (fact) {
            fact.index = user.id;
        }
    } else {
        fact = factoids.data[index.toLowerCase()] || null;
        if (fact) {
            fact.index = index.toLowerCase();
        }
    }

    return fact;
}

async function setFact(bot, message) {
    const index = message.match[1].trim();
    const user = await slackbot.getUser(bot, index);

    const fact = {
        index: user ? user.id : index,
        key: user ? `<@${user.id}>` : index,
        be: message.match[2].trim(),
        reply: !!message.match[3],
        value: [message.match[4].trim()],
    };

    const existing = await getFact(bot, message, fact.index);

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
            convo.say(`I already have a factoid for "${existing.key}". It says "${factString(existing)}"`);
            convo.addQuestion('Do you want me to update it? Say YES, NO, or APPEND', responses, {}, 'default');
        });
    }
}

async function forgetFact(bot, message) {
    const fact = await getFact(bot, message, message.match[1].trim());

    const factoids = await loadFacts(message.team);
    const responses = [
        {
            pattern: bot.utterances.yes,
            callback: async (response, convo) => {
                try {
                    delete factoids.data[fact.index];
                    await util.promisify(controller.storage.teams.save)(factoids);
                    convo.say(`Okay, I have forgotten about "${fact.key}"`);
                } catch (err) {
                    convo.say(`There was a problem forgetting about "${fact.key}". ${err}`);
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
        const question = `Are you sure you want me to forget "${fact.key}"? Say YES, or NO`;
        convo.addQuestion(question, responses, {}, 'default');
    });
}

async function saveFact(team, { index, key, be = 'is', reply = false, value }) {
    const factoids = await loadFacts(team);
    factoids.data[index] = { key, be, reply, value };
    await util.promisify(controller.storage.teams.save)(factoids);
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

async function loadFacts(team) {
    let factoids;

    try {
        factoids = await util.promisify(controller.storage.teams.get)(`${team}_factoids`);
    } catch (err) {
        factoids = { id: `${team}_factoids`, data: {} };
    }

    return factoids;
}
