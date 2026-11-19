"use client";
import { useId, useState } from "react";
import styles from "./password-field.module.css";
export default function PasswordField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}) {
 const id=useId();const [show,setShow]=useState(false);
 const rules=[['12 to 128 characters',value.length>=12&&value.length<=128],['One uppercase letter',/[A-Z]/.test(value)],['One lowercase letter',/[a-z]/.test(value)],['One number',/[0-9]/.test(value)]] as const;
 return <div className={styles.field}><label htmlFor={id}>{label}</label><div className={styles.input}><input id={id} name="password" type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} autoComplete="new-password" minLength={12} maxLength={128} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}" aria-describedby={`${id}-rules`} required/><button type="button" aria-label={`${show?'Hide':'Show'} ${label.toLowerCase()}`} aria-pressed={show} onClick={()=>setShow(!show)}>{show?'Hide':'Show'}</button></div><ul id={`${id}-rules`} className={styles.rules}>{rules.map(([text,met])=><li key={text} className={met?styles.met:undefined}><span aria-hidden="true">{met?'✓':'○'}</span> {text}<span className={styles.srOnly}>{met?' — met':' — required'}</span></li>)}</ul></div>;
}
