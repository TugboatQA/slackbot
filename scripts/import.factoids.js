/* eslint-disable no-console, import/no-extraneous-dependencies */

const Botkit = require('botkit');
const csv = require('fast-csv');
const fs = require('fs');
const util = require('util');

if (!process.argv[2] || !process.argv[3]) {
    console.error(`Arguments missing: ${process.argv[1]} {SLACK_TEAM_ID} {PATH/TO/FILE.csv}`);
    process.exit(1);
}

const config = require('../lib/config');

const team = process.argv[2];
const csvfile = process.argv[3];

const controller = Botkit.slackbot({
    json_file_store: config.json_file_store,
});

controller.spawn({ token: config.token }).startRTM(err => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
});

controller.on('rtm_open', bot => importFactoids(bot));

async function importFactoids(bot) {
    const factoids = [];
    const users = await util.promisify(bot.api.users.list)({ limit: 1000 });

    const findUser = string =>
        users.members.find(user => {
            const find = [user.id, user.name, user.real_name || '', user.profile.display_name || ''];
            return find.map(key => key.toLowerCase()).includes(string.toLowerCase());
        });

    // Open the CSV file and loop through all the rows
    fs
        .createReadStream(csvfile)
        .pipe(csv({ headers: ['key', 'be', 'value'], escape: '\\' }))
        .on('data', row => factoids.push(row))
        .on('end', async () => {
            try {
                const result = { id: `${team}_factoids`, data: {} };

                factoids.forEach(factoid => {
                    // Filter out the "tell X about Y" facts
                    if (/^tell /.test(factoid.key)) {
                        return;
                    }

                    const user = findUser(factoid.key);
                    const index = user ? user.id : factoid.key.toLowerCase();
                    const reply = /^<reply>(.*)/.exec(factoid.value);
                    const value = reply ? reply[1] : factoid.value;

                    if (result.data[index]) {
                        result.data[index].value.push(value);
                    } else {
                        result.data[index] = {
                            key: user ? `<@${user.id}>` : factoid.key.toLowerCase(),
                            be: factoid.be,
                            reply: !!reply,
                            value: [value],
                        };
                    }
                });

                console.log(result);

                await util.promisify(controller.storage.teams.save)(result);
                console.log('Success!');
                process.exit(0);
            } catch (err) {
                console.error(err);
                process.exit(1);
            }
        });
}
