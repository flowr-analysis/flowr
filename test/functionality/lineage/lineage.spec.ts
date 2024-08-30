import {withShell} from "../_helper/shell";
import {PipelineExecutor} from "../../../src/core/pipeline-executor";
import {DEFAULT_DATAFLOW_PIPELINE} from "../../../src/core/steps/pipeline/default-pipelines";
import {requestFromInput} from "../../../src/r-bridge/retriever";
import type {SingleSlicingCriterion} from "../../../src/slicing/criterion/parse";
import {getLineage} from "../../../src/cli/repl/commands/lineage";
import {decorateLabelContext, label, TestLabel} from "../_helper/label";
import {NodeId} from "../../../src/r-bridge/lang-4.x/ast/model/processing/node-id";
import {assert} from "chai";
import {setEquals} from "../../../src/util/set";
import {OperatorDatabase} from "../../../src/r-bridge/lang-4.x/ast/model/operators";

describe('Test lineage', withShell(shell => {

    async function assertLineage(title: string | TestLabel, request: string, criterion: SingleSlicingCriterion, expected: NodeId[]) {
        const effectiveName = decorateLabelContext(title, ['lineage'])

        return it(effectiveName, async () => {
            const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
                shell,
                request: requestFromInput(request)
            }).allRemainingSteps()
            const lineageIds = getLineage(criterion, result.normalize, result.dataflow)
            assert.isTrue(setEquals(lineageIds, new Set(expected)), `Expected ${JSON.stringify(expected)} but got ${JSON.stringify([...lineageIds])}`)
        })
    }

    assertLineage(label('The demo lineage', [
        'name-normal', ...OperatorDatabase['<-'].capabilities, 'newlines'
    ]), `c <- x
b <- c
a <- b`, '3@a', [0, 1, 2, 3, 4, 5, 6, 7, 8])
}))
