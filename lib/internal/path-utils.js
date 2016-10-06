'use strict';

module.exports = {
	isEqualPath: isEqualPath,
};

function isEqualPath(path1, path2) {
	var re = new RegExp(/\\/, 'g');
	return path1.toLowerCase().replace(re, '/') === path2.toLowerCase().replace(re, '/');
}
