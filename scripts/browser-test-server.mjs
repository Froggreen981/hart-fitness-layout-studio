// Playwright owns this process and its disposable database. Never reuse staff data.
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const directory=mkdtempSync(join(tmpdir(),'gym-playwright-'));
process.env.GYM_DEV_DB=join(directory,'test.sqlite');
process.env.GYM_DEV_OWNER='owner@example.test';
delete process.env.WORKOUT_API_TOKEN_SHA256;
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}));
await import('./dev-server.mjs');
