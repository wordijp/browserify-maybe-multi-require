esprima = require('esprima')
traverse = require('ordered-ast-traverse')

# check to require syntax
_predicateRequire = (node) ->
  if (node.type != 'CallExpression' || node.callee.type != 'Identifier' || node.callee.name != 'require')
    return false
  true

# send callback from matching to predicate
# @param data      : parse target data
# @param predicate : matching checker
# @param cb        : receiver callback
_astParser = (data, predicate, cb) ->
  traverse(esprima.parse(data, {range: true}), {pre: (node, parent, prop, idx) ->
    if (predicate(node))
      pth = node.arguments[0].value
      if (pth)
        cb(pth)
  })

astRequireParser = (data, cb) -> _astParser(data, _predicateRequire, cb)

module.exports =
  astRequireParser: astRequireParser
