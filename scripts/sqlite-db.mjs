import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function sqliteDB(path=':memory:'){
 const database=new DatabaseSync(path);
 database.exec(readFileSync(new URL('../worker/schema.sql',import.meta.url),'utf8'));
 const db={prepare(sql){return {bind(...args){const run=()=>{const statement=database.prepare(sql);if(/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql))return {results:statement.all(...args),meta:{changes:0}};const r=statement.run(...args);return {results:[],meta:{changes:Number(r.changes)}};};return {async first(){return database.prepare(sql).get(...args)||null;},async all(){return run();},async run(){return run();},_run:run};},async first(){return this.bind().first();},async all(){return this.bind().all();},async run(){return this.bind().run();}};},
 async batch(statements){database.exec('BEGIN IMMEDIATE');try{const r=statements.map(s=>s._run());database.exec('COMMIT');return r;}catch(e){database.exec('ROLLBACK');throw e;}},
 close(){database.close();}};
 return db;
}

