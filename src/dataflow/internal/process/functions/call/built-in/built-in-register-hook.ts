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
import { pMatch } from '../../../../linker';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { convertFnArguments } from '../common';
import type { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { invalidRange } from '../../../../../../util/range';
import type { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { HookInformation, KnownHooks } from '../../../../../hooks';

export interface RegisterHookConfig {
	/** name of the hook to register, 'fn-exit' if it triggers on exit */
	hook: KnownHooks;
	// TODO: configure body arg, whether it is additive, ...
	// TODO: check with call-graph
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
	if(args.length < 1) {
		// TODO: clear current hook!
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'builtin:register-hook', hasUnknownSideEffect: true }).information;
	}


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
	const addIds = config.args.add ? new Set(argMaps.entries().filter(([, v]) => v === 'add').map(([k]) => k)) : new Set<NodeId>();
	const afterIds = config.args.after ? new Set(argMaps.entries().filter(([, v]) => v === 'after').map(([k]) => k)) : new Set<NodeId>();

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
				location:   val.location ?? invalidRange(),
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

	// TODO addIds and argIds

	const res = processKnownFunctionCall({ name, args: transformed, rootId, data, origin: 'builtin:register-hook' });

	const info = res.information;
	const hooks: HookInformation[] = Array.from(wrappedFunctions, id => ({
		type: config.hook,
		id,
		cds:  data.controlDependencies
	}));

	info.hooks.push(...hooks);
	handleUnknownSideEffect(info.graph, info.environment, rootId);
	return info;
}
