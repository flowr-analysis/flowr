import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';

function print(): string {
	return `${autoGenHeader({ filename: module.filename, purpose: 'frequently asked questions' })}
	
## 💮 *flowR* FAQ
There are no common questions here yet! Feel free to let us know through an issue if you have any questions.

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
