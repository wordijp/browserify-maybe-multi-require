'use strict';

var chokidar = require('chokidar');
var path = require('path');

var DelayRunner = require('./internal/delay-runner');
var DELAY = 100;

// watchify plugin

module.exports = watchAdditional;

//////////////////////////////////////////////////////////////////////////////

function watchAdditional(browserify, options) {
	var pending = false;
	var updating = false;

	var cache_target_paths = {};

	browserify.on('bundle', function(bundle) {
		updating = true;

		if (checkWatchify(browserify)) {
			watchFile(toFullPaths([].concat(options.files).concat(options.getFiles())));
		}

        bundle.on('error', onend);
        bundle.on('end', onend);
        function onend () {
			if (checkWatchify(browserify)) {
				var target_paths = Object.keys(browserify.pipeline.get('deps')._streams[0].visited);

				unwatch(target_paths);
				target_paths.forEach(function (path) {
					cache_target_paths[path] = true;
				});
			}

			updating = false;
		}
	});


	var w = null;
	var runner = null;

	function watchFile(paths) {
		if (w) w.close();

		// TODO : support ignored

		w = chokidar.watch(paths);
		w.setMaxListeners(0);
		w.on('error', browserify.emit.bind(browserify, 'error'));
		w.on('change', function (file) {
			invalidate(file);
		});

		runner = new DelayRunner(DELAY);
	}

	function invalidate(id) {
		var prev_cached = !!cache_target_paths[id];

		if (!updating && cache_target_paths[id]) {
			// remove expired path
			delete cache_target_paths[id];
		}

		if (!prev_cached) {
			// wait for the disk/editor to quiet down first:
			if (pending) clearTimeout(pending);
			pending = setTimeout(notify, DELAY);
		}
	}

	function notify() {
		if (updating) {
			pending = setTimeout(notify, DELAY);
		} else {
			pending = false;
			browserify.emit('update');
		}
	}

	function unwatch(paths) {
		// NOTE : do not work w.unwatch, if after immediate add.
		//        make a delay so
		runner.run(function () { w.unwatch(paths); });
	}

	function checkWatchify(browserify) {
		// XXX : _watcher is private field. judgement using watchify is not appropriate.
		//       but only this one :(
		return !!browserify._watcher;
	}
}

//////////////////////////////////////////////////////////////////////////////

function toFullPaths(paths) {
	return paths.map(function (_path) {
		return path.resolve(_path);
	});
}
