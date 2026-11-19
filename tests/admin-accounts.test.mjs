import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("admin accounts are atomic, reject public signup and gate data until password change", async()=>{
 const db=new PGlite();
 const admin="10000000-0000-4000-8000-000000000001", member="10000000-0000-4000-8000-000000000002", team="20000000-0000-4000-8000-000000000001";
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,encrypted_password text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.teams(id uuid primary key,archived_at timestamptz);
 create table public.team_members(team_id uuid references public.teams,user_id uuid references auth.users,email text,role text,primary key(team_id,user_id));
 create function public.create_team(text) returns void language sql as $$select$$;
 create function public.accept_team_invite(uuid) returns void language sql as $$select$$;
 create function public.invite_team_member(uuid,text) returns void language sql as $$select$$;
 insert into auth.users(id,email) values('${admin}','admin@example.test');insert into teams values('${team}',null);insert into team_members values('${team}','${admin}','admin@example.test','admin');`);
 await db.exec(await readFile(new URL('../supabase/migrations/0012_admin_accounts.sql',import.meta.url),'utf8'));
 await assert.rejects(db.exec(`insert into auth.users(id,email) values('${member}','member@example.test')`),/administrator/);
 await assert.rejects(db.exec(`insert into auth.users(id,email,raw_user_meta_data) values('${member}','member@example.test','{"provisioned_by":"${admin}","provisioned_team":"${team}"}')`),/administrator/);
 await db.exec(await readFile(new URL('../supabase/migrations/0013_defer_admin_provisioning.sql',import.meta.url),'utf8'));
 const metadata={provisioned_by:admin,provisioned_team:team,provisioned_role:'member',must_change_password:true,password_reset_nonce:'first'};
 await db.transaction(async tx=>{
 await tx.query('insert into auth.users(id,email,encrypted_password) values($1,$2,$3)',[member,'member@example.test','hash1']);
 await tx.query('update auth.users set raw_app_meta_data=$1 where id=$2',[metadata,member]);
 });
 await assert.rejects(db.exec(`insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000004','public@example.test')`),/administrator/);
 assert.equal((await db.query('select count(*)::int as n from team_members')).rows[0].n,2);
 await db.exec(`select set_config('request.jwt.claim.sub','${member}',false)`);
 assert.equal((await db.query(`select is_team_member('${team}') as allowed`)).rows[0].allowed,false);
 await db.exec(`update auth.users set raw_user_meta_data='{"must_change_password":false}' where id='${member}'`);
 assert.equal((await db.query(`select is_team_member('${team}') as allowed`)).rows[0].allowed,false);
 await db.exec(`update auth.users set encrypted_password='hash2' where id='${member}'`);
 assert.equal((await db.query(`select is_team_member('${team}') as allowed`)).rows[0].allowed,true);
 assert.equal((await db.query(`select is_team_admin('${team}') as allowed`)).rows[0].allowed,false);
 await db.exec(`update auth.users set encrypted_password='hash3',raw_app_meta_data=raw_app_meta_data||'{"must_change_password":true,"password_reset_nonce":"second"}' where id='${member}'`);
 assert.equal((await db.query(`select is_team_member('${team}') as allowed`)).rows[0].allowed,false);
 await db.exec(`update auth.users set encrypted_password='hash4' where id='${member}'`);
 assert.equal((await db.query(`select is_team_member('${team}') as allowed`)).rows[0].allowed,true);
 const bad={...metadata,provisioned_by:member};
 await assert.rejects(db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',['10000000-0000-4000-8000-000000000003','blocked@example.test',bad]),/administrator/);
 assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,2);
 }finally{await db.close();}
});

