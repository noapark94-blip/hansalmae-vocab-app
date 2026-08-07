#!/usr/bin/env python3
import os, requests, getpass
base=os.environ["SUPABASE_URL"].rstrip('/'); key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
email=input("교사 이메일: ").strip(); password=getpass.getpass("교사 비밀번호(8자 이상): "); name=input("교사 이름: ").strip()
h={"apikey":key,"Authorization":f"Bearer {key}","Content-Type":"application/json"}
r=requests.post(base+"/auth/v1/admin/users",headers=h,json={"email":email,"password":password,"email_confirm":True},timeout=60);r.raise_for_status();uid=r.json().get("user",r.json())["id"]
h["Prefer"]="resolution=merge-duplicates"
r=requests.post(base+"/rest/v1/profiles?on_conflict=id",headers=h,json={"id":uid,"display_name":name,"role":"admin","enabled":True},timeout=60);r.raise_for_status()
print("관리자 계정 생성 완료:",email)
