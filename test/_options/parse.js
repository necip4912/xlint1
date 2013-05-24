'use strict';

var isCopy   = require('es5-ext/lib/Object/is-copy')
  , resolve  = require('path').resolve
  , readFile = require('fs').readFile
//  , inspect  = require('util').inspect

  , testFile = resolve(__dirname, 'parse.txt');

module.exports = function (t, a, d) {
	readFile(testFile, function (err, data) {
		var result, mod1, mod2, mod3, copy;
		if (err) {
			d(err);
			return;
		}
		result = t(data, resolve('/one/two'));
		mod1 = [{ action: 'add', value: ['bar', 'foo'] }];
		mod2 = [{ action: 'remove', value: ['mala', 'morda'] }];
		mod3 = [{ action: 'remove', value: ['raz', 'dwa', 'one'].sort() }];
		mod1.mod = mod2.mod = mod3.mod = true;

		copy = { root: true };
		copy[resolve('/one/two')] = {
			adsafe: false,
			bitwise: true,
			devel: true,
			debug: false,
			predef: ['two'],
			eqeq: true
		};
		copy[resolve('/one/two/morda')] = {
			adsafe: false,
			devel: true,
			eqeq: true,
			predef: mod3
		};
		copy[resolve('/one/two/foo/bar')] = {
			browser: false,
			cap: true,
			predef: mod1
		};
		copy[resolve('/one/two/marko-zagalo.js')] = {
			predef: mod2
		};
		copy[resolve('/one/two/testo-fanfaro.js')] = {
			predef: mod2
		};

		// console.log("GOT", inspect(result, false, Infinity));
		// console.log("EXPECTED", inspect(copy, false, Infinity));
		a(isCopy(result, copy, Infinity), true);
		d();
	});
};
