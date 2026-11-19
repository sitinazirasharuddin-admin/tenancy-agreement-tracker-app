import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
export async function POST(request: NextRequest) {
  const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("Invalid request origin.",403);
  const db = await createClient();
  const {data: {user},error: authError} = await db.auth.getUser();
  if (authError || !user) return fail("Sign in first.",401);
  if (user.app_metadata.must_change_password) return fail("Change your temporary password first.",403);
  let body;
  try { body=await request.json(); } catch { return fail("Invalid request.",400); }
  const {teamId,action="create",userId}=body;
  if (typeof teamId !== "string" || !/^[0-9a-f-]{36}$/i.test(teamId)) return fail("Choose a team.",400);
  const {data:allowed,error}=await db.rpc("is_team_admin",{team:teamId});
  if(error || allowed !== true) return fail("Only this team's administrators can manage accounts.",403);
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key) return fail("Account management is not configured. Contact your administrator.",503);
  const admin=createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const password=body.password;
  if(typeof password!=="string" || password.length<8 || password.length>12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) return fail("Use a temporary password of 8–12 characters with uppercase, lowercase and a number.",400);
  if(action==="reset") {
    if(typeof userId!=="string" || userId===user.id) return fail("Choose another managed team member.",400);
    const {data:member}=await db.from("team_members").select("user_id").eq("team_id",teamId).eq("user_id",userId).maybeSingle();
    if(!member) return fail("Team member not found.",404);
    const {data:target,error:targetError}=await admin.auth.admin.getUserById(userId);
    if(targetError || target.user.app_metadata.provisioned_team!==teamId) return fail("This account is not managed by this team.",403);
    const {error:resetError}=await admin.auth.admin.updateUserById(userId,{password,app_metadata:{...target.user.app_metadata,must_change_password:true,password_reset_nonce:randomUUID()}});
    if(resetError) return fail("Password reset failed. Please try again.",400);
    return NextResponse.json({message:"Temporary password reset. Share it privately; the user must change it before accessing the workspace."});
  }
  if(action!=="create") return fail("Unknown action.",400);
  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  const name=typeof body.name==="string"?body.name.trim():"";
  const role=body.role;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !name || name.length>200 || !["admin","member"].includes(role)) return fail("Enter a name, valid email and role.",400);
  const {error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name},app_metadata:{provisioned_by:user.id,provisioned_team:teamId,provisioned_role:role,must_change_password:true,password_reset_nonce:randomUUID()}});
  if(createError) return fail(createError.code==="email_exists" || createError.message.includes("already")?"An account already exists for this email. No password or access was changed.":"Account creation failed. Check that the admin-account database migration is installed and try again.",400);
  return NextResponse.json({message:"Account created and added to this team. Share the username and temporary password privately. The user must change the password at first sign-in."},{status:201});
}
