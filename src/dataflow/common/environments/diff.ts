import type { GenericDifferenceInformation } from '../../../util/diff'
import { setDifference } from '../../../util/diff'
import type { IdentifierReference, IEnvironment, REnvironmentInformation } from './environment'
import { jsonReplacer } from '../../../util/json'

export function diffIdentifierReferences(a: IdentifierReference, b: IdentifierReference, info: GenericDifferenceInformation): void {
	if(a.name !== b.name) {
		info.report.addComment(`${info.position}Different identifier names: ${a.name} vs. ${b.name}`)
	}
	if(a.nodeId !== b.nodeId) {
		info.report.addComment(`${info.position}Different nodeIds: ${a.nodeId} vs. ${b.nodeId}`)
	}
	if(a.used !== b.used) {
		info.report.addComment(`${info.position}Different used: ${a.used} vs. ${b.used}`)
	}
}

function diffMemory(a: IEnvironment, b: IEnvironment, info: GenericDifferenceInformation) {
	for(const [key, value] of a.memory) {
		const value2 = b.memory.get(key)
		if(value2 === undefined || value.length !== value2.length) {
			info.report.addComment(`${info.position}Different definitions for ${key}. ${info.leftname}: ${JSON.stringify(value, jsonReplacer)} vs. ${info.rightname}: ${JSON.stringify(value2, jsonReplacer)}`)
			continue
		}

		// we sort both value arrays by their id so that we have no problems with differently ordered arrays (which have no impact)
		const sorted = [...value].sort((a, b) => a.nodeId.localeCompare(b.nodeId))
		const sorted2 = [...value2].sort((a, b) => a.nodeId.localeCompare(b.nodeId))

		for(let i = 0; i < value.length; ++i) {
			const aVal = sorted[i]
			const bVal = sorted2[i]
			if(aVal.name !== bVal.name) {
				info.report.addComment(`${info.position}Different names for ${key}. ${info.leftname}: ${aVal.name} vs. ${info.rightname}: ${bVal.name}`)
			}
			if(aVal.nodeId !== bVal.nodeId) {
				info.report.addComment(`${info.position}Different ids for ${key}. ${info.leftname}: ${aVal.nodeId} vs. ${info.rightname}: ${bVal.nodeId}`)
			}
			if(aVal.used !== bVal.used) {
				info.report.addComment(`${info.position}Different used for ${key} (${aVal.nodeId}). ${info.leftname}: ${aVal.used} vs. ${info.rightname}: ${bVal.used}`)
			}
			if(aVal.definedAt !== bVal.definedAt) {
				info.report.addComment(`${info.position}Different definition ids (definedAt) for ${key} (${aVal.nodeId}). ${info.leftname}: ${aVal.definedAt} vs. ${info.rightname}: ${bVal.definedAt}`)
			}
			if(aVal.kind !== bVal.kind) {
				info.report.addComment(`${info.position}Different kinds for ${key} (${aVal.nodeId}). ${info.leftname}: ${aVal.kind} vs. ${info.rightname}: ${bVal.kind}`)
			}
		}
	}
}

export function diffEnvironment(a: IEnvironment | undefined, b: IEnvironment | undefined, info: GenericDifferenceInformation): void {
	if(a === undefined || b === undefined) {
		if(a !== b) {
			info.report.addComment(`${info.position}Different environments. ${info.leftname}: ${JSON.stringify(a, jsonReplacer)} vs. ${info.rightname}: ${JSON.stringify(b, jsonReplacer)}`)
		}
		return
	}
	if(a.name !== b.name) {
		info.report.addComment(`${info.position}Different environment names. ${info.leftname}: ${JSON.stringify(a, jsonReplacer)} vs. ${info.rightname}: ${JSON.stringify(b, jsonReplacer)}`)
	}
	if(a.memory.size !== b.memory.size) {
		info.report.addComment(`${info.position}Different environment sizes. ${info.leftname}: ${JSON.stringify(a, jsonReplacer)} vs. ${info.rightname}: ${JSON.stringify(b, jsonReplacer)}`)
		setDifference(new Set([...a.memory.keys()]), new Set([...b.memory.keys()]), {
			...info,
			position: `${info.position}Key comparison. `
		})
	}
	diffMemory(a, b, info)
	diffEnvironment(a.parent, b.parent, { ...info, position: `${info.position}Parents of ${a.id} & ${b.id}. ` })
}

export function diffEnvironments(a: REnvironmentInformation | undefined, b: REnvironmentInformation | undefined, info: GenericDifferenceInformation): void {
	if(a === undefined || b === undefined) {
		info.report.addComment(`${info.position}Different environments: ${JSON.stringify(a, jsonReplacer)} vs. ${JSON.stringify(b, jsonReplacer)}`)
		return
	}
	diffEnvironment(a.current, b.current, info)
}
