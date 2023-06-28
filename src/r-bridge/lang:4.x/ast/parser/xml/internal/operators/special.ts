import { BinaryOperatorFlavor, ComparisonOperatorsRAst, LogicalOperatorsRAst } from '../../../../model'

/**
 * Identify the flavor of a given operator, as we do not really have a use for "special"
 * operators within our internal AST.
 */
export function identifySpecialOp(content: string): BinaryOperatorFlavor {
  if (ComparisonOperatorsRAst.has(content)) {
    return 'comparison'
  } else if (LogicalOperatorsRAst.has(content)) {
    return 'logical'
  } else {
    // TODO: others?
    return 'arithmetic'
  }
}
