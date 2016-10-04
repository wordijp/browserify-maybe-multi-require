'use strict';

var mdeps = require('module-deps');
var path = require('path');
var globule = require('globule');
var xtend = require('xtend');
var through = require('through2');

var _ = require('lodash-node');

module.exports = {
	collectRequirePaths: collectRequirePaths,
	toFullPaths: toFullPaths,
};


var _collect_cache = {};
function collectRequirePaths(browserify, paths, cb) {
	// regist update cache event
	browserify
		.removeListener('update', _onUpdateCollectCache)
		.on('update', _onUpdateCollectCache);

	///

	// merge this function's cache
	var merged_cache = _mergeIfNeed(_.clone(browserify._options.cache), _collect_cache);

	var deps = mdeps({
		// NOTE : skip error by non package components
		ignoreMissing: true,
		// NOTE : speed up from the second time
		cache: merged_cache,
		pkgCache: browserify._options.packageCache,
		postFilter: browserify._options.postFilter,
		filter: browserify._options.filter,
		// transform path in package.json
		transformKey: browserify.pipeline.get('deps')._streams[0].options.transformKey,
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
			var visited_file_sources = {};
			for (var file in deps.visited) visited_file_sources[file] = _collect_cache[file].source;
			cb(visited_file_sources);
			done();
		}));
	deps.end();
}
function _mergeIfNeed(rtarget, o) {
	for (var key in o) {
		if (!rtarget[key]) {
			rtarget[key] = o[key];
		}
	}
	return rtarget;
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
