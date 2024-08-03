import {assertDataflow, withShell} from "../../../_helper/shell";
import {setSourceProvider} from "../../../../../src/dataflow/internal/process/functions/call/built-in/built-in-source";
import {requestProviderFromFile, requestProviderFromText} from "../../../../../src/r-bridge/retriever";
import {label} from "../../../_helper/label";
import {DataflowGraph} from "../../../../../src/dataflow/graph/graph";
import {DataflowGraphBuilder, emptyGraph} from "../../../_helper/dataflow/dataflowgraph-builder";
import {argumentInCall, defaultEnv, EnvironmentBuilder} from "../../../_helper/dataflow/environment-builder";

describe('Simple Defs in Multiple Files', withShell(shell => {

    assertDataflow(label('two files', ['name-normal', 'numbers']), shell,
        [
            { request: 'text', content: 'x <- 42' },
            { request: 'text', content: 'y <- 3' },
            { request: 'text', content: 'print(x + y)' },
        ],
        emptyGraph()
            .use('-inline--root-request-2-1', 'x')
            .use('-inline--root-request-2-2', 'y')
            .call('2', '<-',[argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [], onlyBuiltIn: true })
            .argument('2', ['1', '0'])
            .call('-inline--root-request-1-2', '<-',  [argumentInCall('-inline--root-request-1-0'), argumentInCall('-inline--root-request-1-1')], { returns: ['-inline--root-request-1-0'], reads: [], environment: defaultEnv(), onlyBuiltIn
            : true })
            .argument('-inline--root-request-1-2', ['-inline--root-request-1-1', '-inline--root-request-1-0'])
            .argument('-inline--root-request-2-3', '-inline--root-request-2-1')
            .argument('-inline--root-request-2-3', '-inline--root-request-2-2')
            .call('-inline--root-request-2-3',  '+', [argumentInCall('-inline--root-request-2-1'), argumentInCall('-inline--root-request-2-2')], { returns: [], reads: ['-inline--root-request-2-1', '-inline--root-request-2-2'], onlyBuiltIn: true })
            .argument('-inline--root-request-2-5', '-inline--root-request-2-3')
            .call('-inline--root-request-2-5', 'print', [argumentInCall('-inline--root-request-2-3')], { returns: ['-inline--root-request-2-3'], reads: [], onlyBuiltIn: true })
            .constant('1')
            .defineVariable('0',  'x',{ definedBy: ['1', '2'] })
            .constant('-inline--root-request-1-1')
            .defineVariable('-inline--root-request-1-0',  'y', { definedBy: ['-inline--root-request-1-1', '-inline--root-request-1-2'] })
            .reads('2', '0')
    )
}))
