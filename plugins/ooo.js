require('datejs');

// BambooHR API wrapper
class BambooHR {
    constructor({ apikey, subdomain }) {
        this.apikey = apikey;
        this.subdomain = subdomain;
    }

    async getWhosOut({ start, end }) {
        try {
            const response = await fetch(
                `https://api.bamboohr.com/api/gateway.php/${this.subdomain}/v1/time_off/whos_out/?start=${start}&end=${end}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Basic ${Buffer.from(`${this.apikey}:`).toString('base64')}`
                    }
                }
            );
            return await response.json();
        } catch (err) {
            console.error('BambooHR API Error:', err);
            throw err;
        }
    }
}

function sortOn(property) {
    return function(a, b) {
        if (a[property] < b[property]) return -1;
        if (a[property] > b[property]) return 1;
        return 0;
    };
}

function buildOOOMessage(employees, start) {
    if (!start) {
        start = Date.today();
    }

    // Sort by name
    employees.sort(sortOn("name"));

    const ooo = [`*OOO for ${start.toString('dddd, MMM d yyyy')}*`];

    Object.keys(employees).forEach(function(key) {
        const e = employees[key];
        if (e.type == 'timeOff') {
            let ooo_date = null;
            if (e.end != start.toString('yyyy-MM-dd')) {
                const date = Date.parse(e.end);
                ooo_date = ` _through ${date.toString('MMM. d')}_`;
            }

            ooo.push(e.name + (ooo_date || ''));
        } else if (e.type == 'holiday') {
            ooo.push(`*${e.name}*`);
        }
    });

    if (ooo.length === 1) {
        ooo.push('_Everyone will be in the office._');
    }

    return ooo.join('\n');
}

module.exports = async (app) => {
    // Check for BambooHR configuration in environment variables
    if (!process.env.BAMBOO_TOKEN || !process.env.BAMBOO_SUBDOMAIN) {
        console.log('BambooHR configuration missing, OOO plugin disabled');
        return;
    }

    const bamboo = new BambooHR({
        apikey: process.env.BAMBOO_TOKEN,
        subdomain: process.env.BAMBOO_SUBDOMAIN
    });

    // Handle OOO queries
    const oooRegex = /(0|O){3}(.*)[?]$/i;

    async function handleOOOQuery({ message, context, say }) {
        let start, end;

        // Parse date from message if provided
        if (!context?.matches?.[2]) {
            start = end = Date.today().toString('yyyy-MM-dd');
        } else {
            const dateParam = context.matches[2].trim();
            const result = Date.parse(dateParam);
            if (!result) return; // Invalid date parameter
            start = end = result.toString('yyyy-MM-dd');
        }

        try {
            const employees = await bamboo.getWhosOut({ start, end });
            await say({
                text: buildOOOMessage(employees, Date.parse(start)),
                thread_ts: message.thread_ts || message.ts
            });
        } catch (err) {
            await say({
                text: "Sorry, I couldn't fetch the out-of-office information. Please try again later.",
                thread_ts: message.thread_ts || message.ts
            });
        }
    }

    // Listen for OOO queries in messages
    app.message(oooRegex, async (args) => {
        await handleOOOQuery(args);
    });

    // Listen for OOO queries in mentions
    app.event('app_mention', async ({ event, say }) => {
        const text = event.text.replace(/<@[^>]+>\s*/, '').trim();
        const matches = text.match(oooRegex);
        if (matches) {
            await handleOOOQuery({
                message: event,
                context: { matches },
                say
            });
        }
    });
};