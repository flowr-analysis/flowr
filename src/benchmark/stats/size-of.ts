import { BuiltInEnvironment, IEnvironment } from "../../dataflow/environments/environment";
import { Identifier, IdentifierDefinition } from "../../dataflow/environments/identifier";
import { DataflowGraph } from "../../dataflow/graph/graph";
import { DataflowGraphVertexInfo } from "../../dataflow/graph/vertex";

/** https://stackoverflow.com/a/6367736 */
function roughSizeOfObject(value: any, level = 0) {
   if(value === null || value === undefined) {
      return 0;
   }
   console.log('at', value);
   
   let bytes = 0;
   
   switch(typeof value) {
      case 'boolean': bytes = 4; break;
      case 'number': bytes = 8; break;
      case 'string': bytes = value.length * 2; break;
      case 'object':
         if(value['__visited__']) return 0;
         value['__visited__'] = 1;
         for(const i in value) {
            bytes += 8; // an assumed existence overhead
            bytes += roughSizeOfObject(value[i], level + 1);
         }
         break;
   }

   if(level == 0){
       clear__visited__(value);
   }
   return bytes;
}

function clear__visited__(value: any){
   if(typeof value == 'object'){
       delete value['__visited__'];
       for(var i in value){
           clear__visited__(value[i]);
       }
   }
}


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
   const k = [...verts, ...df.edges()]
   
   return roughSizeOfObject(k)
}