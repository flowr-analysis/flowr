import { BuiltInEnvironment, IEnvironment } from "../../dataflow/environments/environment";
import { DataflowGraph } from "../../dataflow/graph/graph";
import { DataflowGraphVertexInfo } from "../../dataflow/graph/vertex";
import * as v8 from 'v8'
import { jsonReplacer } from "../../util/json";
import { Identifier, IdentifierDefinition } from "../../dataflow/environments/identifier";
import sizeof from "object-sizeof";

/* we have to kill all processors linked in the default environment as they cannot be serialized and they are shared anyway */
function killBuiltInEnv(env: IEnvironment | undefined): IEnvironment {
   if(env === undefined) {
      return undefined as unknown as IEnvironment
   } else if(env.id === BuiltInEnvironment.id) {
      /* in this case, the reference would be shared for sure */
      return {
         id: env.id,
         parent: killBuiltInEnv(env.parent),
         memory: new Map<Identifier, IdentifierDefinition[]>()
      }
   }
   return {
      id: env.id,
      parent: killBuiltInEnv(env.parent),
      memory: env.memory
   }
}

/** Returns the size of the given df graph in bytes (without sharing in-memory) */
export function getSizeOfDfGraph(df: DataflowGraph): number {
   const verts = []
   for(const [, v] of df.vertices(true)) {
      let vertex: DataflowGraphVertexInfo = v
      if('environment' in v && v.environment !== undefined) {
         vertex = {
            ...v,
            environment: {
               ...v.environment,
               current: killBuiltInEnv(v.environment.current)
            }
         } as DataflowGraphVertexInfo
      }
      verts.push(vertex)
   }
   const k = v8.serialize([...verts, ...df.edges()])
   console.log(k.byteLength);
   console.log(sizeof(df));
   
   console.log(JSON.stringify(v8.deserialize(k), jsonReplacer));
   
   return k.byteLength
}