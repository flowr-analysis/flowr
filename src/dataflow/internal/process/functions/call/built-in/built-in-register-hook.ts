import { type DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import {
	EmptyArgument,
	type RFunctionArgument
} from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { getAllIdsWithTarget, pMatch } from '../../../../linker';
import { convertFnArguments } from '../common';
import type { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { HookInformation, KnownHooks } from '../../../../../hooks';
import type { ResolveInfo } from '../../../../../eval/resolve/alias-tracking';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { valueSetGuard } from '../../../../../eval/values/general';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { BuiltInProcName } from '../../../../../environments/built-in';
import { SourceRange } from '../../../../../../util/range';

export interface RegisterHookConfig {
	/** name of the hook to register, 'fn-exit' if it triggers on exit */
	hook: KnownHooks;
	args: {
		/** the expression to register as hook */
		expr:   { idx?: number, name: string },
		/** argument to control whether to add or replace the current hook */
		add?:   { idx?: number, name: string, default: boolean },
		/** argument to control whether to run the hook before or after other hooks */
		after?: { idx?: number, name: string, default: boolean },
	}
}

/**
 * Process a hook such as `on.exit`
 */
export function processRegisterHook<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: RegisterHookConfig
): DataflowInformation {
	const params = {
		[config.args.expr.name]: 'expr',
	};
	if(config.args.add) {
		params[config.args.add.name] = 'add';
	}
	if(config.args.after) {
		params[config.args.after.name] = 'after';
	}
	params['...'] = '...';

	const argMaps = pMatch(convertFnArguments(args), params);
	const exprIds = new Set(argMaps.entries().filter(([, v]) => v === 'expr').map(([k]) => k));
	const addIds = config.args.add ? new Set<NodeId>(getAllIdsWithTarget(argMaps, 'add')) : new Set<NodeId>();
	const afterIds = config.args.after ? new Set<NodeId>(getAllIdsWithTarget(argMaps, 'after')) : new Set<NodeId>();

	const wrappedFunctions = new Set<NodeId>();
	// we automatically transform the expr to a function definition that takes no arguments
	const transformed = args.map(arg => {
		if(arg === EmptyArgument)  {
			return EmptyArgument;
		} else if(exprIds.has(arg.info.id) && arg.value) {
			const val = arg.value;
			const wrapId = `${val.info.id}-hook-fn`;
			wrappedFunctions.add(wrapId);
			const wrapped = {
				type:       RType.FunctionDefinition,
				location:   val.location ?? name.location ?? SourceRange.invalid(),
				parameters: [],
				body:       val,
				lexeme:     'function',
				info:       {
					...val.info,
					id: wrapId,
				}
			} satisfies RFunctionDefinition<OtherInfo & ParentInformation>;
			data.completeAst.idMap.set(wrapId, wrapped);
			return {
				...arg,
				value: wrapped
			} satisfies RArgument;
		} else {
			return arg;
		}
	});

	const res = processKnownFunctionCall({ name, args: transformed, rootId, data, origin: BuiltInProcName.RegisterHook });
	const resolveArgs: ResolveInfo = {
		graph:       res.information.graph,
		environment: res.information.environment,
		resolve:     data.ctx.config.solver.variables,
		ctx:         data.ctx,
		idMap:       data.completeAst.idMap,
		full:        true
	};
	const shouldAdd = addIds.size === 0 ? config.args.add?.default :
		Array.from(addIds).flatMap(id => valueSetGuard(resolveIdToValue(id, resolveArgs))?.elements ?? [])
			.some(v => v.type === 'logical' && v.value !== false);
	const shouldBeAfter = afterIds.size === 0 ? config.args.after?.default :
		Array.from(afterIds).flatMap(id => valueSetGuard(resolveIdToValue(id, resolveArgs))?.elements ?? [])
			.some(v => v.type === 'logical' && v.value !== false);

	const info = res.information;
	const hooks: HookInformation[] = Array.from(wrappedFunctions, id => ({
		type:  config.hook,
		id,
		cds:   data.cds,
		add:   shouldAdd,
		after: shouldBeAfter
	}));

	info.hooks.push(...hooks);
	if(data.environment.level <= 1) {
		// if we are at the root level, we need to assume that the hook can cause unknown side-effects
		handleUnknownSideEffect(info.graph, info.environment, rootId);
	}
	return info;
}
