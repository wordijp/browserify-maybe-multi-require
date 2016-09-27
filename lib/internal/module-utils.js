'use strict';

var mdeps = require('module-deps');
var path = require('path');
var globule = require('globule');
var xtend = require('xtend');
var through = require('through2');

module.exports = {
	collectRequirePaths: collectRequirePaths,
	toFullPaths: toFullPaths,
};


var _collect_cache = {};
function collectRequirePaths(browserify, paths, cb) {
	// regist update cache event
	browserify.removeListener('update', _onUpdateCollectCache);
	browserify.on('update', _onUpdateCollectCache);

	///

    var sharedCache = browserify._options.cache;

	// merge this function's cache
	var merged_keys = _mergeIfNeed(sharedCache, _collect_cache);

	var deps = mdeps({
		// NOTE : skip error by non package components
		ignoreMissing: true,
		// NOTE : speed up from the second time
		cache: sharedCache,
		pkgCache: browserify._options.packageCache,
		postFilter: browserify._options.postFilter,
		filter: browserify._options.filter,
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

	var new_read_files = {};
	deps.on('file', function (file) {
		new_read_files[file] = true;
	});

	deps.pipe(through.obj(
		function transform(row, enc, next) {
            var file = row.expose ? browserify._expose[row.id] : row.file;
			file = path.resolve(file); // unify path separator
			if (new_read_files[file]) {
				_collect_cache[file] = {
					source: row.source,
					deps: xtend(row.deps),
				};
			}
			this.push(null, row);
			next();
		},
		function flush(done) {
			// remove this function's cache
			_removeKeys(sharedCache, merged_keys);
			cb(Object.keys(deps.visited));
			done();
		}));
	deps.end();
}
function _mergeIfNeed(rtarget, o) {
	var merged_keys = {};
	for (var key in o) {
		if (!rtarget[key]) {
			merged_keys[key] = true;
			rtarget[key] = o[key];
		}
	}
	return merged_keys;
}
function _removeKeys(rtarget, keys) {
	for (var key in keys) delete rtarget[key];
}
function _onUpdateCollectCache(files) {
	files.forEach(function (file) {
		delete _collect_cache[file];
	});
}


function toFullPaths(paths) {
	return paths.map(function (_path) {
		return path.resolve(_path);
	});
}
