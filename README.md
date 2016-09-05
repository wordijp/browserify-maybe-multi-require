browserify-maybe-multi-require
================

[![NPM](https://nodei.co/npm/browserify-maybe-multi-require.png)](https://nodei.co/npm/browserify-maybe-multi-require/)

Let `browserify-maybe-multi-require` plugin require bower and non package components for you when building bundles, then you can `require` them as normal node modules in application codes.  
You can also provide external config, to guide `browserify-maybe-multi-require` to external some bower and non package components, which is useful when when building multiple bundles.


# install

```
npm install browserify-maybe-multi-require
```

# usage
## Programmatic API

In your task runner like gulp, add this plugin to browserify:

```
b.plugin('browserify-maybe-multi-require', {
	files:  ['xxx.js'],
    require: ['*', './my_modules/mycomp1.js:mycomp1', 'comp2', 'base62/lib/base62'],
    external: ['comp3', 'comp4'],
	ignore: ['comp5']
});
```

Then, in js codes, you can require it like normal node module:

```
// in xxx.js
var mycomp1 = require('mycomp1');
var comp2 = require('comp2');
...
```

## Command Line

Use conf file,

```shell
$ browserify entry.js -d -p [browserify-maybe-multi-require --conf conf.json] > bundle.js
```

Use a node of the conf json,

```shell
$ browserify entry.js -d -p [browserify-maybe-multi-require --conf conf.json --confnode aa.bbb] > bundle.js
```

### workdir
By default, `browserify-maybe-multi-require` will try to find the working bower components dir from the dir of `process.cwd()`. But you can specify another one.

In programmatic API, pls use like `b.plugin(browserifyMaybeMultiRequire.workdir(thedir), {..})`.
In command line, pls use parameter `--workdir thedir`.


> p.s. feel free to use it side by other plugins/transforms, since it's a standard [`browserify`](https://github.com/substack/node-browserify) plugin, no hack, no change to your codes.

# options

```
b.plugin('browserify-maybe-multi-require', {
	files: ['xxx.js'],
    //       ['name', 'path:alias', 'submodule:alias'],
	require: ['*', './my_modules/mycomp1.js:mycomp1', 'base62/lib/base62:libbase62'],
    external: ['comp3', 'comp4'],
	ignore: ['comp5'],
    // noreset: true, // disable run again when browserify 'reset' event
});
```

**action:** _string_, guide `browserify-maybe-multi-require` to **require**/**external** specified bower and non package components in **files**(**ignore** used to ignore in already configured component)  ; available values: `files` | `require` | `external` | `ignore`.

_Notes: `name_or_path` format: `name_or_path[:alias]`, and name_or_path can be component name, submodule like 'base62/lib/base62' or file path._

#### _Additional Rules:_
- if both require/external and alias declared an alias for a component, using alias in the order priority, weak < require `*` < external `*` < require `comp1` < external `comp1` < strong
	
	for example
```
options = {
    require: ['comp1'],
    external: ['*']
};
...
```
	require component is `comp1` and external components is other all, in this case.
	

# run test

_You need ensure related node modules (for `browserify-bower`) and bower components (for test codes) installed, then run `npm test`._

For first time, you can do it like this:

```sh
browserify-maybe-multi-require $ npm install
browserify-maybe-multi-require $ npm test

	> browserify-maybe-multi-require@0.0.1 test ~/repos/browserify-maybe-multi-require
	> mocha --reporter nyan

	 1   -__,------,
	 0   -__|  /\_/\
	 0   -_~|_( ^ .^)
		 -_ ""  ""

	  1 passing (139ms)

browserify-maybe-multi-require $
```

# license

MIT
