import {sqliteTable,text,integer,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const cohorts=sqliteTable('cohorts',{id:text('id').primaryKey(),owner:text('owner').notNull(),config:text('config').notNull(),version:integer('version').notNull().default(0)});
export const records=sqliteTable('records',{id:text('id').primaryKey(),cohort:text('cohort').notNull(),kind:text('kind').notNull(),identity:text('identity').notNull(),data:text('data').notNull(),token:text('token'),updated:integer('updated').notNull()},t=>[uniqueIndex('record_identity').on(t.cohort,t.kind,t.identity)]);
