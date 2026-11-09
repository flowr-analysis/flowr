import { assert, describe, test } from 'vitest';
import { statedSignatureOf, statedSignatures } from '../../../../src/dataflow/environments/default-builtin-config';
import { label } from '../../_helper/label';

/** the formals of R 4.6.1, as `names(formals(f))` gives them (`formals(args(f))` for primitives), `write.csv` handing its dots to `write.table` */
const FormalsOfR: readonly (readonly [pkg: string, name: string, formals: string, stated?: string])[] = [
	['base', 'commandArgs', 'trailingOnly'],
	['base', 'scale', 'x,center,scale'],
	['utils', 'combn', 'x,m,FUN,simplify,...'],
	['stats', 'kmeans', 'x,centers,iter.max,nstart,algorithm,trace'],
	['base', 'rapply', 'object,f,classes,deflt,how,...'],
	['base', 'sapply', 'X,FUN,...,simplify,USE.NAMES'],
	['base', 'vapply', 'X,FUN,FUN.VALUE,...,USE.NAMES'],
	['base', 'match.arg', 'arg,choices,several.ok'],
	['base', 'paste', '...,sep,collapse,recycle0'],
	['base', 'format', 'x,...'],
	['base', 'sink', 'file,append,type,split'],
	['grDevices', 'png', 'filename,width,height,units,pointsize,bg,res,...,type,antialias'],
	['grDevices', 'dev.off', 'which'],
	['base', 'plot', 'x,y,...'],
	['graphics', 'lines', 'x,...'],
	['base', 'sample', 'x,size,replace,prob'],
	['base', 'set.seed', 'seed,kind,normal.kind,sample.kind'],
	['base', 'options', '...'],
	['base', 'Sys.setenv', '...'],
	['utils', 'read.csv', 'file,header,sep,quote,dec,fill,comment.char,...'],
	['utils', 'write.csv', '...', 'x,file,append,quote,sep,eol,na,dec,row.names,col.names,qmethod,fileEncoding'],
	['base', 'cat', '...,file,sep,fill,labels,append'],
	['base', 'print', 'x,...'],
	['base', 'strsplit', 'x,split,fixed,perl,useBytes'],
	['base', 'gsub', 'pattern,replacement,x,ignore.case,perl,fixed,useBytes'],
	['base', 'seq', '...'],
	['base', 'rep', 'x,...'],
	['base', 'apply', 'X,MARGIN,FUN,...,simplify'],
	['base', 'do.call', 'what,args,quote,envir'],
	['base', 'Reduce', 'f,x,init,right,accumulate,simplify']
];

describe('Stated formals', () => {
	const stated = statedSignatures();
	test.each(FormalsOfR.map(([pkg, name, formals, forwarded]) => [`${pkg}::${name}`, pkg, name, forwarded ?? formals] as const))(
		label('%s names the formals of R', ['name-normal'], ['other']), (_label, pkg, name, formals) => {
			const sig = statedSignatureOf(stated, name, pkg);
			assert.strictEqual(sig?.pkg, pkg);
			assert.strictEqual(sig?.args?.map(([formal]) => formal).join(','), formals);
		});
});
