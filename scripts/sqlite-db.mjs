import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function sqliteDB(path=':memory:'){
 const database=new DatabaseSync(path);
 // Local/test adapter applies the same versioned SQL shipped to hosted D1.
 database.exec('CREATE TABLE IF NOT EXISTS __gym_local_migrations (tag TEXT PRIMARY KEY)');
 const journal=JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8'));
 for(const entry of journal.entries){
  if(database.prepare('SELECT tag FROM __gym_local_migrations WHERE tag=?').get(entry.tag))continue;
  database.exec('BEGIN IMMEDIATE');
  try{database.exec(readFileSync(new URL('../drizzle/'+entry.tag+'.sql',import.meta.url),'utf8'));database.prepare('INSERT INTO __gym_local_migrations(tag) VALUES (?)').run(entry.tag);database.exec('COMMIT');}
  catch(error){database.exec('ROLLBACK');database.close();throw error;}
 }
 const db={prepare(sql){return {bind(...args){const run=()=>{const statement=database.prepare(sql);if(/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql))return {results:statement.all(...args),meta:{changes:0}};const r=statement.run(...args);return {results:[],meta:{changes:Number(r.changes)}};};return {async first(){return database.prepare(sql).get(...args)||null;},async all(){return run();},async run(){return run();},_run:run};},async first(){return this.bind().first();},async all(){return this.bind().all();},async run(){return this.bind().run();}};},
 async batch(statements){database.exec('BEGIN IMMEDIATE');try{const r=statements.map(s=>s._run());database.exec('COMMIT');return r;}catch(e){database.exec('ROLLBACK');throw e;}},
 close(){database.close();}};
 return db;
}

