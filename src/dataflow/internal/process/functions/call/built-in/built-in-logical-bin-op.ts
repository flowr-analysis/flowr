import type {
	NodeId,
	ParentInformation,
	RFunctionArgument,
	RNode,
	RSymbol
} from '../../../../../../r-bridge'
import {
	collectAllIds, RType
} from '../../../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../../../processor'
import type { DataflowInformation } from '../../../../../info'
import type { IdentifierReference, IdentifierDefinition } from '../../../../../index'
import { dataflowLogger, EdgeType  } from '../../../../../index'
import { processKnownFunctionCall } from '../known-call-handling'
import { guard } from '../../../../../../util/assert'
import { log, LogLevel } from '../../../../../../util/log'
import {appendEnvironment, define, overwriteEnvironment} from '../../../../../environments'
import {unpackArgument} from "../argument/unpack-argument";


export function processSpecialBinOp<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	/* we expect them to be ordered in the sense that we have (source, target): `<source> <- <target>` */
	args: readonly RFunctionArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: { lazy: boolean }
): DataflowInformation {
	if(!config.lazy) {
		return processKnownFunctionCall(name, args, rootId, data).information
	} else if (args.length != 2) {
		dataflowLogger.warn(`Logical bin-op ${name.content} has something else than 2 arguments, skipping`)
		return processKnownFunctionCall(name, args, rootId, data).information
	}

	const { information, processedArguments: [lhs, rhs] } = processKnownFunctionCall(name, args, rootId, data)

	guard(lhs !== undefined && rhs !== undefined, 'lhs and rhs are defined')

	return {
		...information,
		environment:       appendEnvironment(lhs.environment, rhs.environment)
	}
}
