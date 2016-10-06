'use strict';

var chokidar = require('chokidar');
var _ = require('lodash-node');
var through = require('through2');

var DelayRunner = require('./internal/delay-runner');
var DELAY = 100;

var mutils = require('./internal/module-utils');
var putils = require('./internal/path-utils');

// watchify plugin

module.exports = watchAdditional;

//////////////////////////////////////////////////////////////////////////////

// additional watch file, other than watchify

function watchAdditional(browserify, options) {
	var changingDeps = {};
	var pending = false;
	var updating = false;

	// watchify and sharing
	var sharedCache = browserify._options.cache;
	var sharedPkgcache = browserify._options.packageCache;

	var cache_target_paths = {};
	var mcached = new mutils.Cached(browserify);

	// watchfiles in watchify
	var watchify_on_files = {};
	browserify.on('bundle', function () {
		watchify_on_files = {};
	});
	browserify.on('file', function (file) {
		// NOTE : collect watch files of watchify
		watchify_on_files[file] = true;
	});

	browserify.on('bundle', function(bundle) {
		updating = true;

		var watched = false,
			ended = false;

		// NOTE : wait until browserify._recorded is update, for when used with the default options.
		var stream = through.obj(
			function transform(row, enc, next) { this.push(row); next(); }, // no-op
			function flush(done) {
				if (checkWatchify(browserify)) {
					var full_paths = mutils.toResolvePaths([].concat(options.files).concat(options.getFiles()));

					// add require target files
					mcached.collectRequirePaths(full_paths, function (collect_file_sources) {
						var collect_full_paths = Object.keys(collect_file_sources);
						// NOTE : keep wildcard path
						watchFile(_.uniq(full_paths.concat(collect_full_paths)));

						watched = true;
						oncomplete();
					});
				} else {
					watched = true;
				}
				done();
			});
		browserify.pipeline.get('record').push(stream);

		bundle.on('error', onend);
		bundle.on('end', onend);
		function onend () {
			ended = true;
			oncomplete();
		}

		function oncomplete () {
			if (!watched || !ended) return;

			if (checkWatchify(browserify)) {
				// unwatch the duplicated files from watchify
				var target_paths = _.uniq(
					Object.keys(browserify.pipeline.get('deps')._streams[0].visited)
						.concat(Object.keys(watchify_on_files)));

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
		changingDeps[id] = true;

		var emit = true;
		emit = emit && !cache_target_paths[id];
		emit = emit && _.every(watchify_on_files, function (dummy, file) { return !putils.isEqualPath(id, file); });

		if (!updating && cache_target_paths[id]) {
			// remove expired path
			delete cache_target_paths[id];
		}

		if (emit) {
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
			browserify.emit('update', Object.keys(changingDeps));
			changingDeps = {};
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

