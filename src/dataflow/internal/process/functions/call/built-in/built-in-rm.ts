import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import type { Identifier } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { pMatch } from '../../../../linker';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { convertFnArguments } from '../common';
import { resolveIdToValue } from '../../../../../eval/resolve/alias-tracking';
import { valueSetGuard } from '../../../../../eval/values/general';
import { isValue } from '../../../../../eval/values/r-value';

/**
 * Process an `rm` call.
 */
export function processRm<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
): DataflowInformation {
	if(args.length === 0) {
		dataflowLogger.warn('empty rm, skipping');
		return processKnownFunctionCall({ name, args, rootId, data, origin: 'default' }).information;
	}
	const res = processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.Rm }).information;

	const names: Identifier[] = [];
	const argMaps = pMatch(convertFnArguments(args), { '...': '...', 'list': 'list', 'envir': 'envir' });

	for(const dotId of argMaps.get('...') ?? []) {
		const value = RArgument.getWithId(args, dotId)?.value;
		if(value?.type === RType.Symbol) {
			names.push(value.content);
		} else if(value?.type === RType.String) {
			names.push(value.content.str);
		} else if(value !== undefined) {
			dataflowLogger.warn(`argument is not a symbol or string in rm, skipping ${JSON.stringify(value)}`);
		}
	}

	for(const listId of argMaps.get('list') ?? []) {
		const value = RArgument.getWithId(args, listId)?.value;
		if(!value) {
			continue;
		}
		if(value.type === RType.String) {
			names.push(value.content.str);
		} else {
			const resolved = valueSetGuard(resolveIdToValue(value.info.id, {
				environment: data.environment,
				idMap:       data.completeAst.idMap,
				resolve:     data.ctx.config.solver.variables,
				ctx:         data.ctx
			}));
			for(const r of resolved?.elements ?? []) {
				if(r.type === 'string' && isValue(r.value)) {
					names.push(r.value.str);
				}
			}
		}
	}
	let env = res.environment.current;
	for(const n of names) {
		env = env.remove(n);
	}

	return {
		...res,
		environment: {
			current: env,
			level:   res.environment.level
		}
	};
}
