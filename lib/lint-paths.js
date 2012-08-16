'use strict';

var map           = Array.prototype.map
  , commonLeft    = require('es5-ext/lib/Array/prototype/common-left')
  , remove        = require('es5-ext/lib/Array/prototype/remove')
  , uniq          = require('es5-ext/lib/Array/prototype/uniq')
  , invoke        = require('es5-ext/lib/Function/invoke')
  , getNull       = require('es5-ext/lib/Function/k')(null)
  , isCallable    = require('es5-ext/lib/Object/is-callable')
  , forEach       = require('es5-ext/lib/Object/for-each')
  , startsWith    = require('es5-ext/lib/String/prototype/starts-with')
  , deferred      = require('deferred')
  , eePipe        = require('event-emitter').pipe
  , resolve       = require('path').resolve
  , stat          = deferred.promisify(require('fs').stat)
  , sep           = require('next/lib/path/sep')
  , normalizeOpts = require('./_options/normalize')
  , lintDirectory = require('./lint-directory').lintDirectory
  , lintFile      = require('./lint-file').lintFile
  , lintPath      = require('./lint-file').lintPath

  , lintPaths;

lintPaths = function (paths, options) {
	var promise, linters;
	paths = uniq.call(paths);
	if (paths.length === 1) {
		return lintPath(paths[0], options);
	}

	promise = deferred.map(paths, function (path) {
		return stat(path)(function (stats) {
			if (stats.isFile()) {
				return 'file';
			}
			if (stats.isDirectory()) {
				return 'directory';
			}
			return new TypeError("'" + path + "' is neither file nor directory");
		});
	})(function (stats) {
		var index, root, result, events, watch, progress;

		watch = options.watch;
		progress = options.progress;

		if (watch && !linters) {
			return {};
		}

		// Ignore subdirectories of directories (if any)
		paths.filter(function (path, index) {
			return stats[index] === 'directory';
		}).sort(function (a, b) {
			return a.length - b.length;
		}).forEach(function (path, index, self) {
			for (var i = index + 1, sub; sub = self[i]; ++i) {
				if (startsWith.call(sub, path + sep)) {
					index = paths.indexOf(sub);
					stats.splice(index, 1);
					paths.splice(index, 1);
					self.splice(i--, 1);
				}
			}
		});
		if (paths.length === 1) {
			result = lintDirectory(paths[0], options);
			if (watch || progress) {
				eePipe(result, promise);
				promise.close = result.close;
			}
			return result;
		}

		index = commonLeft.apply(paths[0], paths.slice(1));
		if (index) {
			root = paths[0].slice(0, index - 1);
		}

		result = {};
		return deferred.map(paths, function (path, index) {
			var lint, name, names, ignores;
			name = root ? path.slice(root.length + 1) : path;
			if (stats[index] === 'file') {
				lint = lintFile(path, options);
				if (watch) {
					lint.on('change', function (report) {
						result[name] = report;
						promise.emit('change',
							{ type: 'update', name: name, report: report });
					});
					lint.on('end', function () {
						delete result[name];
						if (watch) remove.call(linters, lint);
						promise.emit('change', { type: 'remove', name: name });
					});
				}
				lint(function (report) {
					if (result[name]) {
						// Duplicate or closed
						lint.close();
						return;
					}
					result[name] = report;
					if (progress) {
						promise.emit('change', { type: 'add', name: name, report: report });
					}
				}, watch ? function () { remove.call(linters, lint) } : getNull);
			} else {
				names = [], ignores = {};
				lint = lintDirectory(path, options);
				if (watch || progress) {
					lint.on('change', function (event) {
						var subname = name + sep + event.name, data;
						if (ignores[subname]) {
							return;
						}
						if (progress && !promise.resolved) {
							if (result[subname]) {
								// Duplicate
								ignores[subname] = true;
								return;
							}
							names.push(subname);
						}
						result[subname] = event.report;
						data = { type: event.type, name: subname };
						if (event.report) data.report = event.report;
						promise.emit('change', data);
					});
					if (watch) {
						lint.on('end', function (event) {
							if (watch) remove.call(linters, lint);
							names.forEach(function (name) {
								delete result[name];
								promise.emit('change', { type: 'remove', name: name });
							});
						});
					}
				}
				lint(function (data) {
					if (!progress) {
						forEach(data, function (report, subname) {
							subname = name + sep + subname;
							if (result[subname]) {
								// Duplicate
								ignores[subname] = true;
								return;
							}
							result[subname] = report;
							names.push(subname);
						});
					}
				}, function () {
					if (watch) remove.call(linters, lint);
					names.forEach(function (name) {
						delete result[name];
						promise.emit('change', { type: 'remove', name: name });
					});
				}, getNull);
			}
			if (watch) linters.push(lint);
			return lint;
		})(result);
	});

	if (options.watch) {
		linters = [];
		promise.close = function () {
			if (linters) {
				linters.forEach(invoke('close'));
				linters = null;
			}
		};
	}

	return promise;
};
lintPaths.returnsPromise = true;

module.exports = exports = function (paths/*, options, cb*/) {
	var options, cb;

	paths = map.call(paths, function (path) { return resolve(String(path)) });
	options = arguments[1];
	cb = arguments[2];
	if ((cb == null) && isCallable(options)) {
		cb = options;
		options = {};
	} else {
		options = Object(options);
		if (options.options) {
			options.options = normalizeOpts(options.options);
		}
	}

	return lintPaths(paths, options).cb(cb);
};
exports.returnsPromise = true;
exports.lintPaths = lintPaths;