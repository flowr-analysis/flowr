import { BinaryOperatorFlavor } from "../../../../model"
import * as Lang from "../../../../model"

/**
 * Identify the flavor of a given operator, as we do not really have a use for "special"
 * operators within our internal AST.
 */
export function identifySpecialOp(content: string): BinaryOperatorFlavor {
  if (Lang.ComparisonOperatorsRAst.includes(content)) {
    return 'comparison'
  } else if (Lang.LogicalOperatorsRAst.includes(content)) {
    return 'logical'
  } else {
    // TODO: others?
    return 'arithmetic'
  }
}
