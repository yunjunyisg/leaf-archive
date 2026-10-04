import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const plants = sqliteTable('plants', {id:text('id').primaryKey(),owner:text('owner').notNull(),number:text('number').notNull(),data:text('data').notNull(),created:text('created').notNull()},t=>[uniqueIndex('plants_owner_number').on(t.owner,t.number)]);
export const images = sqliteTable('images',{id:text('id').primaryKey(),owner:text('owner').notNull(),mime:text('mime').notNull()});

export const wechatIdentities=sqliteTable('wechat_identities',{identityHash:text('identity_hash').primaryKey(),owner:text('owner').notNull(),unionId:text('union_id')});
export const authSessions=sqliteTable('auth_sessions',{tokenHash:text('token_hash').primaryKey(),owner:text('owner').notNull(),nickname:text('nickname').notNull(),expires:integer('expires').notNull()});
export const oauthStates=sqliteTable('oauth_states',{stateHash:text('state_hash').primaryKey(),mode:text('mode').notNull(),appId:text('app_id').notNull(),expires:integer('expires').notNull()});

export const taxa=sqliteTable('taxa',{id:text('id').primaryKey(),owner:text('owner').notNull(),pathKey:text('path_key').notNull(),data:text('data').notNull(),created:text('created').notNull()},t=>[uniqueIndex('taxa_owner_path').on(t.owner,t.pathKey)]);
