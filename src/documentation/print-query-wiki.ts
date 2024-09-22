import { RShell } from '../r-bridge/shell';
import { flowrVersion } from '../util/version';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { executeQueries } from '../queries/query';
import { FlowrWikiBaseRef, getFilePathMd } from './doc-util/doc-files';
import { showQuery } from './doc-util/doc-query';
import { CallTargets } from '../queries/call-context-query/call-context-query-format';
import { describeSchema } from '../util/schema';
import { QueriesSchema } from '../queries/query-schema';
import { markdownFormatter } from '../util/ansi';

const fileCode = `
library(ggplot)
library(dplyr)
library(readr)

# read data with read_csv
data <- read_csv('data.csv')
data2 <- read_csv('data2.csv')

mean <- mean(data$x) 
print(mean)

data %>%
	ggplot(aes(x = x, y = y)) +
	geom_point()
	
print(mean(data2$k))
`.trim();

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	const currentDateAndTime = new Date().toISOString().replace('T', ', ').replace(/\.\d+Z$/, ' UTC');
	return `_This document was generated automatically from '${module.filename}' on ${currentDateAndTime} presenting an overview of flowR's dataflow graph (version: ${flowrVersion().format()}, samples generated with R version ${rversion})._

This page briefly summarizes flowR's query API, represented by the ${executeQueries.name} function in ${getFilePathMd('../queries/query.ts')}.
Please see the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information on how to access this API (TODO TODO TODO).

First, consider that you have a file like the following (of course, this is just a simple and artificial example):

\`\`\`r
${fileCode}
\`\`\`

<details> <summary>Dataflow Graph of the Example</summary>

${await printDfGraphForCode(shell, fileCode, { showCode: false })}

</details>

&nbsp;

Additionally, consider that you are interested in all function calls which loads data with \`read_csv\`.
A simple \`regex\`-based query could look like this: \`^read_csv$\`.
However, this fails to incorporate
 
1. Syntax-based information (comments, strings, used as a variable, called as a higher-order function, ...)
2. Semantic information (e.g., \`read_csv\` is overwritten by a function with the same name)
3. Context information (e.g., calls like \`points\` may link to the current plot)

To solve this, flowR provides a query API which allows you to specify queries on the dataflow graph.
For the specific use-case stated, you could use the [Call-Context Query](#call-context-query) to find all calls to \`read_csv\` which refer functions that are not overwritten.

Just as an example, the following [Call-Context Query](#call-context-query) finds all calls to \`read_csv\` that are not overwritten:

${await showQuery(shell, fileCode, [{ type: 'call-context', callName: '^read_csv$', callTargets: CallTargets.OnlyGlobal, kind: 'input', subkind: 'csv-file' }], { showCode: false })}

## The Query Format

Queries are JSON arrays of query objects, each of which uses a \`type\` property to specify the query type.
	
The following query types are currently supported:

${'' /* TODO: automate */}
1. [Call-Context Query](#call-context-query)	
2. [Compound Query (virtual)](#compound-query)

TODO TOOD TODO get thef format to work


<details>


<summary>Detailed Query Format</summary>

${
	describeSchema(QueriesSchema, markdownFormatter)
}

</details>

### Supported Queries

#### Call-Context Query

### Supported Virtual Queries

#### Compound Query



`;
}

/** if we run this script, we want a Markdown representation of the capabilities */
if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);

	const shell = new RShell();
	void getText(shell).then(str => {
		console.log(str);
	}).finally(() => {
		shell.close();
	});
}
