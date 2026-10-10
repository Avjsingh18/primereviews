"use client";

import { useEffect } from "react";

// Password-reset emails can land on any page of the site with the recovery details in the URL fragment (the part after #),
// which only the browser can read. This sends the visitor on to the reset page without ever sending that fragment anywhere.
export default function RecoveryRedirect() {
  useEffect(() => {
    const { hash, pathname } = window.location;
    if (pathname === "/reset-password" || !hash) return;
    if (/type=recovery/.test(hash) && /access_token=/.test(hash)) window.location.replace(`/reset-password${hash}`);
    else if (/error_code=otp_expired/.test(hash) || (/error=access_denied/.test(hash) && /error_description=/.test(hash))) window.location.replace("/forgot-password?expired=1");
  }, []);
  return null;
}
