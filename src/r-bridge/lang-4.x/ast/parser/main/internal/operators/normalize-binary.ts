import { type NormalizerData, ParseError } from '../../normalizer-data';
import { parseLog } from '../../../json/parser';
import { ensureChildrenAreLhsAndRhsOrdered, ensureExpressionList, retrieveMetaStructure, retrieveOpName } from '../../normalize-meta';
import { guard } from '../../../../../../../util/assert';
import { expensiveTrace } from '../../../../../../../util/log';
import { startAndEndsWith } from '../../../../../../../util/text/strings';
import type { RNode } from '../../../../model/model';
import { RawRType, RType } from '../../../../model/type';
import { OperatorsInRAst } from '../../../../model/operators';
import { normalizeSingleNode } from '../structure/normalize-single-node';
import type { RFunctionCall, RUnnamedFunctionCall } from '../../../../model/nodes/r-function-call';
import { RBinaryOp } from '../../../../model/nodes/r-binary-op';
import type { RPipe } from '../../../../model/nodes/r-pipe';
import type { NamedJsonEntry } from '../../../json/format';
import { RDelimiter } from '../../../../model/nodes/info/r-delimiter';
import { RExpressionList } from '../../../../model/nodes/r-expression-list';
import { RSymbol } from '../../../../model/nodes/r-symbol';
import type { RParameter } from '../../../../model/nodes/r-parameter';
import type { RFunctionDefinition } from '../../../../model/nodes/r-function-definition';
import type { BrandedIdentifier } from '../../../../../../../dataflow/environments/identifier';


/**
 * Parsing binary operations includes the pipe, even though the produced PIPE construct is not a binary operation,
 * to ensure it is handled separately from the others (especially in the combination of a pipe bind)
 */
export function tryNormalizeBinary(
	data: NormalizerData,
	[lhs, operator, rhs]: [NamedJsonEntry, NamedJsonEntry, NamedJsonEntry]
): RNode | undefined {
	expensiveTrace(parseLog, () => `binary op for ${lhs.name} [${operator.name}] ${rhs.name}`);
	if(operator.name === RawRType.Special || OperatorsInRAst.has(operator.name) || operator.name === RawRType.Pipe || operator.name === RawRType.Pipebind) {
		return parseBinaryOp(data, lhs, operator, rhs);
	} else {
		return undefined;
	}
}

function parseBinaryOp(data: NormalizerData, lhs: NamedJsonEntry, operator: NamedJsonEntry, rhs: NamedJsonEntry): RFunctionCall | RBinaryOp | RPipe {
	ensureChildrenAreLhsAndRhsOrdered(lhs.content, rhs.content);
	const parsedLhs = normalizeSingleNode(data, lhs);
	const parsedRhs = normalizeSingleNode(data, rhs);

	if(RDelimiter.is(parsedLhs) || RDelimiter.is(parsedRhs)) {
		throw new ParseError(`unexpected under-sided binary op, received ${JSON.stringify([parsedLhs, parsedRhs])} for ${JSON.stringify([lhs, operator, rhs])}`);
	}

	const operationName = retrieveOpName(operator);

	const { location, content } = retrieveMetaStructure(operator.content);

	if(startAndEndsWith(operationName, '%')) {
		const lhsLoc = RExpressionList.is(parsedLhs) ? parsedLhs.grouping?.[0].location : parsedLhs.location;
		const rhsLoc = RExpressionList.is(parsedRhs) ? parsedRhs.grouping?.[0].location : parsedRhs.location;

		guard(lhsLoc !== undefined && rhsLoc !== undefined,
			() => `special op lhs and rhs must have a locations, but ${JSON.stringify(parsedLhs)} || ${JSON.stringify(lhsLoc)} and ${JSON.stringify(parsedRhs)} ||  || ${JSON.stringify(rhsLoc)})`);
		// parse as infix function call!
		return {
			type:         RType.FunctionCall,
			named:        true,
			infixSpecial: true,
			lexeme:       data.currentLexeme ?? content,
			location,
			functionName: {
				type:   RType.Symbol,
				location,
				lexeme: content,
				content,
				info:   {}
			},
			arguments: [
				{
					type:     RType.Argument,
					location: lhsLoc,
					value:    parsedLhs,
					name:     undefined,
					lexeme:   parsedLhs.lexeme ?? '',
					info:     {}
				},
				{
					type:     RType.Argument,
					location: rhsLoc,
					value:    parsedRhs,
					name:     undefined,
					lexeme:   parsedRhs.lexeme ?? '',
					info:     {}
				}
			],
			info: {}
		};
	} else if(operator.name === RawRType.Pipe) {
		guard(parsedLhs.location !== undefined, () => `pipe lhs must have a location, but ${JSON.stringify(parsedLhs)})`);
		guard(parsedLhs.lexeme !== undefined, () => `pipe lhs must have a full lexeme, but ${JSON.stringify(parsedLhs)})`);
		return {
			type: RType.Pipe,
			location,
			lhs:  {
				type:     RType.Argument,
				location: parsedLhs.location,
				value:    parsedLhs,
				name:     undefined,
				lexeme:   parsedLhs.lexeme,
				info:     {}
			},
			rhs:    desugarPipeBindRhs(parsedRhs),
			lexeme: content,
			info:   {
				fullRange:  data.currentRange,
				adToks:     [],
				fullLexeme: data.currentLexeme
			}
		};
	} else {
		return {
			type:     RType.BinaryOp,
			location,
			lhs:      parsedLhs,
			rhs:      parsedRhs,
			operator: operationName,
			lexeme:   content,
			info:     {
				fullRange:  data.currentRange,
				adToks:     [],
				fullLexeme: data.currentLexeme
			}
		};
	}
}

/**
 * Desugars a pipe-bind rhs `name => body` into `(function(name) body)(x)`, mirroring R's own `gram.y`
 * desugaring, so the pipe built-in can treat it like any other pipe into an anonymous function.
 */
function desugarPipeBindRhs(rhs: RNode): RNode {
	if(!RBinaryOp.is(rhs) || rhs.operator !== '=>') {
		return rhs;
	}
	const boundName = rhs.lhs;
	if(!RSymbol.is(boundName) || typeof boundName.content !== 'string') {
		throw new ParseError(`pipe-bind variable must be a symbol, but received ${JSON.stringify(boundName)}`);
	}
	const parameter: RParameter = {
		type:         RType.Parameter,
		location:     boundName.location,
		lexeme:       boundName.lexeme,
		name:         boundName as RSymbol<object, BrandedIdentifier>,
		special:      false,
		defaultValue: undefined,
		info:         rhs.info
	};
	const definition: RFunctionDefinition = {
		type:       RType.FunctionDefinition,
		location:   rhs.location,
		lexeme:     rhs.lexeme,
		parameters: [parameter],
		body:       ensureExpressionList(rhs.rhs),
		info:       rhs.info
	};
	return {
		type:           RType.FunctionCall,
		named:          undefined,
		location:       rhs.location,
		lexeme:         rhs.lexeme,
		calledFunction: definition,
		arguments:      [],
		info:           rhs.info
	} satisfies RUnnamedFunctionCall;
}
