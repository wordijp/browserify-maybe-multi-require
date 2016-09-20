'use strict';


var DelayRunner = function (ms_delay) {
	var startTime = Date.now();
	this._endTime = startTime + ms_delay;
	this._elapsed = false;
};

DelayRunner.prototype.run = function (fn) {
	// already elapsed
	if (this._elapsed) {
		fn();
		return;
	}

	// waiting for elapsed endTime
	var self = this;
	setTimeout(function () {
		self._elapsed = true;
		self.run(fn);
	}, this._endTime - Date.now());
}

module.exports = DelayRunner;
