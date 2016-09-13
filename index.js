'use strict';

var path = require('path');
var utils = require('./utils');
var _  = require('lodash-node');
var dotAccess = require('dot-access');
var globule = require('globule');

var _workdir = process.cwd();

module.exports = browserifyMaybeMultiRequire;
module.exports.workdir = function(workdir) {
	_workdir = workdir || _workdir;
	return workdir && browserifyMaybeMultiRequire || _workdir;
};

var astRequireParser = require('./ast-parser').astRequireParser;
var fs = require('fs');

function _getRequiresFromFiles(files) {
	var requires = [];
	for (var i = 0; i < files.length; i++) {
		var data = fs.readFileSync(files[i]);
		astRequireParser(data, function(require) {
			requires.push(require);
		});
	}
	return _.uniq(requires);
};

function _getAlias(rawname) {
	var str = rawname.split(':');
	return str[1] || str[0];
}

var watchAdditional = require('./lib/watch-additional');


//////////////////////////////////////////////////////////////////////////////

function browserifyMaybeMultiRequire(browserify, options) {
	if (options.workdir) _workdir = workdir;
	if (options.conf) {
		var confjson = require(path.join(_workdir, options.conf));
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


	watchAdditional(browserify, options);

	if (!options.noreset) browserify.on('reset', exec);

	function exec() {
		// NOTE : priority
		//        weak < require '*' < external '*' < require direct < external direct < strong
		//
		// ex)
		//   // app.js
		//   var $          = require('jquery');
		//   var _          = require('underscore');
		//   var Enumerable = require('linq');
		// usage1)
		//   options = {
		//     require: ['*', 'jquery']
		//     external: ['*']
		//   };
		//   -->
		//   // require '*' denied by external '*'
		//   browserify.require('jquery');
		//   browserify.external('underscore');
		//   browserify.external('linq');
		//
		// usage2)
		//   options = {
		//     require: ['*']
		//     external: ['underscore']
		//   };
		//   -->
		//   browserify.require('jquery');
		//   browserify.require('linq');
		//   browserify.external('underscore');

		var files = globule.find(options.files).concat(options.getFiles());
		var requires = _getRequiresFromFiles(files);

		var bowers = utils.componentNames(_workdir);


		var all_require = _(options.require).contains('*');
		var all_external = _(options.external).contains('*');
		var require_alias = _(options.require).map(function(rawname) {
			return _getAlias(rawname);
		});
		var external_alias = _(options.external).map(function(rawname) {
			return _getAlias(rawname);
		});

		_(options).forEach(function(config, action) {
			if (_(['require']).contains(action)) {
				var workinglist = _(options.require)
					// require '*' deny by external '*'
					.filter(function(name) {
						return (name === '*' && all_external) ? false : true;
					})
					// process '*' including
					.map(function(name) {
						return (name === '*') ? utils.componentNames(_workdir) : name;
					})
					.flatten()
					// filter out external names
					.filter(function(name) {
						return !_(external_alias).contains(_getAlias(name));
					})
					.uniq(function(rawname) { return _getAlias(rawname); })
					// prepare the working list
					.map(function(rawname) {
						var name_or_path = rawname.split(':')[0],
							alias = _getAlias(rawname);
						var rootname = name_or_path.split('/')[0];
						var bower_found = _(bowers).contains(rootname);
						var file_found = bower_found ? false : fs.existsSync(path.join(_workdir, name_or_path));
						return {
							name:  name_or_path,
							alias: alias,
							path: bower_found ? utils.resolve(name_or_path, _workdir)
								: file_found ? path.join(_workdir, name_or_path)
								: undefined
						};
					})

				///
				requires.forEach(function(require) {
					if (_(options.ignore).contains(require)) return;

					var item = workinglist.find(function(x) { return x.alias === require; });
					if (item) {
						if (item.path) tryRequire(browserify, item.path, { expose: item.alias });
						else           tryRequire(browserify, item.name, { expose: item.alias });
					} else if (all_require && !all_external && !_(external_alias).contains(require)) {
						var is_module = require.match(/^(\.){0,2}\//) ? false : true;
						if (is_module) {
							tryRequire(browserify, require);
						}
					}
				});
			}
			if (_(['external']).contains(action)) {
				requires.forEach(function(require) {
					if (_(options.ignore).contains(require)) return;

					if (_(external_alias).contains(require)) {
						tryExternal(browserify, require);
					} else if (all_external && !_(require_alias).contains(require)) {
						var is_module = require.match(/^(\.){0,2}\//) ? false : true;
						if (is_module) {
							tryExternal(browserify, require);
						}
					}
				});
			}
		});
	}
	exec();
};

var cache_requires = {};
function tryRequire(b, file, opts) {
	if (!cache_requires[file]) {
		b.require(file, opts);
		cache_requires[file] = true;
	}
}

var cache_externals = {};
function tryExternal(b, file) {
	if (!cache_externals[file]) {
		b.external(file);
		cache_externals[file] = true;
	}
}
