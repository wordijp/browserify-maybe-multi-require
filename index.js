'use strict';

var _  = require('lodash-node');
var path = require('path');

var g = require('./lib/internal/global');
g.workdir = process.cwd();

module.exports = main;
module.exports.workdir = function(workdir) {
	g.workdir = workdir || g.workdir;
	return workdir && browserifyMaybeMultiRequire || g.workdir;
};

var watchAdditional = require('./lib/watch-additional');
var maybeMultiRequire = require('./lib/maybe-multi-require');


//////////////////////////////////////////////////////////////////////////////

function main(browserify, options) {
	options = adjustOptions(options);
	
	return browserify
		.plugin(watchAdditional, options)
		.plugin(maybeMultiRequire, options);
}

function adjustOptions(_options) {
	var options = _.clone(_options);

	if (options.workdir) g.workdir = workdir;
	if (options.conf) {
		var confjson = require(path.join(g.workdir, options.conf));
		options = options.confnode && dotAccess.get(confjson, options.confnode) || confjson;
	}

	// to array
	options.files = [].concat(options.files).filter(Boolean);
	var _getFiles = options.getFiles || function() { return [] };
	options.getFiles = function() {
		return [].concat(_getFiles()).filter(Boolean);
	};
	options.require = [].concat(options.require).filter(Boolean);
	options.external = [].concat(options.external).filter(Boolean);
	options.ignore = [].concat(options.ignore).filter(Boolean);

	return options;
}

