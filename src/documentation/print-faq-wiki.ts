import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { FlowrWikiBaseRef, getFilePathMd } from './doc-util/doc-files';
import { codeBlock } from './doc-util/doc-code';

function print(): string {
	return `${autoGenHeader({ filename: module.filename, purpose: 'frequently asked questions' })}
	
## 💮 *flowR* FAQ

### 🧑‍💻 *flowR* Development

${qAndA('What are test labels and how do they work?', `
Tests are labeled based on the *flowR* capabilities that they test for. The list of supported capabilities can be found on the [Capabilities](${FlowrWikiBaseRef}/Capabilities) wiki page. For more extensive information on test labels, see the [test labels wiki section](${FlowrWikiBaseRef}/Linting-and-Testing#test-labels).
`)}

${qAndA('How do I generate mermaid diagrams?', `
There are several ways to generate mermaid diagrams based on the input data that you want to use.
- From the AST (abstract syntax tree): ${getFilePathMd('../util/mermaid/ast.ts')}
- From the CFG (control flow graph): ${getFilePathMd('../util/mermaid/cfg.ts')}
- From the DFG (dataflow graph): ${getFilePathMd('../util/mermaid/dfg.ts')}
`)}

${qAndA('How do I create new wiki pages?', `
To create an automatically generated wiki page, you can follow these steps:
- Createa a new file in \`src/documentation\` with a name like \`print-my-page-wiki.ts\`.
- Add a new wiki generation script to the ${getFilePathMd('../../package.json')}. You can copy one of the existing ones of the form \`"wiki:my-page": "ts-node src/documentation/print-my-page-wiki.ts"\`.
- Add the wiki generation script to the \`broken-links-and-wiki.yml\` GitHub workflow file to enable automatic generation through the CI. You can copy one of the existing ones of the form \`update_page wiki/"My page" wiki:my-page\`.

You can test your page by piping the wiki generation script to a file. For example, you can run the following command:
${codeBlock('shell', 'npm run --silent wiki:my-page > __my-page.md')}
`)}
Remember not to commit this file, as it's only meant for testing.

## 🇷 R FAQ

### 📦 R Packages

${qAndA('What is the R prelude and R base package?', `
The base package contains lots of base functions like \`source\` for example. 
The R prelude includes the base package along with several other packages.
Packages that were loaded by the prelude can be called without prefixing the function call with the package name and the \`::\` operator. 

The packages loaded by the R prelude can be seen in the \`attached base packages\` sections in the output of \`sessionInfo()\`.
`)}

${qAndA('How to get documentation for a function or package?', `
There are a couple of ways to get documentation for a function or package. 

🖥️ Firstly, if you have already installed the package the function originated from you can simply run \`?<package name>::<function name>\` in an R session to print the 
relevant documentation. If you don't know the origin of the package, you can use 
\`??<function name>\` in an R shell to fuzzy find all documentations containing 
\`<function name>\` or something similar. 

🌐 Secondly, if you don't have or don't want to install the package you can simply google the fully qualified name of the function. Good sources include \`rdrr.io\`
or \`rdocumentation.org\`. Additionally, the package documentation PDF can also
be downloaded directly from \`cran\`.  
`)}

    `.trim();
}

function qAndA(question: string, answer: string): string {
	return `<details>
<summary><strong>${question}</strong></summary>

${answer.trim()}

</details>`;
}

if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);
	console.log(print());
}
