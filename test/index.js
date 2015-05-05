var expect = require('chai').expect,
    browserify = require('browserify'),
    vm = require('vm'),
    path = require('path'),
    maybeRequire = require('..')

describe('browserify-bower', function() {

  it('should be able to browserify-maybe-multi-require using to my_modules/sayhello.js', function(done) {
    var jsPath = path.join(__dirname, 'src/index.js');
    var b = browserify();
    b.plugin(maybeRequire.workdir(__dirname), {
      require: ['./my_modules/sayhello.js:say_hello'],
      getFiles: function() { return [jsPath]; }
	});
    b.add(jsPath);
    b.bundle(function (err, src) {
      if (err) return done(err);
      vm.runInNewContext(src, {
        console: {
          log: function (msg) {
            expect(msg).to.equal('hello, wordijp');
            done();
          }
        }
      });
    });
  });
});
