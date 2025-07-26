import type { ReplCommand } from './repl-main';
import { findSource } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import fs from 'fs';
import csvParser from 'csv-parser';
import type {
	RohdeTypes,
	TurcotteCsvRow
} from '../../../typing/adapter/turcotte-types';
import {
	dumpRohdeTypesFromTurcotte,
	recoverRohdeTypesFromTurcotteFromDump,
	turcotte2RohdeTypes
} from '../../../typing/adapter/turcotte-types';
import { splitAtEscapeSensitive } from '../../../util/text/args';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';


export const replTurcotteTypeParseCommand: ReplCommand = {
	description:  'Give me a file to read from and I will happily print you the types in the Rohde System!',
	usageExample: ':turcotte-type-parse foo.csv out.data',
	aliases:      [ 'ttp',],
	script:       false,
	fn:           async(output, _shell, remainingLine) => {
		const now = new Date();
		if(!remainingLine.trim()) {
			output.stderr('Please provide a file to read from. You do not need a prefix, just the file path.');
			return;
		}
		const args = splitAtEscapeSensitive(remainingLine.trim());
		if(args.length < 1 || args.length > 2) {
			output.stderr(`Expected a single file to read from and and optional one to write to, got: ${JSON.stringify(args)}`);
			return;
		}
		const [readFilePath, writeFilePath] = args as [string, string | undefined];
		const readFile = findSource(readFilePath.trim(), { referenceChain: [] });
		if(readFile?.length !== 1) {
			output.stderr(`Could not find a single file to read from. Got: ${JSON.stringify(readFile)}`);
			return;
		}
		const writeFile = writeFilePath ? findSource(writeFilePath.trim(), { referenceChain: [] }) : undefined;
		if(writeFilePath && writeFile && writeFile.length > 0) {
			output.stderr(`The output file already exists, will not overwrite: ${writeFilePath}`);
			return;
		}


		const data: TurcotteCsvRow[] = [];
		await new Promise(resolve => {
			fs.createReadStream(readFile[0], { encoding: 'utf-8' })
				.pipe(csvParser({ separator: ',' }))
				.on('data', (row: TurcotteCsvRow) => {
					data.push(row);
				})
				.on('end', () => resolve(null));
		});
		const rohdeTypes: RohdeTypes = turcotte2RohdeTypes(data);

		output.stdout(`Parsed ${rohdeTypes.info.length} functions from ${readFile[0]} in ${Date.now() - now.getTime()}ms.`);

		if(writeFilePath) {
			const startWrite = Date.now();
			fs.writeFileSync(writeFilePath, compressToUTF16(dumpRohdeTypesFromTurcotte(rohdeTypes)), { encoding: 'utf-16le' });
			output.stdout(`Wrote ${rohdeTypes.info.length} functions to ${writeFilePath} in ${Date.now() - startWrite}ms.`);
			const startRead = Date.now();
			const loadCheck = decompressFromUTF16(fs.readFileSync(writeFilePath, { encoding: 'utf-16le' }));
			const recovered = recoverRohdeTypesFromTurcotteFromDump(loadCheck);
			output.stdout(`[Test] Recovered ${recovered.info.length} functions from ${writeFilePath} in ${Date.now() - startRead}ms.`);
		}
	}
};

