module.exports = controller => {
    controller.hears(['hi'], ['direct_message', 'direct_mention', 'mention'], async (bot, message) => {
        const team = await controller.storage.teams.get(message.team);

        team.karma = team.karma || {};
        team.karma[message.text] = team.karma[message.text] || 0;
        team.karma[message.text] += 1;

        controller.storage.teams.save(team);

        bot.reply(message, `${message.text} has karma of ${team.karma[message.text]}`);
    });
};
