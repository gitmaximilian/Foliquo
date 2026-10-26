import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('../dist/style.css',import.meta.url),'utf8');

test('mobile library action menu clamps to the visible area in both writing directions',async()=>{
 const rule='.document-actions-list>.action-menu .action-menu-items{max-width:calc(100vw - 32px);box-sizing:border-box;transform:translateX(var(--action-menu-shift-x))}';
 const ruleIndex=css.indexOf(rule);
 assert.notEqual(ruleIndex,-1,'mobile menu must cap its width without overriding logical inline-end placement');
 const mediaStart=css.lastIndexOf('@media(max-width:600px){',ruleIndex);
 const mediaEnd=css.indexOf('}',ruleIndex);
 assert.notEqual(mediaStart,-1,'the positioning override must be responsive');
 assert.ok(mediaStart<ruleIndex&&ruleIndex<mediaEnd,'desktop menu placement must remain unchanged');
 assert.match(css,/\.action-menu-items\{position:absolute;inset-inline-end:0;/,'logical inline-end placement opens inward from either viewport edge in LTR and RTL');
 assert.doesNotMatch(css,/:dir\(rtl\) \.document-actions-list>\.action-menu \.action-menu-items\{[^}]*inset-inline-start/,'do not assume one side of an RTL card always has enough room');
 const dialogs=await readFile(new URL('../dist/workspace-dialogs.js',import.meta.url),'utf8');
 assert.match(dialogs,/function positionLibraryActionMenu\(menu\)/,'open menus measure their actual trigger-relative bounds');
 assert.match(dialogs,/const shift=rect\.left<left\?left-rect\.left:rect\.right>right\?right-rect\.right:0/,'menus clamp inside the viewport and the workspace clip edge');
 assert.ok(dialogs.includes("window.addEventListener('resize',()=>{for(const menu of document.querySelectorAll('.document-actions-list>.action-menu[open]'))positionLibraryActionMenu(menu);});"),'an open menu is repositioned when the viewport changes');
});

test('library menu positioning selector matches its rendered action-list nesting',async()=>{
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(app,/actionList\.append\(more\);actions\.append\(actionList\)/,'the details menu is nested within the actions list');
 assert.match(css,/\.document-actions-list>\.action-menu\{display:inline-block/,'desktop layout styles the actual details-menu parent');
 assert.match(css,/\.document-actions-list>\.action-menu \.action-menu-items\{max-width:calc\(100vw - 32px\);box-sizing:border-box;transform:translateX\(var\(--action-menu-shift-x\)\)\}/,'the mobile width cap and measured position target the actual details-menu parent');
});

test('library menu source rules reserve scroll room and avoid mobile overflow clipping',()=>{
 assert.match(css,/\.library-results:has\(\.action-menu\[open\]\)\{padding-bottom:100px\}/,'desktop menus do not end beneath the scroll viewport');
 assert.match(css,/@media\(max-width:600px\)\{[\s\S]*?\.library-results\{overflow:visible;margin-inline:0\}/,'mobile menus escape the results scroller');
 assert.match(css,/\.action-menu-items\{[^}]*z-index:12/,'the action surface stays above adjacent rows');
});

test('action menu dimensions, radius, spacing, colors, and shadow use shared design tokens',()=>{
 assert.match(css,/\.action-menu>summary\{[^}]*min-height:var\(--control-height\)/);
 assert.match(css,/\.action-menu-items\{[^}]*gap:var\(--space-1\)[^}]*padding:var\(--space-2\)[^}]*border-radius:var\(--radius-control\)[^}]*box-shadow:var\(--shadow-menu\)/);
 assert.match(css,/\.action-menu-items button\{[^}]*min-height:var\(--control-height\)[^}]*border-radius:var\(--radius-control\)/);
 assert.match(css,/\.action-menu-items button:hover\{background:var\(--color-surface-hover\)\}/);
 assert.match(css,/\.action-menu>summary,\.action-menu-items button,\.document-actions-list>button\{min-height:var\(--control-height-touch\)\}/,'Library export actions use the actual nested action-list structure and touch target');
 assert.doesNotMatch(css,/\.document-actions>button\{/,'remove obsolete direct-child selectors that cannot reach rendered Library actions');
});

test('status and onboarding accents use centralized semantic color tokens',()=>{
 assert.match(css,/--color-accent:#245E9B/);
 for(const token of ['--color-success-hover-bg:','--color-warning-hover-bg:','--color-danger-hover-bg:'])assert.ok(css.includes(token),`${token} is defined`);
 assert.match(css,/\.queue-message\{[^}]*border:1px solid var\(--color-warning-border\)[^}]*background:var\(--color-warning-bg\)[^}]*color:var\(--color-warning\)/);
 assert.match(css,/\.audit-warning,\.dossier-conflict\{[^}]*border:1px solid var\(--color-warning-border\)[^}]*border-left:4px solid var\(--color-warning\)[^}]*background:var\(--color-warning-bg\)[^}]*color:var\(--color-warning\)/);
 assert.match(css,/\.tone-attention\{--job-color:var\(--color-warning\);--job-bg:var\(--color-warning-bg\)\}/);
 assert.match(css,/\.tone-success\{--job-color:var\(--color-success\);--job-bg:var\(--color-success-bg\)\}/);
 assert.match(css,/\.tone-error\{--job-color:var\(--color-danger\);--job-bg:var\(--color-danger-bg\)\}/);
 assert.match(css,/\.status-failed \.queue-status-icon,\.status-awaiting_answers \.queue-status-icon\{[^}]*border-color:var\(--color-danger-border\)[^}]*background:var\(--color-danger-bg\)[^}]*color:var\(--color-danger\)/);
 assert.match(css,/\.library-status\.tone-success\{background:var\(--color-success-bg\);color:var\(--color-success\)\}/);
 assert.match(css,/\.library-status\.tone-error\{background:var\(--color-danger-bg\);color:var\(--color-danger\)\}/);
 assert.match(css,/\.question-use:hover\{background:var\(--color-success-hover-bg\);border-color:var\(--color-success-hover-border\);color:var\(--color-success-hover\)\}/);
 assert.match(css,/\.question-unreadable:hover\{background:var\(--color-danger-hover-bg\);border-color:var\(--color-danger-hover-border\);color:var\(--color-danger-hover\)\}/);
});

test('common control and card surfaces use the shared canvas and foreground tokens',()=>{
 assert.match(css,/input:not\(\[type=checkbox\]\):not\(\[type=file\]\),select,textarea\{[^}]*background:var\(--color-surface\)/);
 assert.match(css,/\.primary\{[^}]*background:var\(--ink\);color:var\(--color-on-primary\)/);
 assert.match(css,/\.secondary\{[^}]*background:var\(--color-surface\)/);
 assert.match(css,/:where\(\.workspace-dialog\)\{[^}]*background:var\(--color-surface\)/);
});

test('shared motion tokens govern controls, dialogs, page changes, and progress',()=>{
 for(const token of ['--motion-fast:120ms','--motion-control:160ms','--motion-dialog:180ms','--motion-page:200ms','--motion-progress:240ms','--ease-standard:cubic-bezier(.2,0,0,1)'])assert.ok(css.includes(token),`${token} is defined`);
 assert.match(css,/button\{[^}]*transition:background-color var\(--motion-fast\),border-color var\(--motion-fast\),color var\(--motion-fast\)/);
 assert.match(css,/\.workspace-layout\{[^}]*overflow-x:clip[^}]*transition:grid-template-columns var\(--motion-dialog\) var\(--ease-standard\),gap var\(--motion-dialog\) var\(--ease-standard\)/,'queue track animation stays within the workspace viewport');
 assert.match(css,/\.workspace-content>section:not\(\[hidden\]\)\{animation:workspace-view-enter var\(--motion-page\) var\(--ease-standard\) both\}/);
 assert.match(css,/\.progress-track>div\{[^}]*transition:width var\(--motion-progress\) var\(--ease-standard\)/);
});

test('one global reduced-motion policy covers transitions, animation, and smooth scrolling',()=>{
 const policies=css.match(/@media\(prefers-reduced-motion:reduce\)\{\s*\*,\*::before,\*::after\{scroll-behavior:auto!important;transition-duration:\.01ms!important;animation-duration:\.01ms!important;animation-iteration-count:1!important\}\}/g)||[];
 assert.equal(policies.length,1,'keep one global reduced-motion rule; component-specific overrides may still disable transforms');
});

test('common control, inset-panel, and small radii use shared shape tokens',()=>{
 for(const token of ['--radius-small:6px','--radius-control:8px','--radius-panel:12px','--radius-card:12px','--radius-dialog:16px'])assert.ok(css.includes(token),`${token} is defined`);
 assert.doesNotMatch(css,/border-radius:(?:8|10|12)px(?=[;}])/,'repeated small and panel radii do not fork into local literals');
 assert.match(css,/\.secondary\{[^}]*border-radius:var\(--radius-control\)/);
 assert.match(css,/\.output-chip\{[^}]*border-radius:var\(--radius-panel\)/);
});

test('shared spacing tokens set the primary card, rail, and field padding',()=>{
 assert.match(css,/\.card\{[^}]*padding:var\(--space-6\)/);
 assert.match(css,/#queue-card\{[^}]*padding:var\(--space-4\)/);
 assert.match(css,/input:not\(\[type=checkbox\]\):not\(\[type=file\]\),select,textarea\{[^}]*padding:var\(--space-control\) var\(--space-3\)/);
 assert.match(css,/\.header-right\{[^}]*gap:var\(--space-2\)/);
});

test('every CSS custom property reference has a stylesheet definition',()=>{
 const definitions=new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match=>match[1]));
 const references=new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(match=>match[1]));
 assert.deepEqual([...references].filter(name=>!definitions.has(name)),[],'component tokens must resolve instead of silently invalidating declarations');
 assert.match(css,/\.learning-upload-icon\{[^}]*color:var\(--color-accent\)/);
 assert.match(css,/\.manual-export-status\{[^}]*color:var\(--color-accent\)/);
});

test('semantic foreground and hover tokens meet 4.5:1 contrast on their surfaces',()=>{
 const token=name=>css.match(new RegExp(`--${name}:(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})(?![0-9a-fA-F])`))?.[1];
 const luminance=hex=>{let value=hex.slice(1);if(value.length===3)value=[...value].map(char=>char+char).join('');return value.match(/[0-9a-f]{2}/gi).map(channel=>parseInt(channel,16)/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4).reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0)};
 const contrast=(foreground,background)=>{const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
 for(const [foreground,background] of [
  ['color-accent','color-surface'],['color-success','color-success-bg'],['color-warning','color-warning-bg'],['color-danger','color-danger-bg'],['color-info','color-info-bg'],
  ['color-success-hover','color-success-hover-bg'],['color-warning-hover','color-warning-hover-bg'],['color-danger-hover','color-danger-hover-bg']
 ])assert.ok(contrast(token(foreground),token(background))>=4.5,`${foreground} has insufficient contrast on ${background}`);
});
