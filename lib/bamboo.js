const request = require('request');

/**
 * @param {object} params
 * @constructor
 */

function BambooHR(params) {
	this.apikey = params.apikey;
	this.subdomain = params.subdomain;

	assert(params.apikey, 'apikey must be defined');
	assert(params.subdomain, 'Subdomain must be defined');
}

/**
 * Get groups
 * @returns {vow.Promise}
 */
BambooHR.prototype.getWhosOut = function(params, callback) {
	return this._api('/v1/time_off/whos_out/?start=' + encodeURIComponent(params.start) + '&end=' + encodeURIComponent(params.end), callback);
};

/**
 * Send request to API method
 * @param {string} path
 * @param {function} callback
 * @returns callback
 * @private
 */
BambooHR.prototype._api = function(path, callback) {

	var data = {
		url: 'https://' + this.apikey + ':x@api.bamboohr.com/api/gateway.php/' + this.subdomain + path,
		headers: {
			Accept: 'application/json'
		}
	};

	request.get(data, function(err, response, body) {
		if (!err && response.statusCode == 200) {
			return callback(null, JSON.parse(body));
		} else {
			return callback(err);
		}
	});
};

function assert(condition, error) {
	if (!condition) {
		throw new Error('[OOO Error] ' + error);
	}
}

module.exports = BambooHR;
