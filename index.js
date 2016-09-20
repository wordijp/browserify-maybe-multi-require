'use strict';

var path = require('path');
var mdeps = require('module-deps');
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

var through = require('through2');

//////////////////////////////////////////////////////////////////////////////

function browserifyMaybeMultiRequire(browserify, options) {
	options = adjustOptions(options);

	browserify.plugin(watchAdditional, options);

	var externals = {};
	hookFilter(browserify, externals);

	browserify._bpack.hasExports = true; // NOTE : need require from other bundle file

	if (!options.noreset) browserify.on('reset', exec);
	exec();

	function exec() {
		var stream = through.obj(
			function transform(row, enc, next) {
				this.push(row);
				next();
			},
			function flush(done) {
				var self = this;
				collectModules(options,
					function (new_requires, new_externals) {
						// replace externals
						for (var key in externals) delete externals[key];
						for (var key in new_externals) externals[key] = new_externals[key];

						for (var key in new_requires) {
							self.push(new_requires[key]);
						}
						self.push(null);
						done();
					});
			});
		browserify.pipeline.get('record').push(stream);


	}
};

function adjustOptions(_options) {
	var options = _.clone(_options);

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

	return options;
}

function hookFilter(browserify, rexternals) {
	var orig_postFilter = browserify._options.postFilter || undefined;
	var hook_postFilter = function(id, file, pkg) {
		if (rexternals[id]) return false;
		if (orig_postFilter && !orig_postFilter(id, file, pkg)) return false;

		return true;
	};
	browserify._options.postFilter = hook_postFilter;

	var orig_filter = browserify._options.filter || undefined;
	var hook_filter = function(id) {
		if (rexternals[id]) return false;
		if (orig_filter && !orig_filter(id)) return false;

		return true;
	};
	browserify._options.filter = hook_filter;
}


function collectModules(options, cb) {
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

	var full_paths = toFullPaths(globule.find(options.files).concat(options.getFiles()));

	collectRequirePaths(full_paths, function (files) {
		var ret_requires = {};
		var ret_externals = {};

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
			if (_(['external']).contains(action)) {
				requires.forEach(function(require) {
					if (_(options.ignore).contains(require)) return;

					if (_(external_alias).contains(require)) {
						addExternal(ret_externals, require);
					} else if (all_external && !_(require_alias).contains(require)) {
						// TODO : modified. using to isExternalModule
						var is_module = require.match(/^(\.){0,2}\//) ? false : true;
						if (is_module) {
							addExternal(ret_externals, require);
						}
					}
				});
			}
		});

		cb(ret_requires, ret_externals);
	});
}

function addRequire(rrequires, file, expose) {
	// see) browserify.require()
	var row;
    if (isExternalModule(file)) {
        // external module or builtin
        row = { id: expose || file, file: file };
    }
    else {
        row = { file: path.resolve(_workdir, file) };
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

function addExternal(rexternals, file) {
	rexternals[file] = true;
}

function isExternalModule (file) {
    var regexp = process.platform === 'win32' ?
        /^(\.|\w:)/ :
        /^[\/.]/;
    return !regexp.test(file);
}


// TODO : move lib file
function collectRequirePaths(paths, cb) {
	var deps_full_paths = [];
	var deps = mdeps();
	deps.on('file', function (file, id) {
		deps_full_paths.push(file);
	});
	deps.on('transform', (tr, mfile) => {
		tr.on('file', (dep) => {
			deps_full_paths.push(mfile);
		});
	});
	deps.on('end', function () {
		cb(deps_full_paths);
	});
	deps.on('data', function () {
		// no-op NOTE : need for emit 'end' event
	});

	globule.find(paths)
		// unnecessary
//		// to unify the difference of path, and to full path
//		// windows) globule.find path : 'C:/path/to/foo.js' or 'path/to/foo.js'
//		//          path.resolve path : 'C:\\path\\to\\foo.js'
//		.map(function (_path) {
//			return path.resolve(_path);
//		})
		.forEach(function (full_path) {
			deps.write(full_path);
		});
	deps.end();
}

function toFullPaths(paths) {
	return paths.map(function (_path) {
		return path.resolve(_path);
	});
}
