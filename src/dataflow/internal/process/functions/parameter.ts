import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { define, IdentifierDefinition } from '../../../environments'
import { LocalScope } from '../../../graph'
import { ParentInformation, RParameter } from '../../../../r-bridge'
import { setDefinitionOfNode } from '../../linker'
import { log } from '../../../../util/log'

export function processFunctionParameter<OtherInfo>(parameter: RParameter<OtherInfo & ParentInformation>, name: DataflowInformation<OtherInfo>,  defaultValue: DataflowInformation<OtherInfo> | undefined, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  const graph = defaultValue !== undefined ? name.graph.mergeWith(defaultValue.graph) : name.graph

  const writtenNodes: IdentifierDefinition[] = name.activeNodes.map(n => ({
    ...n,
    kind:      'parameter',
    used:      'always',
    definedAt: parameter.info.id,
    scope:     LocalScope
  }))
  for(const writtenNode of writtenNodes) {
    log.trace(`argument ${writtenNode.name} (${writtenNode.nodeId}) is defined at id ${writtenNode.definedAt} with ${defaultValue === undefined ? 'no default value' : ' no default value'}`)
    setDefinitionOfNode(graph, writtenNode)
    define(writtenNode, LocalScope, down.environments)
  }

  // TODO: defined-by for default values

  return {
    activeNodes:  [],
    in:           defaultValue === undefined ? [] : [...defaultValue.in, ...defaultValue.activeNodes, ...name.in],
    out:          [...(defaultValue?.out ?? []), ...name.out, ...name.activeNodes],
    graph:        graph,
    environments: name.environments, // TODO: merge with arguments
    ast:          down.ast,
    scope:        down.activeScope
  }
}
