'use strict';

var mdeps = require('module-deps');
var path = require('path');
var globule = require('globule');

module.exports = {
	collectRequirePaths: collectRequirePaths,
	toFullPaths: toFullPaths,
};

function collectRequirePaths(browserify, paths, cb) {
	var deps = mdeps({
		// NOTE : skip error by non package components
		ignoreMissing: true,
		// NOTE : speed up from the second time
		cache: browserify._options.cache,
		pkgCache: browserify._options.packageCache,
	});
	deps.on('end', function () {
		cb(Object.keys(this.visited));
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
