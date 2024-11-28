const os = require('os');

// Cache the hostname
const hostname = os.hostname();

function formatUptime(uptime) {
    const result = [];
    let remaining = Math.floor(uptime);

    const seconds = Math.floor(remaining % 60);
    remaining /= 60;

    const minutes = Math.floor(remaining % 60);
    remaining /= 60;

    const hours = Math.floor(remaining % 24);
    remaining /= 24;

    const days = Math.floor(remaining);

    if (days) {
        result.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    }

    if (days || hours) {
        result.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }

    if (days || hours || minutes) {
        result.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    }

    if (days || hours || minutes || seconds) {
        result.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
    }

    return result.join(', ');
}

module.exports = async (app) => {
    // Handle direct messages and mentions for uptime queries
    const patterns = ['uptime', 'identify yourself', 'who are you', 'what is your name'];
    const patternRegex = new RegExp(`^(${patterns.join('|')})$`, 'i');

    app.message(patternRegex, async ({ message, client, say }) => {
        // Get bot's own info
        const botInfo = await client.auth.test();
        const uptime = formatUptime(process.uptime());
        
        const reply = `:robot_face: I am a bot named <@${botInfo.user_id}>. I have been running for ${uptime} on ${hostname}.`;

        await say({
            text: reply,
            thread_ts: message.thread_ts || message.ts
        });
    });

    // Also handle app mentions with the same patterns
    app.event('app_mention', async ({ event, client, say }) => {
        const text = event.text.replace(/<@[^>]+>\s*/, '').trim();
        
        if (patterns.some(pattern => text.toLowerCase() === pattern.toLowerCase())) {
            const botInfo = await client.auth.test();
            const uptime = formatUptime(process.uptime());
            
            const reply = `:robot_face: I am a bot named <@${botInfo.user_id}>. I have been running for ${uptime} on ${hostname}.`;

            await say({
                text: reply,
                thread_ts: event.thread_ts || event.ts
            });
        }
    });
};
