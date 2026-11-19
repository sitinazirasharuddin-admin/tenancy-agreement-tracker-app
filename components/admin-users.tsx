"use client";
import { useState } from "react";
import PasswordField from "./password-field";
export default function AdminUsers({teamId,onCreated}:{teamId:string;onCreated:()=>Promise<void>}) {
 const [passwordValue,setPasswordValue]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 return <section className="panel invite-panel"><h2>Create user</h2><p className="muted">Create an account for this team. Share the username and temporary password privately; no confirmation email is needed.</p>
 <form className="invite-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setBusy(true);setError("");setMessage("");try{const response=await fetch("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamId,name:f.get("name"),email:f.get("email"),password:f.get("password"),role:f.get("role")})});const result=await response.json();if(!response.ok)throw new Error(result.error);setMessage(result.message);form.reset();setPasswordValue("");await onCreated();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
 <label>Full name<input name="name" required maxLength={200}/></label><label>Username / email<input name="email" type="email" required autoComplete="off"/></label><label>Role<select name="role" defaultValue="member"><option value="member">Member</option><option value="admin">Admin</option></select></label><PasswordField label="Temporary password" value={passwordValue} onChange={setPasswordValue}/><button className="primary" disabled={busy}>{busy?"Creating…":"Create user"}</button></form>
 {error&&<p role="alert" className="alert error">{error}</p>}{message&&<p role="status" className="alert success">{message}</p>}</section>;
}

export function ResetUserPassword({teamId,userId}:{teamId:string;userId:string}) {
 const [passwordValue,setPasswordValue]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 return <details><summary>Reset temporary password</summary><form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const password=String(new FormData(form).get("password"));setBusy(true);setMessage("");try{const r=await fetch("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamId,userId,action:"reset",password})});const result=await r.json();if(!r.ok)throw new Error(result.error);setMessage(result.message);form.reset();setPasswordValue("");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}><PasswordField label="New temporary password" value={passwordValue} onChange={setPasswordValue}/><button disabled={busy}>Reset password</button></form>{message&&<p role="status">{message}</p>}</details>;
}
