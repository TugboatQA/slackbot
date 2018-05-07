const util = require('util');

const controller = require('../controller');

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
controller.hears(/^(.+?)\s(is|are)\s(.+)$/, ['direct_mention', 'direct_message'], setFact);

// Listener: Delete a factoid
controller.hears(/^forget\s(.*?)$/, ['direct_mention', 'direct_message'], forgetFact);

async function getFact(bot, message, key) {
    let factoids;

    try {
        factoids = await util.promisify(controller.storage.teams.get)(`${message.team}_factoids`);
    } catch (err) {
        factoids = {};
    }

    if (factoids[key]) {
        return factoids[key];
    }
    return null;
}

async function setFact(bot, message) {
    const fact = {
        key: message.match[1].trim(),
        be: message.match[2].trim(),
        value: [message.match[3].trim()],
    };

    const existing = await getFact(bot, message, fact.key);

    if (!existing) {
        try {
            await saveFact(message.team, fact.key, fact.be, fact.value);
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
                        await saveFact(message.team, fact.key, fact.be, fact.value);
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
                        await saveFact(message.team, existing.key, existing.be, existing.value);
                        convo.say("Okay, I've updated it");
                        convo.say(factString(existing));
                    } catch (err) {
                        convo.say(`There was a problem appending the factoid. ${err}`);
                    }
                    convo.next();
                },
            },
        ];

        bot.reply(message, `I already have a factoid for "${fact.key}". It says "${factString(existing)}`);
        bot.startConversation(message, (err, convo) => {
            convo.addQuestion('Do you want me to update it? Say YES, NO, or APPEND', responses, {}, 'default');
        });
    }
}

async function forgetFact(bot, message) {
    //
}

async function saveFact(team, key, be, value) {
    let factoids;

    try {
        factoids = await util.promisify(controller.storage.teams.get)(`${team}_factoids`);
    } catch (err) {
        factoids = {};
    }

    factoids[key] = { key, be, value };
    factoids.id = `${team}_factoids`;
    await util.promisify(controller.storage.teams.save)(factoids);
}

function factString(fact) {
    let result = '';

    fact.value.forEach(value => {
        if (!result) {
            if (value.startsWith('<reply>')) {
                result += value.substr(7);
            }
            result += `${fact.key} ${fact.be} ${fact.value}`;
        } else if (value.startsWith('<reply>')) {
            result += ` and also ${value.substr(7)}`;
        } else {
            result += ` and also ${value}`;
        }
    });

    return result;
}
