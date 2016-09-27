'use strict';

var _  = require('lodash-node');
var dotAccess = require('dot-access');
var path = require('path');
var through = require('through2');
var fs = require('fs');

module.exports = flexiRequire;

var astRequireParser = require('./internal/ast-parser').astRequireParser;
var butils = require('./internal/bower-utils');
var mutils = require('./internal/module-utils');
var g = require('./internal/global');


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


//////////////////////////////////////////////////////////////////////////////

function flexiRequire(browserify, options) {
	hookFilter(browserify, options);

	browserify._bpack.hasExports = true; // NOTE : need require from other bundle file

	if (!options.noreset) browserify.on('reset', reset);
	reset();

	function reset() {
		var stream = through.obj(
			function transform(row, enc, next) {
				this.push(row);
				next();
			},
			function flush(done) {
				var self = this;
				collectModules(browserify, options,
					function (new_requires) {
						for (var key in new_requires) {
							self.push(new_requires[key]);
						}
						self.push(null);
						done();
					});
			});
		browserify.pipeline.get('record').push(stream);
	}

	return browserify;
};


function hookFilter(browserify, options) {
	// make custom filter function
	var all_external = _(options.external).contains('*');
	var require_alias = _(options.require).map(function(rawname) {
		return _getAlias(rawname);
	});
	var external_alias = _(options.external).map(function(rawname) {
		return _getAlias(rawname);
	});
	function filter(id) {
		return _(options).every(function(config, action) {
			if (_(['external']).contains(action)) {
				if (_(options.ignore).contains(id)) return true;

				if (_(external_alias).contains(id)) {
					return false;
				} else if (all_external && !_(require_alias).contains(id)) {
					if (isExternalModule(id)) {
						return false;
					}
				}
			}

			return true;
		});
	}

	// hook custom function
	var orig_postFilter = browserify._options.postFilter || undefined;
	var hook_postFilter = function(id, file, pkg) {
		if (!filter(id)) return false;
		if (orig_postFilter && !orig_postFilter(id, file, pkg)) return false;

		return true;
	};
	browserify._options.postFilter = hook_postFilter;

	var orig_filter = browserify._options.filter || undefined;
	var hook_filter = function(id) {
		if (!filter(id)) return false;
		if (orig_filter && !orig_filter(id)) return false;

		return true;
	};
	browserify._options.filter = hook_filter;
}


function collectModules(browserify, options, cb) {
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

	var full_paths = mutils.toFullPaths([].concat(options.files).concat(options.getFiles()));

	mutils.collectRequirePaths(browserify, full_paths, function (files) {
		var ret_requires = {};

		var requires = _getRequiresFromFiles(files);
		var bowers = butils.componentNames(g.workdir);

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
						return (name === '*') ? butils.componentNames(g.workdir) : name;
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
						var file_found = bower_found ? false : fs.existsSync(path.join(g.workdir, name_or_path));
						return {
							name:  name_or_path,
							alias: alias,
							path: bower_found ? butils.resolve(name_or_path, g.workdir)
								: file_found ? path.join(g.workdir, name_or_path)
								: undefined
						};
					})

				///
				requires.forEach(function(require) {
					if (_(options.ignore).contains(require)) return;

					var item = workinglist.find(function(x) { return x.alias === require; });
					if (item) {
						if (item.path) addRequire(ret_requires, item.path, item.alias);
						else           addRequire(ret_requires, item.name, item.alias);
					} else if (all_require && !all_external && !_(external_alias).contains(require)) {
						var is_module = require.match(/^(\.){0,2}\//) ? false : true;
						if (is_module) {
							addRequire(ret_requires, require);
						}
					}
				});
			}
		});

		cb(ret_requires);
	});
}

function addRequire(rrequires, file, expose) {
	// see) browserify.require()
	var row;
	if (isExternalModule(file)) {
		// external module or builtin
		row = { id: expose || file, file: file };
	} else {
		row = { file: path.resolve(g.workdir, file) };
	}

	if (!row.id) {
		row.id = expose || row.file;
	}

	//if (expose || !row.entry) {
	// always true. (because, entry is false)
	row.expose = row.id;
	//}
	row.entry = false;

	rrequires[file] = row;
}

function isExternalModule (file) {
	var regexp = process.platform === 'win32' ?
		/^(\.|\w:)/ :
		/^[\/.]/;
	return !regexp.test(file);
}

