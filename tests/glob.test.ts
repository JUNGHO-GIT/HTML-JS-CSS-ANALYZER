/**
 * @file glob.test.ts
 * @description Glob 패턴 처리 모듈 TDD 테스트
 */

// Glob 테스트를 위한 독립적인 함수 정의
const globToRegExp = (glob: string): RegExp => {
	let s = glob.replace(/\\/g, `/`);
	s = s.replace(/[.+^${}()|[\]\\]/g, `\\$&`);
	s = s.replace(/\*\*/g, `§§DS§§`);
	s = s.replace(/\*/g, `[^/]*`);
	s = s.replace(/§§DS§§/g, `.*`);
	s = s.replace(/\?/g, `[^/]`);
	return new RegExp(`^${s}$`);
};

const isUriExcludedByGlob = (uri: { fsPath: string }, patterns: string[]): boolean => {
	const rel = uri.fsPath.replace(/\\/g, `/`);
	return patterns.some(p => globToRegExp(p).test(rel));
};

import { vscode } from "./__mocks__/exportLibs";

// glob 함수 실제 구현 테스트
describe(`globToRegExp`, () => {
	describe(`기본 패턴 변환`, () => {
		it(`정확한 파일명 매칭`, () => {
			const regex = globToRegExp(`file.txt`);
			expect(regex.test(`file.txt`)).toBe(true);
			expect(regex.test(`file.js`)).toBe(false);
		});

		it(`단일 * 와일드카드 (디렉토리 구분자 제외)`, () => {
			const regex = globToRegExp(`*.txt`);
			expect(regex.test(`file.txt`)).toBe(true);
			expect(regex.test(`document.txt`)).toBe(true);
			expect(regex.test(`file.js`)).toBe(false);
			expect(regex.test(`dir/file.txt`)).toBe(false); // * doesn't cross directory
		});

		it(`** 와일드카드 (디렉토리 포함)`, () => {
			const regex = globToRegExp(`**file.txt`);
			expect(regex.test(`file.txt`)).toBe(true);
			expect(regex.test(`dir/file.txt`)).toBe(true);
			expect(regex.test(`deep/nested/dir/file.txt`)).toBe(true);
		});

		it(`? 와일드카드 (단일 문자)`, () => {
			const regex = globToRegExp(`file?.txt`);
			expect(regex.test(`file1.txt`)).toBe(true);
			expect(regex.test(`fileA.txt`)).toBe(true);
			expect(regex.test(`file.txt`)).toBe(false);
			expect(regex.test(`file12.txt`)).toBe(false);
		});
	});

	describe(`복합 패턴`, () => {
		it(`node_modules 디렉토리 패턴`, () => {
			const regex = globToRegExp(`**node_modules**`);
			expect(regex.test(`node_modules/lodash`)).toBe(true);
			expect(regex.test(`project/node_modules/lodash`)).toBe(true);
			expect(regex.test(`node_modules/lodash/index.js`)).toBe(true);
		});

		it(`특정 디렉토리 내 TypeScript 파일`, () => {
			const regex = globToRegExp(`src/**.ts`);
			expect(regex.test(`src/index.ts`)).toBe(true);
			expect(regex.test(`src/utils/helper.ts`)).toBe(true);
		});

		it(`dist 디렉토리 패턴`, () => {
			const regex = globToRegExp(`**dist**`);
			expect(regex.test(`dist/index.js`)).toBe(true);
			expect(regex.test(`project/dist/bundle.js`)).toBe(true);
		});
	});

	describe(`특수 문자 이스케이프`, () => {
		it(`점(.) 이스케이프`, () => {
			const regex = globToRegExp(`file.test.ts`);
			expect(regex.test(`file.test.ts`)).toBe(true);
			expect(regex.test(`fileXtestXts`)).toBe(false);
		});

		it(`대괄호([]) 이스케이프`, () => {
			const regex = globToRegExp(`file[1].txt`);
			expect(regex.test(`file[1].txt`)).toBe(true);
		});

		it(`중괄호({}) 이스케이프`, () => {
			const regex = globToRegExp(`file{a}.txt`);
			expect(regex.test(`file{a}.txt`)).toBe(true);
		});
	});

	describe(`경로 정규화`, () => {
		it(`백슬래시를 슬래시로 변환`, () => {
			const regex = globToRegExp(`dir\\**\\file.txt`);
			expect(regex.test(`dir/subdir/file.txt`)).toBe(true);
		});
	});
});

describe(`isUriExcludedByGlob`, () => {
	it(`패턴과 일치하는 URI는 제외되어야 함`, () => {
		const uri = vscode.Uri.file(`/project/node_modules/lodash/index.js`);
		const patterns = [ `**node_modules**` ];
		expect(isUriExcludedByGlob(uri, patterns)).toBe(true);
	});

	it(`패턴과 일치하지 않는 URI는 제외되지 않아야 함`, () => {
		const uri = vscode.Uri.file(`/project/src/index.ts`);
		const patterns = [ `**node_modules**`, `**dist**` ];
		expect(isUriExcludedByGlob(uri, patterns)).toBe(false);
	});

	it(`여러 패턴 중 하나라도 일치하면 제외되어야 함`, () => {
		const uri = vscode.Uri.file(`/project/dist/bundle.js`);
		const patterns = [ `**node_modules**`, `**dist**` ];
		expect(isUriExcludedByGlob(uri, patterns)).toBe(true);
	});

	it(`빈 패턴 배열은 제외하지 않아야 함`, () => {
		const uri = vscode.Uri.file(`/project/src/index.ts`);
		const patterns: string[] = [];
		expect(isUriExcludedByGlob(uri, patterns)).toBe(false);
	});

	it(`git 디렉토리 패턴`, () => {
		const uri = vscode.Uri.file(`/project/.git/config`);
		const patterns = [ `**.git**` ];
		expect(isUriExcludedByGlob(uri, patterns)).toBe(true);
	});
});
