flexi-require
================

[![NPM](https://nodei.co/npm/flexi-require.png)](https://nodei.co/npm/flexi-require/)

Let `flexi-require` plugin require bower and non package components for you when building bundles, then you can `require` them as normal node modules in application codes.  
You can also provide external config, to guide `flexi-require` to external some bower and non package components, which is useful when when building multiple bundles.

> p.s. bower and non package components is optional, if want to use [`bower`](https://github.com/bower/bower), install it.

# install

```
npm install flexi-require
```

# usage
## Programmatic API

In your task runner like gulp, add this plugin to browserify:

```
b.plugin('flexi-require', {
	// files:  [], // not set is default. (equal files: browserify entries)
	// or
	files:  ['xxx.js'],

	require: ['*', './my_modules/mycomp1.js:mycomp1', 'comp2', 'base62/lib/base62'],
	external: ['comp3', 'comp4'],
	ignore: ['comp5'],
	// noreset: true, // disable run again when browserify 'reset' event
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
$ browserify entry.js -d -p [flexi-require --conf conf.json] > bundle.js
```

Use a node of the conf json,

```shell
$ browserify entry.js -d -p [flexi-require --conf conf.json --confnode aa.bbb] > bundle.js
```

### workdir
By default, `flexi-require` will try to find the working bower components dir when using it, from the dir of `process.cwd()`. But you can specify another one.

In programmatic API, pls use like `b.plugin(flexiRequire.workdir(thedir), {..})`.
In command line, pls use parameter `--workdir thedir`.


> p.s. feel free to use it side by other plugins/transforms, since it's a standard [`browserify`](https://github.com/substack/node-browserify) plugin, no hack, no change to your codes.

# options

```
b.plugin('flexi-require', {
	// files:  [], // not set is default. (equal files: browserify entries)
	// or
	files:  ['xxx.js'],
	//       ['name', 'path:alias', 'submodule:alias'],

	require: ['*', './my_modules/mycomp1.js:mycomp1', 'base62/lib/base62:libbase62'],
	external: ['comp3', 'comp4'],
	ignore: ['comp5'],
	// noreset: true, // disable run again when browserify 'reset' event
});
```

**action:** _string_, guide `flexi-require` to **require**/**external** specified bower and non package components in **files**(**ignore** used to ignore in already configured component)  ; available values: `files` | `require` | `external` | `ignore`.

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

_You optional ensure related node modules (for `bower`)  components (for test codes) installed, then run `npm test`._

For first time, you can do it like this:

```sh
flexi-require $ npm install
flexi-require $ npm test

	> flexi-require@0.0.1 test ~/repos/flexi-require
	> mocha --reporter nyan

	 1   -__,------,
	 0   -__|  /\_/\
	 0   -_~|_( ^ .^)
		 -_ ""  ""

	  1 passing (139ms)

flexi-require $
```

# license

MIT
