import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ControlDependency, DataflowInformation, ExitPoint } from '../../../../../info';
import { ExitPointType } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RFunctionArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { DefaultMap } from '../../../../../../util/collections/defaultmap';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { valueSetGuard } from '../../../../../eval/values/general';
import { isNotUndefined } from '../../../../../../util/assert';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';

/**
 * Processes a built-in 'stopifnot' function call.
 * This is special in that it may take a number of boolean expressions either via `...` or
 * via `exprs` for which each expression is now evaluated individually:
 * @example
 * ```r
 * stopifnot(exprs = {
 *   all.equal(pi, 3.1415927)
 *   2 < 2
 *   all(1:10 < 12)
 *   "a" < "b"
 * })
 * ```
 */
export function processStopIfNot<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	const res = processKnownFunctionCall({ name, args, rootId, data, origin: 'builtin:stopifnot' }).information;
	if(args.length === 0) {
		dataflowLogger.warn(`stopifnot (${name.content}) has no argument, assuming trivially true and skipping`);
		return res;
	}

	// R only allows ... or exprs or exprObject, not all, but we over-approximate and collect all, given that they are after '...'
	// we can safely extract named args by full name
	const argMap = new DefaultMap<string, RFunctionArgument<OtherInfo & ParentInformation>[]>(() => []);
	for(const arg of args) {
		const name = (arg === EmptyArgument ? undefined : arg.name)?.content;
		if(name === 'exprObject' || name === 'exprs' || name === 'local') {
			argMap.get(name).push(arg);
		} else {
			argMap.get('...').push(arg);
		}
	}
	const localArgs = argMap.get('local');
	const localArg = localArgs.length > 0 ? localArgs[localArgs.length - 1] : undefined;
	const resolveArgs = { environment: data.environment, idMap: data.completeAst.idMap, resolve: data.ctx.config.solver.variables, ctx: data.ctx };

	// we collect all control dependencies from: all '...', all expressions in 'exprs', and 'exprObject'
	const ids = collectIdsForControl(argMap, data);
	if(localArg !== undefined && localArg !== EmptyArgument) {
		const localVal = resolveIdToValue(localArg?.value?.info.id, resolveArgs);
		const alwaysTrue = valueSetGuard(localVal)?.elements.every(d => d.type === 'logical' && d.value === true) ?? false;
		if(!alwaysTrue) {
			dataflowLogger.warn(`stopifnot (${name.content}) with non-true 'local' argument is not yet supported, over-approximate`);
			const cds = (data.controlDependencies ?? []).concat(Array.from(ids).map(r => ({
				id:   r,
				when: false
			})));
			(res.exitPoints as ExitPoint[]).push({
				type:                ExitPointType.Error,
				nodeId:              rootId,
				controlDependencies: cds
			});
			return res;
		}
	}

	const cds: ControlDependency[] = [];
	for(const id of ids) {
		const val = resolveIdToValue(id, resolveArgs);
		const alwaysFalse = valueSetGuard(val)?.elements.every(d => d.type === 'logical' && d.value === false) ?? false;
		if(alwaysFalse) {
			// we know that this fails *always*
			(res.exitPoints as ExitPoint[]).push(data.controlDependencies ? {
				type:                ExitPointType.Error,
				nodeId:              rootId,
				controlDependencies: data.controlDependencies
			} : {
				type:   ExitPointType.Error,
				nodeId: rootId
			});
			return res;
		}
		const alwaysTrue = valueSetGuard(val)?.elements.every(d => d.type === 'logical' && d.value === true) ?? false;
		if(!alwaysTrue) {
			cds.push({
				id:   id,
				when: false // only trigger if it is false
			});
		}
	}

	if(cds.length === 0) {
		dataflowLogger.warn(`stopifnot (${name.content}) has no unknown expressions to evaluate, assuming trivially true and skipping`);
		return res;
	}

	(res.exitPoints as ExitPoint[]).push({
		type:                ExitPointType.Error,
		nodeId:              rootId,
		controlDependencies: (data.controlDependencies ?? []).concat(cds)
	});
	return res;
}

/** Generator so we can early exit on first always-false */
function* collectIdsForControl<OtherInfo>(argMap: DefaultMap<string, RFunctionArgument<OtherInfo & ParentInformation>[]>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>) {
	yield* argMap.get('...')
		.map(a => a !== EmptyArgument ? a.value?.info.id : undefined)
		.filter(isNotUndefined)
	;
	const exprs = argMap.get('exprs');
	if(exprs.length > 0) {
		const exprsArg = exprs[exprs.length - 1];
		if(exprsArg !== EmptyArgument && exprsArg.value?.info.id) {
			const elem = data.completeAst.idMap.get(exprsArg.value?.info.id);
			if(elem?.type === RType.ExpressionList) {
				for(const expr of elem.children) {
					yield expr.info.id;
				}
			} else {
				yield exprsArg.value?.info.id;
			}
		}
	}
	const exprObjectArgs = argMap.get('exprObject');
	if(exprObjectArgs.length > 0) {
		const exprObjectArg = exprObjectArgs[exprObjectArgs.length - 1];
		if(exprObjectArg !== EmptyArgument && exprObjectArg.value?.info.id) {
			yield exprObjectArg.value?.info.id;
		}
	}
}
