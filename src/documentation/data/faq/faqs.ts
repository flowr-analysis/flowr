import { FaqStore } from './wiki-faq-store';
import { FlowrGithubBaseRef, FlowrGithubGroupName, FlowrWikiBaseRef, getFilePathMd } from '../../doc-util/doc-files';
import { codeBlock } from '../../doc-util/doc-code';
import { recommendedVsCodeTask, recommendedZedConfig } from './recommended-configs';


/**
 *
 */
export function registerFaqs(): FaqStore {
	const wikiFaq = new FaqStore();

	wikiFaq.withTopic('flowr.development')
		.addFaq('What are *test labels*?', `
Tests are labeled based on the *flowR* capabilities that they test for.
The list of supported capabilities can be found on the [Capabilities](${FlowrWikiBaseRef}/Capabilities) wiki page.
For more extensive information on test labels, see the [test labels wiki section](${FlowrWikiBaseRef}/Linting-and-Testing#test-labels).
`)
		.addFaq('How to get a REPL with debug-info/*hot-reload*?', `
	To enter the development repl, execute \`npm run main-dev\` in contrast to \`npm run flowr\`
	this will use an unminified build (keeping debug info) and also watches the source files for changes.
	In case of a change, this mode automatically recompiles.
	Please note, that this may have negative performance implications (so do not use this for e.g., benchmarking).
`)
		.addFaq('How to generate *mermaid diagrams*?', `
There are several ways to generate mermaid diagrams based on the input data that you want to use.
- From the AST (abstract syntax tree): ${getFilePathMd('../util/mermaid/ast.ts')}
- From the CFG (control flow graph): ${getFilePathMd('../util/mermaid/cfg.ts')}
- From the DFG (dataflow graph): ${getFilePathMd('../util/mermaid/dfg.ts')}
`)
		.addFaq('How to create *new wiki* pages?', `
To create an automatically generated wiki page, you can follow these steps:
- Create a new file in \`src/documentation\` with a name like \`print-my-page-wiki.ts\`.
- Add a new wiki generation script to the ${getFilePathMd('../../package.json')}. You can copy one of the existing ones of the form \`"wiki:my-page": "ts-node src/documentation/print-my-page-wiki.ts"\`.
- Add the wiki generation script to the \`broken-links-and-wiki.yml\` GitHub workflow file to enable automatic generation through the CI. You can copy one of the existing ones of the form \`update_page wiki/"My page" wiki:my-page\`.

You can test your page by piping the wiki generation script to a file. For example, you can run the following command:
${codeBlock('shell', 'npm run --silent wiki:my-page > __my-page.md')}

Remember not to commit this file, as it's only meant for testing.
`)
		.addFaq('Why can\'t I pass *arguments* when running flowR *with npm*?', `
With \`npm\` you have to pass arguments in a specific way. The \`--\` operator is used to separate the \`npm\` arguments from the script arguments. For example, if you want to run \`flowR\` with the \`--help\` argument, you can use the following command:
${codeBlock('shell', 'npm run flowR -- --help')}
`)
		.addFaq('How to do *logging* in flowR?', `
Check out the [Logging Section in the Linting and Testing wiki page](${FlowrWikiBaseRef}/Linting-and-Testing#logging) for more information on how to do logging in *flowR*.
`)
	;

	wikiFaq.withTopic('flowr.use')
		.addFaq('How to *query* an R project?', `
For this you can use flowR's [Query API](${FlowrWikiBaseRef}/Query-API).
If you want to create your own project using flowR as a library, check out the
[${FlowrGithubGroupName}/sample-analyzer-project-query](${FlowrGithubBaseRef}/sample-analyzer-project-query) repository for an example project setup.
		`);

	wikiFaq.withTopic('r.packages')
		.addFaq('What is the R *prelude* and R *base* package?', `
The base package contains lots of base functions like \`source\` for example.
The R prelude includes the base package along with several other packages.
Packages that were loaded by the prelude can be called without prefixing the
function call with the package name and the \`::\` operator.

The packages loaded by the R prelude can be seen in the \`attached base packages\`
sections in the output of \`sessionInfo()\`.
`)
		.addFaq('How to get *documentation* for a function or package?', `
There are a couple of ways to get documentation for a function or package.

🖥️ Firstly, if you have already installed the package the function originated from you can simply run \`?<package name>::<function name>\` in an R session to print the
relevant documentation. If you don't know the origin of the package, you can use
\`??<function name>\` in an R shell to fuzzy find all documentations containing
\`<function name>\` or something similar.

🌐 Secondly, if you don't have or don't want to install the package you can simply google the fully qualified name of the function. Good sources include [rdrr.io](https://rdrr.io/)
or [rdocumentation.org](https://rdocumentation.org/). Additionally, the package documentation PDF can also
be downloaded directly from [cran](https://cran.r-project.org/).
`)
	;

	wikiFaq.withTopic('editor.configs')
		.addFaq('How can I make eslint and ZED work together?', `Use this project config (\`.zed/settings.json\`) to disable all formatters except eslint:
			${codeBlock('json', JSON.stringify(recommendedZedConfig, null, 2))}`);

	wikiFaq.withTopic('editor.configs')
		.addFaq('How can I launch the flowr repl form vs code?', `You can use the following launch task (\`.vscode/launch.json\`):
			${codeBlock('json', JSON.stringify(recommendedVsCodeTask, null, 2))}`);

	return wikiFaq;
}
