'use strict';

var mdeps = require('module-deps');
var path = require('path');
var globule = require('globule');

module.exports = {
	collectRequirePaths: collectRequirePaths,
	toFullPaths: toFullPaths,
};

function collectRequirePaths(paths, cb) {
	var deps_full_paths = [];
	var deps = mdeps({ ignoreMissing: true });
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
