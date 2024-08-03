import {assertDataflow, withShell} from "../../../_helper/shell";
import {setSourceProvider} from "../../../../../src/dataflow/internal/process/functions/call/built-in/built-in-source";
import {requestProviderFromFile, requestProviderFromText} from "../../../../../src/r-bridge/retriever";
import {label} from "../../../_helper/label";

describe('Simple Defs in Multiple Files', withShell(shell => {

    const sources = {
        a:         'x <- 42',
        b:         'y <- 3',
        c:         'z <- "hello"\n w <- 1',
        conflictA: 'x <- 1'
    }
    before(() => setSourceProvider(requestProviderFromText(sources)))
    after(() => setSourceProvider(requestProviderFromFile()))


    assertDataflow(label('two files', ['name-normal', 'numbers']), shell,
        'print(x + y)',

    )
}))
