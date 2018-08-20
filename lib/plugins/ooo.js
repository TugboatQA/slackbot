
require('datejs');
const controller = require('../controller');
const slackbot = require('../slackbot'); //Bot
const bamboohr = require('../bamboo');
const config = require('../../config');

var bamboo = new bamboohr({
	apikey: config.bamboo_token,
	subdomain: config.bamboo_subdomain
});

if (config.bamboo_token && config.bamboo_subdomain) {
  controller.hears("/(0{3,}|O{3,})(.*)[?]$/i", ['ambient', 'direct_message', 'direct_mention', 'mention'], WhosOut);
}

/**
 * Increment or decrement karma
 *
 * @param bot
 * @param message
 */
async function WhosOut(bot, message) {
  let end, today;

  let result = message.match[2].trim();
  let start = Date.parse(result[2]);

	if (start) {
    if (start < Date.today()) start = start.next().year();
    start = end = start.toString('yyyy-MM-dd');
	} else {
	  start = end = Date.today().toString('yyyy-MM-dd');
	}

	bamboo.getWhosOut({
	  start: start,
		end: end
	}, function(err, employees) {
	  slackbot.reply(_build_ooo(employees).join('\r\n'));
	});
}

// start param needs to be a date object
// Iterate through the time off requests and build/return the response array.
function _build_ooo(employees, start) {
	if (!start) {
		start = Date.today();
	}

  // Sort by name, alphabetically, because what Herchel wants, Herchel gets!
  // Herchel for President!
  employees.sort(sortOn("name"));

	var ooo = new Array();
	ooo.push('*OOO for ' + start.toString('dddd, MMM d yyyy') + '*');

	Object.keys(employees).forEach(function(key) {
		var e = employees[key];
		if (e.type == 'timeOff') {
			var ooo_date = null;
			if (e.end != start.toString('yyyy-MM-dd')) {
				var date = Date.parse(e.end);
				ooo_date = ' _until ' + date.toString('MMM. d') + '_';
			}

			if (!ooo_date) {
				ooo.push(e.name);
			} else {
				ooo.push(e.name + ooo_date);
			}
		} else if (e.type == 'holiday') {
			ooo.push('*' + e.name + '*');
		}
	});
	if (!ooo[1]) ooo.push('_Everyone will be in the office._');
	return ooo;
}

function sortOn(property){
  return function(a, b){
    if(a[property] < b[property]) {
      return -1;
    } else if(a[property] > b[property]) {
      return 1;
    } else {
      return 0;   
    }
  }
}