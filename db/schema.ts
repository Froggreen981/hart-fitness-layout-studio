import {sqliteTable,text,integer,index,check} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const staff=sqliteTable('gym_staff',{
 email:text('email').primaryKey(),role:text('role').notNull(),createdAt:text('created_at').notNull()
},t=>[check('gym_staff_role',sql`${t.role} IN ('editor','publisher')`)]);
export const drafts=sqliteTable('gym_drafts',{
 id:text('id').primaryKey(),name:text('name').notNull(),revision:integer('revision').notNull().default(1),
 document:text('document_json').notNull(),archived:integer('archived').notNull().default(0),
 updatedAt:text('updated_at').notNull(),updatedBy:text('updated_by').notNull()
},t=>[index('gym_drafts_listing').on(t.archived,sql`${t.updatedAt} DESC`,t.id),check('gym_drafts_archived',sql`${t.archived} IN (0,1)`)]);
export const publications=sqliteTable('gym_publications',{
 sequence:integer('sequence').primaryKey({autoIncrement:true}),id:text('id').notNull().unique(),
 sourceDraft:text('source_draft_id'),sourceRevision:integer('source_revision'),restoredFrom:text('restored_from'),previousId:text('previous_id'),
 document:text('document_json').notNull(),publicDocument:text('public_json').notNull(),publishedAt:text('published_at').notNull(),publishedBy:text('published_by').notNull()
});
export const imports=sqliteTable('gym_imports',{
 requestId:text('request_id').primaryKey(),token:text('token').notNull(),result:text('result_json').notNull(),createdAt:text('created_at').notNull()
});
