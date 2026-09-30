import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
async function checked(query){const {data,error}=await query;if(error)throw error;return data;}
let id;
try{
 const [row]=await checked(client.from('tenancy_agreements').insert({ta_reference:'QA-LIVE-'+Date.now(),property_id:'a0000000-0000-4000-8000-000000000001',unit_id:'b0000000-0000-4000-8000-000000000001',tenant_id:'c0000000-0000-4000-8000-000000000001',person_in_charge:'QA sample'}).select());id=row.id;
 await checked(client.from('tenancy_agreements').update({status:'pending_signing'}).eq('id',id));
 const [signed]=await checked(client.from('tenancy_agreements').update({status:'signed',signing_date:'2026-09-30'}).eq('id',id).select());
 assert.equal(signed.stamping_due_date,'2026-10-30');
 await checked(client.from('outstanding_actions').insert({ta_id:id,action_type:'stamping',description:'QA sample: Submit to LHDN',due_date:signed.stamping_due_date}));
 const invalid=await client.from('tenancy_agreements').update({status:'completed'}).eq('id',id);assert.ok(invalid.error);
 await checked(client.from('tenancy_agreements').update({stamping_submission_date:'2026-10-01',stamping_fee:1250,payment_status:'paid',status:'completed'}).eq('id',id));
 const actions=await checked(client.from('outstanding_actions').select('*').eq('ta_id',id));assert.equal(actions.length,1);assert.equal(actions[0].completed,true);assert.ok(actions[0].completed_at);
 const audit=await checked(client.from('audit_logs').select('id').eq('target_id',id));assert.ok(audit.length>=4);
 console.log('PASS: hosted Supabase anonymous CRUD, signing deadline, completion validation, atomic action closure, audit records.');
}finally{if(id){await checked(client.from('tenancy_agreements').delete().eq('id',id));const remaining=await checked(client.from('outstanding_actions').select('id').eq('ta_id',id));assert.equal(remaining.length,0);console.log('Removed only the generated QA agreement and its action; seed data preserved.');}}
