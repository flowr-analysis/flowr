import { BinaryOperatorFlavor, ComparisonOperatorsRAst, LogicalOperatorsRAst } from '../../../../model/operators'

/**
 * Identify the flavor of a given operator, as we do not really have a use for "special"
 * operators within our internal AST.
 */
export function identifySpecialOp(content: string): BinaryOperatorFlavor {
  if (ComparisonOperatorsRAst.includes(content)) {
    return 'comparison'
  } else if (LogicalOperatorsRAst.includes(content)) {
    return 'logical'
  } else {
    // TODO: others?
    return 'arithmetic'
  }
}
