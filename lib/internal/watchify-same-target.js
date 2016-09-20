
module.exports = WatchifySameTarget;

/**
 * sync watchify same target
 */
var WatchifySameTarget = function (browserify) {
	this.sync_paths = {};
	
	// TODO : ignoreWatch support
	
	browserify.on('file', function (file) {
	});
	
    browserify.on('transform', function (tr, mfile) {
        tr.on('file', function (dep) {
        });
    });
	
	browserify.on('bundle', function (bundle) {

	});
	
	function watchFile(file, dep) {
		dep = dep || file;

	}
};

