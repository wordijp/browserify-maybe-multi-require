// Generated by CoffeeScript 1.9.2
(function() {
  var _astParser, _predicateRequire, astRequireParser, esprima, traverse;

  esprima = require('esprima');

  traverse = require('ordered-ast-traverse');

  _predicateRequire = function(node) {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== 'require') {
      return false;
    }
    return true;
  };

  _astParser = function(data, predicate, cb) {
    return traverse(esprima.parse(data, {
      range: true
    }), {
      pre: function(node, parent, prop, idx) {
        var pth;
        if (predicate(node)) {
          pth = node["arguments"][0].value;
          if (pth) {
            return cb(pth);
          }
        }
      }
    });
  };

  astRequireParser = function(data, cb) {
    return _astParser(data, _predicateRequire, cb);
  };

  module.exports = {
    astRequireParser: astRequireParser
  };

}).call(this);
