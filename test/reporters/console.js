'use strict';

var deferred = require('deferred');

module.exports = function (t, a) {
	var report = [{ message: 'Lorem ipsum', at: 1, line: 1 }], invoked;
	report.src = 'Lorem ipsum';
	report.options = {};
	t(deferred({ 'foo': report }), { log: function (str) {
		a(typeof str, 'string', "Log string");
		invoked = true;
	} }).end();
	a(invoked, true);
};
