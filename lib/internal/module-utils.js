'use strict';

var mdeps = require('module-deps');
var path = require('path');
var resolve = require('resolve');
var globule = require('globule');
var xtend = require('xtend');
var through = require('through2');

var _ = require('lodash-node');

var putils = require('./path-utils');

module.exports = {
	Cached: Cached,
	toResolvePaths: toResolvePaths,
};

// cached class

function Cached(browserify) {
    if (!(this instanceof Cached)) throw new Error('no new');

	this._collect_cache = {};
	this._browserify = browserify;

	browserify.on('update', this._onUpdateCollectCache.bind(this));
}

Cached.prototype.collectRequirePaths = function(paths, cb) {
	var self = this;

	// merge this function's cache
	function mergeIfNeed(rtarget, o) {
		for (var key in o) {
			if (!rtarget[key]) {
				rtarget[key] = o[key];
			}
		}
		return rtarget;
	}
	var merged_cache = mergeIfNeed(_.clone(self._browserify._options.cache), self._collect_cache);

	var deps = mdeps({
		// NOTE : skip error by non package components
		ignoreMissing: true,
		// NOTE : speed up from the second time
		cache: merged_cache,
		pkgCache: self._browserify._options.packageCache,
		postFilter: self._browserify._options.postFilter,
		filter: self._browserify._options.filter,
		// transform plugin path in package.json
		transformKey: self._browserify.pipeline.get('deps')._streams[0].options.transformKey,
		// transform plugin from argv
		globalTransform: self._browserify._transforms
			.filter(function (tr) {
				return tr.transform && tr.global;
			})
			.map(function (tr) {
				return [tr.transform, tr.options];
			}),
		transform: self._browserify._transforms
			.filter(function (tr) {
				return tr.transform && !tr.global;
			})
			.map(function (tr) {
				return [tr.transform, tr.options];
			}),
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
			var file = row.expose ? self._browserify._expose[row.id] : row.file;
			file = path.resolve(file); // unify path separator
			if (new_read_files[file]) {
				self._collect_cache[file] = {
					source: row.source,
					deps: xtend(row.deps),
				};
			}
			this.push(null, row);
			next();
		},
		function flush(done) {
			var visited_file_sources = {};
			for (var file in deps.visited) {
				visited_file_sources[file] = self._collect_cache[file] && self._collect_cache[file].source || '';
			}
			cb(visited_file_sources);
			done();
		}));
	deps.end();
}

Cached.prototype._onUpdateCollectCache = function (files) {
	var self = this;
	files.forEach(function (file) {
		for (var key in self._collect_cache) {
			if (putils.isEqualPath(key, file)) {
				delete self._collect_cache[key];
				break;
			}
		}
	});
};

//////////////////////////////////////////////////////////////////////////////

function toResolvePaths(paths) {
	return paths.map(function (_path) {
		if (_path.indexOf('*') >= 0) return path.resolve(_path); // wildcard path
		return resolve.sync(path.resolve(_path));                // maybe resolve of main path in package.json
	});
}
