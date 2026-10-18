import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { withTreeSitter } from '../../_helper/shell';
import { assertLinterPackage } from '../../_helper/linter';
import { LintingResultCertainty } from '../../../../src/linter/linter-format';
import type { CompiledCodeKind } from '../../../../src/linter/rules/cmd-check/compiled-code';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';

const Desc = 'Package: pkg\nVersion: 1.0\nTitle: A Package\nLicense: MIT\n';
const Ns = 'useDynLib(pkg)\n';

describe('flowR linter', withTreeSitter(parser => {
	describe('compiled-code', () => {
		const AllKinds: CompiledCodeKind[] = [
			'compilation flags in Makevars', 'use of PKG_*FLAGS in Makefiles', 'use of SHLIB_OPENMP_*FLAGS in Makefiles', 'for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)',
			'for GNU extensions in Makefiles', 'include directives in Makefiles', 'line endings in Makefiles', 'line endings in C/C++/Fortran sources/headers',
			'line endings in shell scripts', 'pragmas in C/C++ headers and code', 'usage of KIND in Fortran files', 'C++ specification', 'compiled code', 'whether package can be installed'
		];
		/** lints the files, looking only at the given checks so that the tests do not depend on each other's concerns */
		const lintOnly = (...kinds: CompiledCodeKind[]) => (name: string, files: Record<string, string | null>, expected: Record<string, unknown>[], config: Record<string, unknown> = {}) =>
			assertLinterPackage(name, parser, 'x <- 1', 'compiled-code', expected, { files: { NAMESPACE: Ns, ...files }, skip: AllKinds.filter(k => !kinds.includes(k)), ...config });
		let lint = lintOnly(...AllKinds);
		const at = (file: string, line: number) => [line, 1, line, 1, `/pkg/${file}`];
		const flagsKind = 'compilation flags in Makevars';

		describe('compilation flags in Makevars', () => {
			lint = lintOnly('compilation flags in Makevars');
			lint('non-portable flags', { 'src/Makevars': 'PKG_CXXFLAGS = -O3 -Wall -fPIC\n' }, [
				{ kind: flagsKind, file: 'src/Makevars', loc: at('src/Makevars', 1), message: 'Non-portable flags in variable \'PKG_CXXFLAGS\': -O3 -Wall -fPIC', certainty: LintingResultCertainty.Certain }
			]);
			lint('-Wl flags are fine', { 'src/Makevars': 'PKG_LIBS = -Wl,--no-as-needed\nPKG_CFLAGS = -DFOO -I../inst\n' }, []);
			lint('Werror, march and Wno', { 'src/Makevars': 'PKG_CFLAGS = -Werror -march=native -Wno-unused\n' }, [{ message: 'Non-portable flags in variable \'PKG_CFLAGS\': -Werror -march=native -Wno-unused' }]);
			lint('reports the line of the assignment', { 'src/Makevars': '# a comment\n\nPKG_CPPFLAGS = -std=c++11\n' }, [{ loc: at('src/Makevars', 3), message: 'Non-portable flags in variable \'PKG_CPPFLAGS\': -std=c++11' }]);
			lint('appending and variable expansion', { 'src/Makevars': 'OPT = -O2\nPKG_CFLAGS = -DX\nPKG_CFLAGS += $(OPT)\n' }, [{ message: 'Non-portable flags in variable \'PKG_CFLAGS\': -O2' }]);
			lint('unknown variables expand to nothing', { 'src/Makevars': 'PKG_CXXFLAGS = $(SHLIB_OPENMP_CXXFLAGS)\n' }, []);
			lint('continuation lines', { 'src/Makevars': 'PKG_CFLAGS = -DX \\\n  -g\n' }, [{ loc: at('src/Makevars', 1), message: 'Non-portable flags in variable \'PKG_CFLAGS\': -g' }]);
			lint('Fortran -std=f is allowed', { 'src/Makevars': 'PKG_FFLAGS = -std=f2008\nPKG_FCFLAGS = -std=gnu\n' }, [{ message: 'Non-portable flags in variable \'PKG_FCFLAGS\': -std=gnu' }]);
			lint('target specific flags', { 'src/Makevars': 'foo.o: PKG_CFLAGS = -O3 -DX\n' }, [{ message: 'Non-portable flags in file \'src/Makevars\': -O3' }]);
			lint('overriding user settings', { 'src/Makevars': 'CXXFLAGS = -g\n' }, [{ message: 'Variables overriding user/site settings: CXXFLAGS: -g' }]);
			lint('both Makevars.in and Makevars', { 'src/Makevars.in': 'PKG_LIBS = @LIBS@\n', 'src/Makevars': 'PKG_LIBS =\n' }, [{ kind: flagsKind, file: 'src/Makevars', loc: at('src/Makevars', 1) }]);
			lint('allowed flags', { 'src/Makevars': 'PKG_CFLAGS = -O3 -g\n' }, [{ message: 'Non-portable flags in variable \'PKG_CFLAGS\': -g' }], { allowedFlags: ['-O3'] });
			lint('additional non-portable flag', { 'src/Makevars': 'PKG_CFLAGS = -DX -DY\n', 'src/a.c': 'int a;\n' }, [{ message: 'Non-portable flags in variable \'PKG_CFLAGS\': -DX' }], { nonPortableFlags: ['DX'] });
			lint('check can be skipped', { 'src/Makevars': 'PKG_CFLAGS = -O3\n', 'src/a.c': 'int a;\n' }, [], { skip: [flagsKind] });
			lint('Makevars.win is not evaluated', { 'src/Makevars.win': 'PKG_CFLAGS = -O3\n' }, []);
		});

		describe('Makefiles', () => {
			lint = lintOnly('for GNU extensions in Makefiles', 'include directives in Makefiles', 'line endings in Makefiles');
			const gnu = 'for GNU extensions in Makefiles';
			lint('GNU extension', { 'src/Makevars': 'SRC = $(wildcard *.c)\nOBJECTS = $(SRC:.c=.o)\n' }, [{ kind: gnu, file: 'src/Makevars', loc: at('src/Makevars', 1) }]);
			lint('GNU append operator', { 'src/Makevars': 'PKG_LIBS = -lz\nPKG_LIBS += -lm\n' }, [{ kind: gnu, loc: at('src/Makevars', 2) }]);
			lint('conditional', { 'src/Makevars': 'ifeq ($(OS),Windows)\nendif\n' }, [{ kind: gnu }]);
			lint('commented GNU construct', { 'src/Makevars': '# SRC := $(shell ls)\nPKG_LIBS = -lz\n' }, []);
			lint('GNU make as system requirement', { 'src/Makevars': 'X := 1\n', 'DESCRIPTION': Desc + 'SystemRequirements: GNU make\n' }, []);
			lint('portable Makefile', { 'src/Makevars': 'PKG_LIBS = -lz\n' }, []);
			lint('include with R_HOME', { 'src/Makefile': 'include $(R_HOME)/etc/Makeconf\n' }, [{ kind: 'include directives in Makefiles', file: 'src/Makefile', loc: at('src/Makefile', 1) }]);
			lint('include without R_HOME', { 'src/Makefile': 'include local.mk\n' }, []);
			lint('CRLF Makefile', { 'src/Makevars': 'PKG_LIBS = -lz\r\nPKG_CPPFLAGS = -DX\r\n' }, [{ kind: 'line endings in Makefiles', file: 'src/Makevars', loc: at('src/Makevars', 1) }]);
			lint('Makefile without final LF', { 'src/Makevars': 'PKG_LIBS = -lz' }, [{ kind: 'line endings in Makefiles', loc: at('src/Makevars', 1) }]);
			lint('toplevel Makefile is checked too', { 'Makefile': 'all:\r\n' }, [{ kind: 'line endings in Makefiles', file: 'Makefile' }]);
		});

		describe('BLAS and LAPACK', () => {
			lint = lintOnly('for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)');
			const kind = 'for portable use of $(BLAS_LIBS) and $(LAPACK_LIBS)';
			lint('LAPACK without BLAS', { 'src/Makevars': 'PKG_LIBS = $(LAPACK_LIBS)\n' }, [
				{ kind, message: 'Apparently using $(LAPACK_LIBS) without following $(BLAS_LIBS) in \'src/Makevars\'', loc: at('src/Makevars', 1) }
			]);
			lint('BLAS without FLIBS', { 'src/Makevars': 'PKG_LIBS = $(BLAS_LIBS)\n' }, [{ kind, message: 'Apparently using $(BLAS_LIBS) without following $(FLIBS) in \'src/Makevars\'' }]);
			lint('the full chain', { 'src/Makevars': 'PKG_LIBS = $(LAPACK_LIBS) $(BLAS_LIBS) $(FLIBS)\n' }, []);
			lint('Fortran sources are exempt', { 'src/Makevars': 'PKG_LIBS = $(LAPACK_LIBS)\n', 'src/a.f': '      end\n' }, []);
			lint('joins continuation lines', { 'src/Makevars': 'PKG_LIBS = $(LAPACK_LIBS) \\\n  $(BLAS_LIBS) $(FLIBS)\n' }, []);
		});

		describe('PKG_*FLAGS', () => {
			lint = lintOnly('use of PKG_*FLAGS in Makefiles');
			const kind = 'use of PKG_*FLAGS in Makefiles';
			lint('C flags without C files', { 'src/Makevars': 'PKG_CFLAGS = -DX\n', 'src/a.cpp': 'int a;\n' }, [{ kind, message: 'PKG_CFLAGS set in \'src/Makevars\' without any corresponding files', loc: at('src/Makevars', 1) }]);
			lint('C++ flags with C++ files', { 'src/Makevars': 'PKG_CXXFLAGS = -DX\n', 'src/a.cpp': 'int a;\n' }, []);
			lint('CPP flags need C or C++', { 'src/Makevars': 'PKG_CPPFLAGS = -DX\n', 'src/a.f90': 'end\n' }, [{ kind, message: 'PKG_CPPFLAGS set in \'src/Makevars\' without any corresponding files' }]);
			lint('Fortran flags', { 'src/Makevars.win': 'PKG_FFLAGS = -DX\n', 'src/a.c': 'int a;\n' }, [{ kind, file: 'src/Makevars.win' }]);
		});

		describe('SHLIB_OPENMP_*FLAGS', () => {
			lint = lintOnly('use of SHLIB_OPENMP_*FLAGS in Makefiles');
			const kind = 'use of SHLIB_OPENMP_*FLAGS in Makefiles';
			lint('matching macros', { 'src/Makevars': 'PKG_CXXFLAGS = $(SHLIB_OPENMP_CXXFLAGS)\nPKG_LIBS = $(SHLIB_OPENMP_CXXFLAGS)\n', 'src/a.cpp': 'int a;\n' }, []);
			lint('macro missing in PKG_LIBS', { 'src/Makevars': 'PKG_CXXFLAGS = $(SHLIB_OPENMP_CXXFLAGS)\nPKG_LIBS = -lz\n', 'src/a.cpp': 'int a;\n' }, [
				{ kind, message: 'SHLIB_OPENMP_CXXFLAGS is included in PKG_CXXFLAGS but no OPENMP macro in PKG_LIBS', loc: at('src/Makevars', 1) }
			]);
			lint('wrong language macro', { 'src/Makevars': 'PKG_CXXFLAGS = $(SHLIB_OPENMP_CFLAGS)\nPKG_LIBS = $(SHLIB_OPENMP_CFLAGS)\n', 'src/a.cpp': 'int a;\n' }, [
				{ message: 'incorrect macro SHLIB_OPENMP_CFLAGS included in PKG_CXXFLAGS' },
				{ message: 'SHLIB_OPENMP_CFLAGS is included in PKG_LIBS but linking is by C++' }
			]);
			lint('macro in PKG_CPPFLAGS', { 'src/Makevars': 'PKG_CPPFLAGS = $(SHLIB_OPENMP_CFLAGS)\nPKG_LIBS = $(SHLIB_OPENMP_CFLAGS)\n', 'src/a.c': 'int a;\n' }, [
				{ message: 'SHLIB_OPENMP_CFLAGS is included in PKG_LIBS but not in PKG_CFLAGS' },
				{ message: 'it is not portable to include SHLIB_OPENMP_* macros in PKG_CPPFLAGS; PKG_CPPFLAGS is used for both C and C++ code' }
			]);
			lint('without matching source files', { 'src/Makevars': 'PKG_CFLAGS = $(SHLIB_OPENMP_CFLAGS)\nPKG_LIBS = $(SHLIB_OPENMP_CFLAGS)\n', 'src/a.cpp': 'int a;\n' }, [
				{ message: 'SHLIB_OPENMP_CFLAGS is included in PKG_CFLAGS without any C files' },
				{ message: 'SHLIB_OPENMP_CFLAGS is included in PKG_LIBS but linking is by C++' }
			]);
			lint('Fortran FCFLAGS macro is defunct', { 'src/Makevars': 'PKG_FCFLAGS = $(SHLIB_OPENMP_FCFLAGS)\nPKG_LIBS = $(SHLIB_OPENMP_CFLAGS)\n', 'src/a.f90': 'end\n', 'src/b.c': 'int a;\n' }, [
				{ message: 'SHLIB_OPENMP_FCFLAGS is defunct (used in PKG_FCFLAGS)' }
			]);
			lint('can be skipped', { 'src/Makevars': 'PKG_CXXFLAGS = $(SHLIB_OPENMP_CXXFLAGS)\n', 'src/a.cpp': 'int a;\n' }, [], { skip: [kind] });
		});

		describe('line endings of sources', () => {
			lint = lintOnly('line endings in C/C++/Fortran sources/headers', 'line endings in shell scripts');
			const kind = 'line endings in C/C++/Fortran sources/headers';
			lint('CRLF source', { 'src/a.c': 'int a;\r\nint b;\r\n' }, [{ kind, file: 'src/a.c', loc: at('src/a.c', 1) }]);
			lint('CR found on a later line', { 'src/a.cpp': 'int a;\nint b;\r\n' }, [{ loc: at('src/a.cpp', 2) }]);
			lint('header in inst/include', { 'inst/include/a.h': '#define A\r\n' }, [{ kind, file: 'inst/include/a.h' }]);
			lint('no final newline', { 'src/a.c': 'int a;' }, [{ kind, loc: at('src/a.c', 1) }]);
			lint('Windows sources are ignored', { 'src/win/a.c': 'int a;\r\n' }, []);
			lint('LF sources are fine', { 'src/a.c': 'int a;\n', 'src/b.f90': 'end\n' }, []);
			lint('shell script', { 'configure': '#!/bin/sh\r\nexit 0\r\n' }, [{ kind: 'line endings in shell scripts', file: 'configure' }]);
		});

		describe('pragmas', () => {
			lint = lintOnly('pragmas in C/C++ headers and code');
			const kind = 'pragmas in C/C++ headers and code';
			lint('ignoring important diagnostics', { 'src/a.c': '#pragma GCC diagnostic ignored "-Wformat"\nint a;\n' }, [{ kind, message: 'File which contains pragma(s) suppressing important diagnostics', loc: at('src/a.c', 1) }]);
			lint('non-portable pragma', { 'src/a.cpp': 'int a;\n#pragma clang diagnostic ignored "-Wmaybe-uninitialized"\n' }, [
				{ message: 'File which contains non-portable pragma(s)', loc: at('src/a.cpp', 2) }, { message: 'File which contains pragma(s) suppressing diagnostics', loc: at('src/a.cpp', 2) }
			]);
			lint('other diagnostics pragma', { 'src/a.h': '  #pragma GCC diagnostic ignored "-Wunused-variable"\n' }, [{ message: 'File which contains pragma(s) suppressing diagnostics' }]);
			lint('push and pop only', { 'src/a.c': '#pragma GCC diagnostic push\n#pragma GCC diagnostic pop\n' }, []);
			lint('pragma in a header of inst/include', { 'inst/include/a.hpp': '#pragma GCC diagnostic ignored "-Warray-bounds"\n' }, [{ file: 'inst/include/a.hpp', message: 'File which contains pragma(s) suppressing important diagnostics' }]);
		});

		describe('Fortran KIND', () => {
			lint = lintOnly('usage of KIND in Fortran files');
			const kind = 'usage of KIND in Fortran files';
			lint('integer kind', { 'src/a.f90': 'integer(kind=8) :: i\n' }, [{ kind, file: 'src/a.f90', loc: at('src/a.f90', 1) }]);
			lint('upper case KIND', { 'src/a.f': '      REAL(KIND = 4) X\n' }, [{ kind }]);
			lint('named kind parameters are fine', { 'src/a.f90': 'integer(kind=dp) :: i\n' }, []);
			lint('comment lines are ignored', { 'src/a.f90': '! integer(kind=8) :: i\n' }, []);
			lint('real*8', { 'src/a.f': '      real*8 x\n' }, [{ kind, file: 'src/a.f', loc: at('src/a.f', 1) }]);
			lint('real*8 can be allowed', { 'src/a.f': '      real*8 x\n' }, [], { flagStarKinds: false });
		});

		describe('C++ specification', () => {
			lint = lintOnly('C++ specification');
			const kind = 'C++ specification';
			lint('obsolete CXX_STD', { 'src/Makevars': 'CXX_STD = CXX11\n' }, [{ kind, file: 'src/Makevars', message: 'Obsolete C++11 standard request will be ignored (CXX_STD in src/Makevars)', loc: at('src/Makevars', 1) }]);
			lint('unknown CXX_STD', { 'src/Makevars.win': 'CXX_STD = CXX15\n' }, [{ kind, message: 'Unknown C++15 standard request will be ignored (CXX_STD in src/Makevars.win)' }]);
			lint('current CXX_STD', { 'src/Makevars': 'CXX_STD = CXX17\n' }, []);
			lint('SystemRequirements with removed standard', { 'DESCRIPTION': Desc + 'SystemRequirements: C++14, libxml2\n' }, [
				{ kind, file: 'DESCRIPTION', message: 'SystemRequirements specified C++14: support has been removed', loc: at('DESCRIPTION', 5) }
			]);
			lint('SystemRequirements with invalid standard', { 'DESCRIPTION': Desc + 'SystemRequirements: C++ 3000\n' }, [{ kind, message: 'SystemRequirements: invalid C++ specification \'C++ 3000\'' }]);
			lint('SystemRequirements with current standard', { 'DESCRIPTION': Desc + 'SystemRequirements: C++17\n' }, []);
			lint('configurable obsolete standards', { 'src/Makevars': 'CXX_STD = CXX17\n' }, [{ kind }], { obsoleteCxxStandards: ['17'] });
		});

		describe('compiled code', () => {
			const base = lintOnly('compiled code');
			lint = (n, f, e, c = {}) => base(n, f, e, { checkRegistration: false, ...c });
			const kind = 'compiled code';
			lint('abort and exit', { 'src/a.c': '#include <R.h>\nvoid f(void) {\n  abort();\n  exit(1);\n}\n' }, [
				{ kind, file: 'src/a.c', loc: at('src/a.c', 3), message: 'Found \'abort\', possibly from \'abort\' (C): compiled code should not call entry points which might terminate R', certainty: LintingResultCertainty.Uncertain },
				{ kind, file: 'src/a.c', loc: at('src/a.c', 4), message: 'Found \'exit\', possibly from \'exit\' (C): compiled code should not call entry points which might terminate R', certainty: LintingResultCertainty.Uncertain }
			], { checkRegistration: false });
			lint('printf, puts and stdout', { 'src/a.c': '#include <R.h>\nvoid f(void) { printf("x"); puts("y"); fprintf(stderr, "z"); }\n' }, [
				{ message: 'Found \'printf\', possibly from \'printf\' (C): compiled code should not call entry points which writes to stdout/stderr instead of to the console' },
				{ message: 'Found \'puts\', possibly from \'puts\' (C): compiled code should not call entry points which writes to stdout/stderr instead of to the console' },
				{ message: 'Found \'stderr\', possibly from \'stderr\' (C): compiled code should not call entry points which writes to stdout/stderr instead of to the console' }
			]);
			lint('sprintf and rand', { 'src/a.c': '#include <R.h>\nvoid f(char *b) { sprintf(b, "x"); int r = rand(); }\n' }, [
				{ message: 'Found \'sprintf\', possibly from \'sprintf\' (C): compiled code should not call entry points which uses [v]sprintf' },
				{ message: 'Found \'rand\', possibly from \'rand\' (C): compiled code should not call entry points which uses the system RNG' }
			]);
			lint('Rprintf, snprintf and unif_rand are fine', { 'src/a.c': '#include <R.h>\nvoid f(char *b) { Rprintf("x"); snprintf(b, 2, "x"); unif_rand(); REprintf("e"); }\n' }, []);
			lint('comments and strings are ignored', { 'src/a.c': '/* abort(); */\n// exit(1);\nconst char *s = "printf(\\"x\\")";\nchar c = \'(\';\n' }, []);
			lint('methods are no calls', { 'src/a.cpp': 'void f(Obj o) { o.exit(1); o->abort(); Foo::rand(); }\n' }, []);
			lint('std qualified call', { 'src/a.cpp': '#include <cstdlib>\nvoid f() { std::exit(1); }\n' }, [{ loc: at('src/a.cpp', 2) }]);
			lint('C++ streams', { 'src/a.cpp': '#include <iostream>\nvoid f() { std::cout << 1; std::cerr << 2; }\n' }, [
				{ message: 'Found \'std::cout\', possibly from \'std::cout\' (C++): compiled code should not call entry points which writes to stdout/stderr instead of to the console' },
				{ message: 'Found \'std::cerr\', possibly from \'std::cerr\' (C++): compiled code should not call entry points which writes to stdout/stderr instead of to the console' }
			]);
			lint('cout after using namespace std', { 'src/a.cpp': 'using namespace std;\nvoid f() { cout << 1; }\n' }, [{ loc: at('src/a.cpp', 2) }]);
			lint('each symbol once per file', { 'src/a.c': 'void f() { abort(); }\nvoid g() { abort(); }\n' }, [{ loc: at('src/a.c', 1) }]);
			lint('Fortran I/O and stop', { 'src/a.f90': 'subroutine f()\n  print *, 1\n  write(*,*) 2\n  stop\nend subroutine\n' }, [
				{ message: 'Found \'print\', possibly from \'print\' (Fortran): compiled code should not call entry points which uses Fortran I/O' },
				{ message: 'Found \'write\', possibly from \'write\' (Fortran): compiled code should not call entry points which uses Fortran I/O' },
				{ message: 'Found \'stop\', possibly from \'stop\' (Fortran): compiled code should not call entry points which might terminate R' }
			]);
			lint('Fortran comments', { 'src/a.f': 'c      write(*,*) 1\n      x = 1 ! print *, 2\n' }, []);
			lint('Fortran random numbers', { 'src/a.f90': 'call random_number(x)\n' }, [{ message: 'Found \'random_number\', possibly from \'random_number\' (Fortran): compiled code should not call entry points which uses the system RNG' }]);
			lint('additional unportable calls', { 'src/a.c': 'void f() { abort(); myfun(); }\n' }, [
				{ message: 'Found \'abort\', possibly from \'abort\' (C): compiled code should not call entry points which might terminate R' },
				{ message: 'Found \'myfun\', possibly from \'myfun\' (C): compiled code should not call entry points which writes to stdout/stderr instead of to the console' }
			], { unportableCalls: ['myfun'] });
			lint('non-API entry point', { 'src/a.c': '#include <Rinternals.h>\nSEXP f(SEXP x) { return PRVALUE(x); }\n' }, [
				{ message: 'Found non-API call to R: \'PRVALUE\'. Compiled code should not call non-API entry points in R. This entry point may be removed soon', loc: at('src/a.c', 2) }
			]);
			lint('non-API entry point through its remapped name', { 'src/a.c': '#include <Rinternals.h>\nSEXP f(SEXP x) { return findVar(x, x); }\n' }, [{ message: 'Found non-API call to R: \'Rf_findVar\'. Compiled code should not call non-API entry points in R. This entry point may be removed soon' }]);
			lint('non-API names without R headers are no findings', { 'src/a.c': 'int f(int BODY) { return BODY; }\n' }, []);
			lint('non-API check can be disabled', { 'src/a.c': '#include <Rinternals.h>\nint f(SEXP x) { return PRVALUE(x) != 0; }\n' }, [], { checkNonApi: false });
			lint('extra non-API entry point', { 'src/a.c': '#include <Rinternals.h>\nvoid f() { my_internal(); }\n' }, [{ message: 'Found non-API call to R: \'my_internal\'. Compiled code should not call non-API entry points in R. This entry point may be removed soon' }], { extraNonApiEntryPoints: ['my_internal'] });
			lint('missing registration', { 'src/a.c': '#include <R.h>\nvoid f(void) {}\n' }, [
				{ message: 'Found no call to: \'R_registerRoutines\'. It is good practice to register native routines and to disable symbol search', loc: at('src/a.c', 1) },
				{ message: 'Found no call to: \'R_useDynamicSymbols\'. It is good practice to register native routines and to disable symbol search', loc: at('src/a.c', 1) }
			], { checkRegistration: true });
			lint('registration present', { 'src/init.c': '#include <R.h>\nvoid R_init_pkg(DllInfo *d) { R_registerRoutines(d, 0, 0, 0, 0); R_useDynamicSymbols(d, FALSE); }\n' }, [], { checkRegistration: true });
			lint('registration check can be disabled', { 'src/a.c': '#include <R.h>\nvoid f(void) {}\n' }, [], { checkRegistration: false });
		});

		describe('installability', () => {
			lint = lintOnly('whether package can be installed');
			const kind = 'whether package can be installed';
			lint('compiled code without useDynLib', { 'NAMESPACE': 'export(f)\n', 'src/a.c': '#include <R.h>\n' }, [
				{ kind, file: 'NAMESPACE', message: 'The package has compiled code (\'src/a.c\') but its NAMESPACE has no useDynLib directive, so the shared object is never loaded' }
			], { checkRegistration: false });
			lint('useDynLib present', { 'src/a.c': '#include <R.h>\n' }, [], { checkRegistration: false });
			lint('commented useDynLib does not count', { 'NAMESPACE': '# useDynLib(pkg)\n', 'src/a.c': 'int a;\n' }, [{ kind }]);
			lint('header without LinkingTo', { 'src/a.cpp': '#include <Rcpp.h>\n// [[Rcpp::export]]\nint f() { return 1; }\n' }, [
				{ kind, file: 'src/a.cpp', loc: at('src/a.cpp', 1), message: 'The code includes \'Rcpp.h\' but the DESCRIPTION does not list \'Rcpp\' in LinkingTo, so the header is not found when installing' }
			], { checkRegistration: false });
			lint('header with LinkingTo', { 'DESCRIPTION': Desc + 'LinkingTo: Rcpp\n', 'src/a.cpp': '#include <Rcpp.h>\n' }, [], { checkRegistration: false });
			lint('directory prefix header', { 'src/a.cpp': '#include <boost/math/special_functions.hpp>\n#include <boost/foo.hpp>\n' }, [{ message: 'The code includes \'boost/math/special_functions.hpp\' but the DESCRIPTION does not list \'BH\' in LinkingTo, so the header is not found when installing' }], { checkRegistration: false });
			lint('local header of the same name', { 'src/a.cpp': '#include "Rcpp.h"\n', 'src/Rcpp.h': '// mine\n' }, [], { checkRegistration: false });
			lint('commented include', { 'src/a.cpp': '// #include <Rcpp.h>\n/* #include <RcppArmadillo.h> */\n' }, [], { checkRegistration: false });
			lint('configurable header map', { 'src/a.c': '#include <foo.h>\n' }, [{ kind, message: 'The code includes \'foo.h\' but the DESCRIPTION does not list \'foopkg\' in LinkingTo, so the header is not found when installing' }], { headerPackages: { 'foo.h': 'foopkg' }, checkRegistration: false });
		});

		describe('without a package', () => {
			lint('no DESCRIPTION, no findings', { 'DESCRIPTION': null, 'src/Makevars': 'PKG_CFLAGS = -O3\n' }, []);
			lint('plain R package is clean', {}, []);
		});

		describe('on disk', () => {
			test('useDynLib without src directory', async() => {
				const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-cc-'));
				try {
					for(const [f, c] of Object.entries({ 'DESCRIPTION': Desc, 'NAMESPACE': '# x\nuseDynLib(pkg, .registration = TRUE)\n', 'R/a.R': 'x <- 1\n' })) {
						fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
						fs.writeFileSync(path.join(root, f), c);
					}
					const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
					analyzer.addRequest(`file://${root}`);
					const res = await analyzer.query([{ type: 'linter', rules: ['compiled-code'] }]);
					const found = (res.linter.results['compiled-code'] as unknown as { results: { kind: string, message: string, loc: unknown[] }[] }).results;
					assert.lengthOf(found, 1);
					assert.strictEqual(found[0].kind, 'whether package can be installed');
					assert.strictEqual(found[0].loc[4], path.join(root, 'NAMESPACE'));
				} finally {
					fs.rmSync(root, { recursive: true, force: true });
				}
			});
		});
	});
}));
