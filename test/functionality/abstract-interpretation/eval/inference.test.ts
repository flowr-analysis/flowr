import { assert, describe, test } from 'vitest';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import type { FlowrConfigOptions } from '../../../../src/config';
import { defaultConfigOptions } from '../../../../src/config';
import type { DEFAULT_DATAFLOW_PIPELINE } from '../../../../src/core/steps/pipeline/default-pipelines';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { extractCfg } from '../../../../src/control-flow/extract-cfg';
import type { StringDomainInfo } from '../../../../src/abstract-interpretation/eval/visitor';
import type { NormalizedAst, ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { PipelineOutput } from '../../../../src/core/steps/pipeline/pipeline';
import { inferStringDomains } from '../../../../src/abstract-interpretation/eval/inference';
import { SingleSlicingCriterion, slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { RShell } from '../../../../src/r-bridge/shell';
import { SDValue, Top } from '../../../../src/abstract-interpretation/eval/domain';
import { sdEqual } from '../../../../src/abstract-interpretation/eval/equality';

function assertStringDomain(
	name: string,
	stringDomain: FlowrConfigOptions["abstractInterpretation"]["string"]["domain"],
	input: string,
	criterion: SingleSlicingCriterion,
	expectedDomain: SDValue,
) {
  console.log(input);
  test(name, async () => {
    const shell = new RShell();
  	const output: PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE> = await createDataflowPipeline(shell, { request: requestFromInput(input) }, defaultConfigOptions).allRemainingSteps();
  	const dfg = output.dataflow.graph;
  	const normalizedAst: NormalizedAst<ParentInformation & StringDomainInfo> = output.normalize;
  	const controlFlow = extractCfg(normalizedAst, defaultConfigOptions, dfg);
  	const config: FlowrConfigOptions = {
  		...defaultConfigOptions,
  		abstractInterpretation: {
  			...defaultConfigOptions.abstractInterpretation,
  			string: {
  				domain: stringDomain
  			},
  		},
  	};

  	inferStringDomains(controlFlow, dfg, normalizedAst, config);
  	const nodeId = slicingCriterionToId(criterion, normalizedAst.idMap);
		const node = normalizedAst.idMap.get(nodeId);
		const value = node?.info.sdvalue;
		assert(value !== undefined);
		assert(sdEqual(value, expectedDomain), `Expected ${JSON.stringify(expectedDomain)} but got ${JSON.stringify(value)}`);
  })
}

describe('string-domain-inference', () => {
  describe('const-set', () => {
    assertStringDomain(
    	'assignment',
    	"const-set",
    	'a <- "foo"',
    	"1@a",
    	{ kind: 'const-set', value: ['foo'] },
    );

    assertStringDomain(
    	'indirect assignment',
    	"const-set",
    	'a <- "foo"\nb <- a',
    	"2@b",
    	{ kind: 'const-set', value: ['foo'] },
    );

    assertStringDomain(
    	'reassignment',
    	"const-set",
    	'a <- "foo"\na <- "bar"',
    	"2@a",
    	{ kind: 'const-set', value: ['bar'] },
    );

    assertStringDomain(
    	'conditional assignment',
    	"const-set",
    	'a <- "foo"\nif (x) { a <- "bar" }\na',
    	"3@a",
    	{ kind: 'const-set', value: ['foo', 'bar'] },
    );

    assertStringDomain(
    	'if true branch',
    	"const-set",
    	'if(TRUE) { "foo" } else { "bar" }',
    	"1:1",
    	{ kind: 'const-set', value: ['foo'] },
    );  

    assertStringDomain(
    	'if false branch',
    	"const-set",
    	'if(FALSE) { "foo" } else { "bar" }',
    	"1:1",
    	{ kind: 'const-set', value: ['bar'] },
    );

    assertStringDomain(
    	'if else',
    	"const-set",
    	'if(a) { "foo" } else { "bar" }',
    	"1:1",
    	{ kind: 'const-set', value: ['foo', 'bar'] },
    );

    type VarType = "literal" | "variable" | "unknown";
    type GeneratedVar = {
      type: VarType;
      definition: string;
      reference: string;
      value: string[] | undefined;
    };
    
    let i = 0;
    function generate(type: VarType): GeneratedVar {
      i++;
      if (type === "literal") {
        return {
          type,
          definition: '',
          reference: `"foo${i}"`,
          value: [`foo${i}`],
        }
      } else if (type === "variable") {
        return {
          type,
          definition: `a${i} <- if (d${i}) { "foo${i}" } else { "bar${i}" }`,
          reference: `a${i}`,
          value: [`foo${i}`, `bar${i}`],
        }
      } else if (type === "unknown") {
        return {
          type,
          definition: '',
          reference: `unknown${i}`,
          value: undefined,
        }
      } else {
        throw new Error("unreachable");
      }
    }

    function getExpected(sep: string[] | undefined, ...sets: (string[] | undefined)[]): SDValue {
      if (sets.length == 1) {
        if (sets[0] === undefined) {
          return Top
        }

        return {
          kind: "const-set",
          value: sets[0]
        }
      }

      if (sep === undefined) {
        return Top
      }

      if (sets.some(s => s === undefined)) {
        return Top
      }

      const possible = (sets as string[][]).reduce((l, r) =>
        l.flatMap(l =>
          r.flatMap(r =>
            sep.map(s =>
              `${l}${s}${r}`
            )
          )
        )
      )

      return {
        kind: "const-set",
        value: possible,
      }
    }

    const values: VarType[] = [
      "literal",
      "variable",
      "unknown"
    ];

    function assertGeneratedPaste(sep: GeneratedVar, ...args: GeneratedVar[]) {
      assertStringDomain(
      	`paste (${args.map(it => it.type).join(", ")}, sep=${sep.type})`,
      	"const-set",
      	`${sep.definition}\n${args.map(it => it.definition).join("\n")}\npaste(${args.map(it => it.reference).join(", ")}, sep=${sep.reference})`,
      	`${args.length + 2}:1`,
      	getExpected(sep.value, ...args.map(it => it.value)),
      );
    }

    for (const sep of values) {
      const vsep = generate(sep);
      for (const a of values) {
        const va = generate(a);
        for (const b of values) {
          const vb = generate(b);
          for (const c of values) {
              const vc = generate(c);
              assertGeneratedPaste(vsep, va, vb, vc);
          }
          assertGeneratedPaste(vsep, va, vb);
        }
        assertGeneratedPaste(vsep, va);
      }
    }
  })

  describe('const', () => {
    assertStringDomain(
    	'assignment',
    	"const",
    	'a <- "foo"',
    	"1@a",
    	{ kind: 'const', value: 'foo' },
    );

    assertStringDomain(
    	'indirect assignment',
    	"const",
    	'a <- "foo"\nb <- a',
    	"2@b",
    	{ kind: 'const', value: 'foo' },
    );

    assertStringDomain(
    	'reassignment',
    	"const",
    	'a <- "foo"\na <- "bar"',
    	"2@a",
    	{ kind: 'const', value: 'bar' },
    );

    assertStringDomain(
    	'conditional assignment',
    	"const",
    	'a <- "foo"\nif (x) { a <- "bar" }\na',
    	"3@a",
    	Top,
    );

    assertStringDomain(
    	'if true branch',
    	"const",
    	'if(TRUE) { "foo" } else { "bar" }',
    	"1:1",
    	{ kind: 'const', value: 'foo' },
    );  

    assertStringDomain(
    	'if false branch',
    	"const",
    	'if(FALSE) { "foo" } else { "bar" }',
    	"1:1",
    	{ kind: 'const', value: 'bar' },
    );

    assertStringDomain(
    	'if else',
    	"const",
    	'if(a) { "foo" } else { "bar" }',
    	"1:1",
    	Top,
    );

    type VarType = "literal" | "unknown";
    type GeneratedVar = {
      type: VarType;
      definition: string;
      reference: string;
      value: string | undefined;
    };
    
    let i = 0;
    function generate(type: VarType): GeneratedVar {
      i++;
      if (type === "literal") {
        return {
          type,
          definition: '',
          reference: `"foo${i}"`,
          value: `foo${i}`,
        }
      } else if (type === "unknown") {
        return {
          type,
          definition: '',
          reference: `unknown${i}`,
          value: undefined,
        }
      } else {
        throw new Error("unreachable");
      }
    }

    function getExpected(sep: string | undefined, ...sets: (string | undefined)[]): SDValue {
      if (sets.length == 1) {
        if (sets[0] === undefined) {
          return Top
        }

        return {
          kind: "const",
          value: sets[0]
        }
      }

      if (sep === undefined) {
        return Top
      }

      if (sets.some(s => s === undefined)) {
        return Top
      }

      return {
        kind: "const",
        value: (sets as string[]).join(sep),
      }
    }

    const values: VarType[] = [
      "literal",
      "unknown"
    ];

    function assertGeneratedPaste(sep: GeneratedVar, ...args: GeneratedVar[]) {
      assertStringDomain(
      	`paste (${args.map(it => it.type).join(", ")}, sep=${sep.type})`,
      	"const",
      	`${sep.definition}\n${args.map(it => it.definition).join("\n")}\npaste(${args.map(it => it.reference).join(", ")}, sep=${sep.reference})`,
      	`${args.length + 2}:1`,
      	getExpected(sep.value, ...args.map(it => it.value)),
      );
    }

    for (const sep of values) {
      const vsep = generate(sep);
      for (const a of values) {
        const va = generate(a);
        for (const b of values) {
          const vb = generate(b);
          for (const c of values) {
              const vc = generate(c);
              assertGeneratedPaste(vsep, va, vb, vc);
          }
          assertGeneratedPaste(vsep, va, vb);
        }
        assertGeneratedPaste(vsep, va);
      }
    }
  })
})
