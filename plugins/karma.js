const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    key: String,
    karma: Number,
});

const Karma = mongoose.model('Karma', schema);

module.exports = function(slackbot, config) {
    //
    slackbot.on('start', () => console.log('karma: bot started'));
};
