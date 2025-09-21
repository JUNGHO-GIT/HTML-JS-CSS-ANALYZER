// gcloud.cjs

const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const winOrLinux = os.platform() === 'win32' ? "win" : "linux";
console.log(`--------------------------------------------------`);
console.log(`Activated OS is : ${winOrLinux} \n`);

// helper: 안전하게 git 명령 실행 (출력 캡처)
const runGitSafe = (/** @type {string} */ cmd) => {
    try {
			return execSync(cmd, { stdio: 'pipe' }).toString().trim();
    }
    catch (err) {
			return null;
    }
};

// changelog 수정 ----------------------------------------------------------------------------------
const modifyChangelog = () => {
	try {

		// ex. 2024-11-03 (16:23:24)
		const currentDate = new Date().toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});

		const currentTime = new Date().toLocaleTimeString('ko-KR', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});

		const changelog = fs.readFileSync('changelog.md', 'utf8');
		const versionPattern = /(\s*)(\d+[.]\d+[.]\d+)(\s*)/g;
		const matches = [...changelog.matchAll(versionPattern)];
		const lastMatch = matches[matches.length - 1];
		const lastVersion = lastMatch[2];
		const versionArray = lastVersion.split('.');
		versionArray[2] = (parseInt(versionArray[2]) + 1).toString();

		let newVersion = `\\[ ${versionArray.join('.')} \\]`;
		let newDateTime = `- ${currentDate} (${currentTime})`;
		newDateTime = newDateTime.replace(/([.]\s*[(])/g, ' (');
		newDateTime = newDateTime.replace(/([.]\s*)/g, '-');
		newDateTime = newDateTime.replace(/[(](\W*)(\s*)/g, '(');

		let newEntry = `\n## ${newVersion}\n\n${newDateTime}\n`;
		const updatedChangelog = changelog + newEntry;

		fs.writeFileSync('changelog.md', updatedChangelog, 'utf8');
	}
	catch (error) {
		console.error(error);
		process.exit(1);
	}
};

// git push (public) -------------------------------------------------------------------------------
const gitPushPublic = () => {
	try {
		const ignoreFile = ".gitignore";
		let ignorePublicFile = null;

		if (fs.existsSync(".gitignore.public")) {
			ignorePublicFile = fs.readFileSync(".gitignore.public", "utf8");
			fs.writeFileSync(ignoreFile, ignorePublicFile, "utf8");
		}
		else {
			console.warn(".gitignore.public not found. Proceeding without replacing .gitignore for public push.");
		}

		// git 리포지터리 여부 확인
		const isGit = runGitSafe('git rev-parse --is-inside-work-tree') === 'true';
		if (!isGit) {
			console.error("현재 디렉터리는 git 리포지터리가 아닙니다. git 작업을 건너뜁니다.");
			// restore .gitignore if we overwrote it
			if (ignorePublicFile !== null) {
				fs.writeFileSync(ignoreFile, ignorePublicFile, "utf8");
			}
			return;
		}

		// 추적된 파일이 있는지 확인 (ls-files)
		const trackedFiles = runGitSafe('git ls-files') || '';
		if (trackedFiles.trim().length > 0) {
			execSync('git rm -r --cached .', { stdio: 'inherit' });
		}
		else {
			console.log("추적된 파일이 없습니다. git rm --cached 명령을 건너뜁니다.");
		}

		execSync('git add .', { stdio: 'inherit' });

		// 플랫폼 독립적인 커밋 메시지 생성
		const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
		const gitCommitCmd = `git commit -m "${stamp}"`;
		try {
			execSync(gitCommitCmd, { stdio: 'inherit' });
		}
		catch (commitErr) {
			console.log("git commit 실패 또는 커밋할 변경사항 없음. 계속 진행합니다.");
		}

		execSync('git push --force origin main', { stdio: 'inherit' });

		if (ignorePublicFile !== null) {
			fs.writeFileSync(ignoreFile, ignorePublicFile, "utf8");
		}
	}
	catch (error) {
		console.error(error);
		process.exit(1);
	}
};

// git push (private) ------------------------------------------------------------------------------
const gitPushPrivate = () => {
	try {
		const ignoreFile = ".gitignore";
		let ignorePublicFile = null;
		let ignorePrivateFile = null;

		if (fs.existsSync(".gitignore.public")) {
			ignorePublicFile = fs.readFileSync(".gitignore.public", "utf8");
		}

		if (fs.existsSync(".gitignore.private")) {
			ignorePrivateFile = fs.readFileSync(".gitignore.private", "utf8");
			fs.writeFileSync(ignoreFile, ignorePrivateFile, "utf8");
		}
		else {
			console.warn(".gitignore.private not found. Proceeding without replacing .gitignore for private push.");
		}

		// git 리포지터리 여부 확인
		const isGit = runGitSafe('git rev-parse --is-inside-work-tree') === 'true';
		if (!isGit) {
			console.error("현재 디렉터리는 git 리포지터리가 아닙니다. git 작업을 건너뜁니다.");
			// restore .gitignore if we overwrote it
			if (ignorePublicFile !== null) {
				fs.writeFileSync(ignoreFile, ignorePublicFile, "utf8");
			}
			return;
		}

		// 추적된 파일이 있는지 확인
		const trackedFiles = runGitSafe('git ls-files') || '';
		if (trackedFiles.trim().length > 0) {
			execSync('git rm -r --cached .', { stdio: 'inherit' });
		}
		else {
			console.log("추적된 파일이 없습니다. git rm --cached 명령을 건너뜁니다.");
		}

		execSync('git add .', { stdio: 'inherit' });

		// 플랫폼 독립적인 커밋 메시지 생성
		const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
		const gitCommitCmd = `git commit -m "${stamp}"`;
		try {
			execSync(gitCommitCmd, { stdio: 'inherit' });
		}
		catch (commitErr) {
			console.log("git commit 실패 또는 커밋할 변경사항 없음. 계속 진행합니다.");
		}

		execSync('git push --force private main', { stdio: 'inherit' });

		if (ignorePublicFile !== null) {
			fs.writeFileSync(ignoreFile, ignorePublicFile, "utf8");
		}
	}
	catch (error) {
		console.error(error);
		process.exit(1);
	}
};

// -------------------------------------------------------------------------------------------------
modifyChangelog();
gitPushPublic();
gitPushPrivate();
process.exit(0);
