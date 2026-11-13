import { NextResponse } from "next/server";
import { authenticateDemoUser, setSessionCookie } from "@/lib/auth";

export async function POST() {
  const user = authenticateDemoUser();
  const response = NextResponse.json({ user });
  await setSessionCookie(user, response);
  return response;
}
