import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('WinGet installer acceptance gives slow Windows setup time and retains actionable diagnostics',async()=>{
 const script=await readFile(new URL('../packaging/windows/test-winget.ps1',import.meta.url),'utf8');
 const workflow=await readFile(new URL('../.github/workflows/winget-acceptance.yml',import.meta.url),'utf8');
 assert.match(script,/WaitForExit\(480000\)/u);
 assert.match(script,/Get-CimInstance Win32_Process/u);assert.match(script,/relatedIds/u);assert.match(script,/--verbose-logs/u);assert.match(script,/DesktopAppInstaller_8wekyb3d8bbwe/u);assert.match(script,/appinstaller-\$index\.log/u);
 assert.match(script,/winget-install\.stdout\.log/u);assert.match(script,/winget-install\.stderr\.log/u);assert.match(script,/installer\.log/u);
 assert.match(workflow,/timeout-minutes: 15/u);assert.match(workflow,/if: always\(\)/u);assert.match(workflow,/winget-installation-diagnostics/u);
});
