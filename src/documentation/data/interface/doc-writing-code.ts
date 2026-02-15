import { RShell } from '../../../r-bridge/shell';
import type { GeneralDocContext } from '../../wiki-mk/doc-context';
import { FlowrAnalyzer } from '../../../project/flowr-analyzer';
import { codeBlock, codeInline } from '../../doc-util/doc-code';
import { PipelineExecutor } from '../../../core/pipeline-executor';
import { requestFromInput } from '../../../r-bridge/retriever';
import { block, details } from '../../doc-util/doc-structure';
import { TreeSitterExecutor } from '../../../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerBuilder } from '../../../project/flowr-analyzer-builder';

async function staticSliceExample() {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	analyzer.addRequest('x <- 1\ny <- x\nx');
	const result = await analyzer.query([
		{
			type:     'static-slice',
			criteria: ['3@x']
		}
	]);
	//console.log(result['static-slice']);
	return result;
}

/**
 * Explain how to write code using flowR
 */
export function explainWritingCode(_shell: RShell, ctx: GeneralDocContext): string {
	return `_flowR_ can be used as a ${ctx.linkPage('flowr:npm', 'module')} and offers several main classes and interfaces that are interesting for extension writers 
(see the ${ctx.linkPage('flowr:vscode', 'Visual Studio Code extension')} or the ${ctx.linkPage('wiki/Core')} wiki page for more information).

### Creating Analyses with _flowR_

Nowadays, instances of the ${ctx.link(FlowrAnalyzer)} should be used as central frontend to get analysis results from _flowR_.
For example, a program slice can be created like this:

${
	ctx.code(staticSliceExample, { dropLinesEnd: 2, dropLinesStart: 1, hideDefinedAt: true })
}

For more information, please have a look at the ${ctx.linkPage('wiki/Analyzer')} wiki page, which explains how to construct and use the ${ctx.link(FlowrAnalyzer)} in more detail.
To work with specific perspectives, you can also consult the respective pages like the ${ctx.linkPage('wiki/Dataflow Graph')} or the ${ctx.linkPage('wiki/Abstract Interpretation')} wiki pages.
        
### The Pipeline Executor (Low-Level Interface)

Once, in the beginning, _flowR_ was meant to produce a dataflow graph merely to provide *program slices*. 
However, with continuous updates, the ${ctx.linkPage('wiki/Dataflow Graph')} repeatedly proves to be the more interesting part.
With this, we restructured _flowR_'s originally *hardcoded* pipeline to be far more flexible. 
Now, it can be theoretically extended or replaced with arbitrary steps, optional steps, and what we call 'decorations' of these steps. 
In short, a slicing pipeline using the ${ctx.link(PipelineExecutor)} looks like this:

${
	codeBlock('ts', `
const slicer = new ${PipelineExecutor.name}(DEFAULT_SLICING_PIPELINE, {
  parser:    new ${RShell.name}(),
  request:   ${requestFromInput.name}('x <- 1\\nx + 1'),
  criterion: ['2@x']
})
const slice = await slicer.allRemainingSteps()
// console.log(slice.reconstruct.code)
`)
}

${
	details('More Information', `

If you compare this, with what you would have done with the old (and removed) \`SteppingSlicer\`, 
this essentially just requires you to replace the \`SteppingSlicer\` with the ${ctx.link(PipelineExecutor)}
and to pass the ${ctx.link('DEFAULT_SLICING_PIPELINE')} as the first argument.
The ${ctx.link(PipelineExecutor)}...

1. Provides structures to investigate the results of all intermediate steps
2. Can be executed step-by-step
3. Can repeat steps (e.g., to calculate multiple slices on the same input)

See the in-code documentation for more information.

	`)
}

### Using the ${ctx.link(RShell)} to Interact with R

The ${ctx.link(RShell)} class allows interfacing with the \`R\`&nbsp;ecosystem installed on the host system.
Please have a look at ${ctx.linkPage('wiki/Engines', 'flowR\'s Engines')} for more information on alternatives (for example, the ${ctx.link(TreeSitterExecutor)}).

${
	block({
		type:    'IMPORTANT',
		content: `
Each ${ctx.link(RShell)} controls a new instance of the R&nbsp;interpreter, 
make sure to call ${codeInline(ctx.linkM(RShell, 'close', { codeFont: false, realNameWrapper: 'i' }) + '()')} when you are done.`
	})
}

You can start a new "session" simply by constructing a new object with ${codeInline('new ' + ctx.link(RShell, { codeFont: false }) + '()')}.

However, there are several options that may be of interest 
(e.g., to automatically revive the shell in case of errors or to control the name location of the R process on the system).

With a shell object (let's call it \`shell\`), you can execute R code by using ${ctx.linkM(RShell, 'sendCommand', { realNameWrapper: 'i' })}, 
for example ${codeInline('shell.' + ctx.linkM(RShell, 'sendCommand', { codeFont: false, hideClass: true }) + '("1 + 1")')}. 
However, this does not return anything, so if you want to collect the output of your command, use
${ctx.linkM(RShell, 'sendCommandWithOutput', { realNameWrapper: 'i' })} instead.

Besides that, the command ${ctx.linkM(RShell, 'tryToInjectHomeLibPath')} may be of interest, as it enables all libraries available on the host system.


### Generate Statistics (No longer a Focus of flowR)


<details>

<summary>Adding a New Feature to Extract</summary>

In this example, we construct a new feature to extract, with the name "*example*".
Whenever this name appears, you may substitute this with whatever name fits your feature best (as long as the name is unique).

1. **Create a new file in \`src/statistics/features/supported\`**\\
   Create the file \`example.ts\`, and add its export to the \`index.ts\` file in the same directory (if not done automatically).

2. **Create the basic structure**\\
   To get a better feel of what a feature must have, let's look
   at the basic structure (of course, due to TypeScript syntax,
   there are other ways to achieve the same goal):

   \`\`\`ts
   const initialExampleInfo = {
       /* whatever start value is good for you */
       someCounter: 0
   }

   export type ExampleInfo = Writable<typeof initialExampleInfo>

   export const example: Feature<ExampleInfo> = {
    name:        'Example Feature',
    description: 'A longer example description',

    process(existing: ExampleInfo, input: FeatureProcessorInput): ExampleInfo {
      /* perform analysis on the input */
      return existing
    },

    initialValue: initialExampleInfo
   }
   \`\`\`

   The \`initialExampleInfo\` type holds the initial values for each counter that you want to maintain during the feature extraction (they will usually be initialized with 0). The resulting \`ExampleInfo\` type holds the structure of the data that is to be counted. Due to the vast amount of data processed, information like the name and location of a function call is not stored here, but instead written to disk (see below).

   Every new feature must be of the \`Feature<Info>\` type, with \`Info\` referring to a \`FeatureInfo\` (like \`ExampleInfo\` in this example). Next to a \`name\` and a \`description\`, each Feature must provide:

   - a processor that extracts the information from the input, adding it to the existing information.
   - a function returning the initial value of the information (in this case, \`initialExampleInfo\`).

3. **Add it to the feature-mapping**\\
   Now, in the \`feature.ts\` file in \`src/statistics/features\`, add your feature to the \`ALL_FEATURES\` object.

Now, we want to extract something. For the *example* feature created in the previous steps, we choose to count the amount of \`COMMENT\` tokens.
So we define a corresponding [XPath](https://developer.mozilla.org/en-US/docs/Web/XPath) query:

\`\`\`ts
const commentQuery: Query = xpath.parse('//COMMENT')
\`\`\`

Within our feature's \`process\` function, running the query is as simple as:

\`\`\`ts
const comments = commentQuery.select({ node: input.parsedRAst })
\`\`\`

Now we could do a lot of further processing, but for simplicity, we only record every comment found this way:

\`\`\`ts
appendStatisticsFile(example.name, 'comments', comments, input.filepath)
\`\`\`

We use \`example.name\` to avoid duplication with the name that we’ve assigned to the feature. It corresponds to the name of the folder in the statistics output.
\`'comments'\` refers to a freely chosen (but unique) name, that will be used as the name for the output file within the folder. The \`comments\` variable holds the result of the query, which is an array of nodes. Finally, we pass the \`filepath\` of the file that was analyzed (if known), so that it can be added to the statistics file (as additional information).

</details>
	`;
}
