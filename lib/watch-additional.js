'use strict';

var chokidar = require('chokidar');
var _ = require('lodash-node');

var DelayRunner = require('./internal/delay-runner');
var DELAY = 100;

var mutils = require('./internal/module-utils');

// watchify plugin

module.exports = watchAdditional;

//////////////////////////////////////////////////////////////////////////////

// additional watch file, other than watchify

function watchAdditional(browserify, options) {
	var pending = false;
	var updating = false;
	
	// watchify and sharing
    var sharedCache = browserify._options.cache;
    var sharedPkgcache = browserify._options.packageCache;

	var cache_target_paths = {};

	browserify.on('bundle', function(bundle) {
		updating = true;

		var watched = false,
			ended = false;

		if (checkWatchify(browserify)) {
			var full_paths = mutils.toFullPaths([].concat(options.files).concat(options.getFiles()));

			// add require target files
			mutils.collectRequirePaths(full_paths, function (collect_full_paths) {
				// NOTE : keep wildcard path
				watchFile(_.uniq(full_paths.concat(collect_full_paths)));

				watched = true;
				oncomplete();
			});
		} else {
			watched = true;
		}

        bundle.on('error', onend);
        bundle.on('end', onend);
        function onend () {
			ended = true;
			oncomplete();
		}

		function oncomplete () {
			if (!watched || !ended) return;

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
		if (sharedCache) delete sharedCache[id];
		if (sharedPkgcache) delete sharedPkgcache[id];

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
	
	return browserify;
}

//////////////////////////////////////////////////////////////////////////////


