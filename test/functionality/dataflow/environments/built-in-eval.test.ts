import { assert, describe, test } from 'vitest';
import { getDefaultBuiltInDefinitions } from '../../../../src/dataflow/environments/built-in-config';
import { BuiltInEvalHandlerMapper } from '../../../../src/dataflow/environments/built-in';
import { BuiltInEvalName } from '../../../../src/dataflow/environments/built-in-eval-name';
import { CallProp, InputProps } from '../../../../src/dataflow/environments/built-in-props';
import { ComparisonOps, LogicalOps } from '../../../../src/dataflow/eval/resolve/resolve-operators';
import { NumericFns } from '../../../../src/dataflow/eval/resolve/resolve-numbers';
import { StringFns } from '../../../../src/dataflow/eval/resolve/resolve-strings';
import { ReferenceType } from '../../../../src/dataflow/environments/identifier';
import { label } from '../../_helper/label';

/**
 * The names each handler knows how to fold, taken from the handler itself so that the configuration cannot
 * name one it would silently answer `Top` for (or miss one it could have folded).
 */
const FoldedBy: Record<BuiltInEvalName, readonly string[]> = {
	[BuiltInEvalName.Numeric]:    Object.keys(NumericFns),
	[BuiltInEvalName.Comparison]: Object.keys(ComparisonOps),
	/* `!` is the unary case the handler covers besides the binary operators */
	[BuiltInEvalName.Logical]:    [...Object.keys(LogicalOps), '!'],
	[BuiltInEvalName.StringFn]:   Object.keys(StringFns),
	[BuiltInEvalName.Seq]:        [':'],
	[BuiltInEvalName.Vector]:     ['c'],
	[BuiltInEvalName.Group]:      ['(']
};

const handlerOf = new Map(Object.entries(BuiltInEvalHandlerMapper).map(([name, handler]) => [handler, name as BuiltInEvalName]));

/** what the default configuration ends up registering, so that a redefinition dropping a handler shows up too */
const definitions = getDefaultBuiltInDefinitions();
/* a name a package owns is stated apart from the built-ins, but it is folded just the same */
const folded = [definitions.builtInMemory, ...definitions.packageMemory.values()].flatMap(m => [...m]).flatMap(([name, defs]) => defs.flatMap(d =>
	d.type === ReferenceType.BuiltInFunction && d.evalHandler !== undefined ?
		[{ name, handler: handlerOf.get(d.evalHandler), info: d.config ?? {} }] : []));

describe('Built-in value folding', () => {
	test.each(Object.entries(FoldedBy))(label('%s folds the names it is configured for', ['name-normal'], ['other']), (handler, names) => {
		assert.deepStrictEqual(folded.filter(f => f.handler === handler).map(f => f.name).sort(), [...names].sort());
	});

	test(label('a folded call is pure and names its argument as its handler expects', ['name-normal'], ['other']), () => {
		for(const { name, info } of folded) {
			assert.notStrictEqual((info.props ?? 0) & CallProp.Pure, 0, `${name} is folded but does not claim to be pure`);
			assert.strictEqual((info.props ?? 0) & InputProps, 0, `${name} is folded but brings in data of its own`);
			/* the handlers match arguments by the parameter names they declare, so the signature has to use the same ones */
			const params: readonly string[] | undefined = StringFns[name as keyof typeof StringFns]?.params
				?? NumericFns[name as keyof typeof NumericFns]?.params;
			for(const [at, param] of (params ?? []).entries()) {
				assert.strictEqual(info.sig?.[at]?.[0], param, `${name} declares another parameter ${at} than its handler matches`);
			}
		}
	});
});
