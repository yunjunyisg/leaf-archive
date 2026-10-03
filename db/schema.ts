import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const plants = sqliteTable('plants', {id:text('id').primaryKey(),owner:text('owner').notNull(),number:text('number').notNull(),data:text('data').notNull(),created:text('created').notNull()},t=>[uniqueIndex('plants_owner_number').on(t.owner,t.number)]);
export const images = sqliteTable('images',{id:text('id').primaryKey(),owner:text('owner').notNull(),mime:text('mime').notNull()});
