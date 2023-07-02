import { MergeableRecord } from "../../../../util/objects"

export type StringUsedInRCode = string;

export const enum OperatorArity {
  Unary = 1,
  Binary = 2,
  Both = 3,
}

export type UnaryOperatorFlavor = "arithmetic" | "logical" | 'model formula';
export type BinaryOperatorFlavor =
  | UnaryOperatorFlavor
  | "comparison"
  | "assignment";
export type BinaryOperatorFlavorInAst = BinaryOperatorFlavor | "special";
export type OperatorWrittenAs = "infix" | "prefix";
export type OperatorUsedAs = "assignment" | "operation" | "access";
export type OperatorName = string;

export interface OperatorInformationValue extends MergeableRecord {
  name:                 OperatorName;
  stringUsedInRAst:     string;
  stringUsedInternally: string;
  // precedence: number // handled by R
  flavorInRAst:         BinaryOperatorFlavorInAst;
  flavor:               BinaryOperatorFlavor;
  writtenAs:            OperatorWrittenAs;
  arity:                OperatorArity;
  usedAs:               OperatorUsedAs;
}

// TODO: remove flavor separation and use only one (no special)
// TODO: make it complete
/* eslint-disable */
export const OperatorDatabase: Record<StringUsedInRCode, OperatorInformationValue> & MergeableRecord = {
  /* model formulae */
  '~':    { name: 'model formulae',               stringUsedInRAst: '~',            stringUsedInternally: '~',    flavorInRAst: 'model formula', flavor: 'model formula', writtenAs: 'infix',  arity:  OperatorArity.Both,   usedAs: 'operation' },
  /* arithmetic */
  '+':    { name: 'addition or unary +',          stringUsedInRAst: '+',            stringUsedInternally: '+',    flavorInRAst: 'arithmetic',    flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Both,   usedAs: 'operation' },
  '-':    { name: 'subtraction or unary -',       stringUsedInRAst: '-',            stringUsedInternally: '-',    flavorInRAst: 'arithmetic',    flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Both,   usedAs: 'operation' },
  '*':    { name: 'multiplication',               stringUsedInRAst: '*',            stringUsedInternally: '*',    flavorInRAst: 'arithmetic',    flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '/':    { name: 'division',                     stringUsedInRAst: '/',            stringUsedInternally: '/',    flavorInRAst: 'arithmetic',    flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '^':    { name: 'exponentiation',               stringUsedInRAst: '^',            stringUsedInternally: '^',    flavorInRAst: 'arithmetic',    flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  /* no error, R uses ^ to represent ** in the AST */
  '**':   { name: 'alternative exponentiation',   stringUsedInRAst: '^' ,           stringUsedInternally: '**',   flavorInRAst: 'arithmetic',    flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%%':   { name: 'modulus',                      stringUsedInRAst: '%%',           stringUsedInternally: '%%',   flavorInRAst: 'special',       flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%/%':  { name: 'integer division',             stringUsedInRAst: '%/%',          stringUsedInternally: '%/%',  flavorInRAst: 'special',       flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%*%':  { name: 'matrix product',               stringUsedInRAst: '%*%',          stringUsedInternally: '%*%',  flavorInRAst: 'special',       flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%o%':  { name: 'outer product',                stringUsedInRAst: '%o%',          stringUsedInternally: '%o%',  flavorInRAst: 'special',       flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '%x%':  { name: 'kronecker product',            stringUsedInRAst: '%x%',          stringUsedInternally: '%x%',  flavorInRAst: 'special',       flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  /* comparison */
  '==':   { name: 'equal to',                     stringUsedInRAst: 'EQ',           stringUsedInternally: '==',   flavorInRAst: 'comparison',    flavor: 'comparison',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '!=':   { name: 'not equal to',                 stringUsedInRAst: 'NE',           stringUsedInternally: '!=',   flavorInRAst: 'comparison',    flavor: 'comparison',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '>':    { name: 'greater than',                 stringUsedInRAst: 'GT',           stringUsedInternally: '>',    flavorInRAst: 'comparison',    flavor: 'comparison',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '>=':   { name: 'greater than or equal to',     stringUsedInRAst: 'GE',           stringUsedInternally: '>=',   flavorInRAst: 'comparison',    flavor: 'comparison',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '<':    { name: 'less than',                    stringUsedInRAst: 'LT',           stringUsedInternally: '<',    flavorInRAst: 'comparison',    flavor: 'comparison',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '<=':   { name: 'less than or equal to',        stringUsedInRAst: 'LE',           stringUsedInternally: '<=',   flavorInRAst: 'comparison',    flavor: 'comparison',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  /* logical */
  '&':    { name: 'logical and (vectorized)',     stringUsedInRAst: 'AND',          stringUsedInternally: '&',    flavorInRAst: 'logical',       flavor: 'logical',       writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '&&':   { name: 'logical and (non-vectorized)', stringUsedInRAst: 'AND2',         stringUsedInternally: '&&',   flavorInRAst: 'logical',       flavor: 'logical',       writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '|':    { name: 'logical or (vectorized)',      stringUsedInRAst: 'OR',           stringUsedInternally: '|',    flavorInRAst: 'logical',       flavor: 'logical',       writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '||':   { name: 'logical or (not-vectorized)',  stringUsedInRAst: 'OR2',          stringUsedInternally: '||',   flavorInRAst: 'logical',       flavor: 'logical',       writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '!':    { name: 'unary not',                    stringUsedInRAst: '!',            stringUsedInternally: '!',    flavorInRAst: 'logical',       flavor: 'logical',       writtenAs: 'prefix', arity:  OperatorArity.Unary,  usedAs: 'operation' },
  '%in%': { name: 'matching operator',            stringUsedInRAst: '%in%',         stringUsedInternally: '%in%', flavorInRAst: 'special',       flavor: 'logical',       writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  /* assignment */
  // TODO: clean up flavor? should not be special
  '<-':   { name: 'left assignment',              stringUsedInRAst: 'LEFT_ASSIGN',  stringUsedInternally: '<-',   flavorInRAst: 'special',       flavor: 'assignment',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'assignment' },
  '<<-':  { name: 'left global assignment',       stringUsedInRAst: 'LEFT_ASSIGN',  stringUsedInternally: '<<-',  flavorInRAst: 'special',       flavor: 'assignment',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'assignment' },
  '->':   { name: 'right assignment',             stringUsedInRAst: 'RIGHT_ASSIGN', stringUsedInternally: '->',   flavorInRAst: 'special',       flavor: 'assignment',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'assignment' },
  '->>':  { name: 'right global assignment',      stringUsedInRAst: 'RIGHT_ASSIGN', stringUsedInternally: '->>',  flavorInRAst: 'special',       flavor: 'assignment',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'assignment' },
  '=':    { name: 'equal assignment',             stringUsedInRAst: 'EQ_ASSIGN',    stringUsedInternally: '=',    flavorInRAst: 'special',       flavor: 'assignment',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'assignment' },
  /* others */
  /* maybe introduce custom in-r-ast flavor for these? we consider it arithmetic, as it works on numbers => if we change this we have to create custom tests! (with arithmetic, there is the automatic test set) */
  ':':    { name: 'sequence operator',            stringUsedInRAst: ':',            stringUsedInternally: ':',    flavorInRAst: 'special',       flavor: 'arithmetic',    writtenAs: 'infix',  arity:  OperatorArity.Binary, usedAs: 'operation' },
  '?':    { name: 'question',                     stringUsedInRAst: '?',            stringUsedInternally: '?',    flavorInRAst: 'special',       flavor: 'logical',       writtenAs: 'prefix', arity:  OperatorArity.Unary,  usedAs: 'operation' } /*TODO*/
}
/* eslint-enable */

function buildOperatorRAstCollection(operators: readonly string[]): Set<string> {
  return new Set<string>(operators.map(op => OperatorDatabase[op].stringUsedInRAst))
}

export const ArithmeticOperators: readonly string[] = Object.keys(
  OperatorDatabase
).filter((op) => OperatorDatabase[op].flavor === "arithmetic")
// '**' will be treated as '^'
export const ArithmeticOperatorsRAst = buildOperatorRAstCollection(ArithmeticOperators)
export const ComparisonOperators: readonly string[] = Object.keys(
  OperatorDatabase
).filter((op) => OperatorDatabase[op].flavor === "comparison")
export const ComparisonOperatorsRAst = buildOperatorRAstCollection(ComparisonOperators)
export const LogicalOperators: readonly string[] = Object.keys(
  OperatorDatabase
).filter((op) => OperatorDatabase[op].flavor === "logical")
export const LogicalOperatorsRAst = buildOperatorRAstCollection(LogicalOperators)

export const ModelFormulaOperators: readonly string[] = Object.keys(
  OperatorDatabase
).filter((op) => OperatorDatabase[op].flavor === "model formula")
export const ModelFormulaOperatorsRAst = buildOperatorRAstCollection(ModelFormulaOperators)

export const Assignments: readonly string[] = Object.keys(
  OperatorDatabase
).filter((op) => OperatorDatabase[op].flavor === "assignment")
export const AssignmentsRAst = buildOperatorRAstCollection(Assignments)

export const Operators = [
  ...ArithmeticOperators,
  ...ComparisonOperators,
  ...LogicalOperators,
] as const

export type Operator = (typeof Operators)[number];
