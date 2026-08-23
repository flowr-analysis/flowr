import type { PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowInformation } from '../../../../../info';
import type { DataflowProcessorInformation } from '../../../../../processor';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { processKnownFunctionCall } from '../known-call-handling';
import type { ClassDeclarationConfig } from '../../../../../fn/class-declaration';
import { attachClassDeclaration } from './built-in-s-seven-new-generic';
import { type AssignmentConfiguration, processAssignment } from './built-in-assignment';

/** Configuration of {@link processClassRelation}. */
export interface ClassRelationConfiguration {
	/** what the call states about the classes it relates, see {@link classDeclarationOf} */
	readonly classDecl?:  ClassDeclarationConfig;
	/** when set, the call also binds a name, and is processed as that assignment first (`setValidity`) */
	readonly assignment?: AssignmentConfiguration;
}

/**
 * Processes a call that *relates* existing classes rather than declaring one: `setIs`, which states an
 * explicit is-a, and `setValidity`, which attaches a validator to the class it names. The relation is recorded
 * on the call vertex so a consumer sees it next to the `setClass` declarations, and an `assignment` config
 * keeps whatever binding behavior the call had before.
 */
export function processClassRelation<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: ClassRelationConfiguration
): DataflowInformation {
	const info = config.assignment
		? processAssignment(name, args, rootId, data, config.assignment)
		: processKnownFunctionCall({ name, args, rootId, data, origin: BuiltInProcName.ClassRelation }).information;
	attachClassDeclaration(info, rootId, args, config.classDecl);
	return info;
}
