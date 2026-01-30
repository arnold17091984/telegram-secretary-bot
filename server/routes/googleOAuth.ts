import { Router } from "express";
import { getGoogleCredentials, updateGoogleTokens } from "../db";

const router = Router();

// Google OAuth callback
router.get("/callback", async (req, res) => {
  console.log("[Google OAuth] Callback received");
  const { code, error } = req.query;

  if (error) {
    console.error("[Google OAuth] Error:", error);
    return res.redirect("/settings?google_error=" + encodeURIComponent(String(error)));
  }

  if (!code) {
    console.error("[Google OAuth] No code received");
    return res.redirect("/settings?google_error=no_code");
  }
  
  console.log("[Google OAuth] Code received, exchanging for tokens...");

  try {
    const credentials = await getGoogleCredentials();
    if (!credentials || !credentials.clientId || !credentials.clientSecret) {
      return res.redirect("/settings?google_error=no_credentials");
    }

    const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/google/callback`;
    console.log("[Google OAuth] Redirect URI:", redirectUri);

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: String(code),
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log("[Google OAuth] Token response status:", tokenResponse.status);

    if (tokenData.error) {
      console.error("[Google OAuth] Token error:", tokenData);
      return res.redirect("/settings?google_error=" + encodeURIComponent(tokenData.error_description || tokenData.error));
    }
    
    console.log("[Google OAuth] Tokens received, saving to database...");

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // Get user email
    let connectedEmail: string | undefined;
    try {
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      const userInfo = await userInfoResponse.json();
      connectedEmail = userInfo.email;
    } catch (e) {
      console.error("[Google OAuth] Failed to get user info:", e);
    }

    // Save tokens to database
    console.log("[Google OAuth] Saving tokens - access_token exists:", !!access_token, "refresh_token exists:", !!refresh_token);
    await updateGoogleTokens(access_token, refresh_token, tokenExpiry, connectedEmail);
    console.log("[Google OAuth] Tokens saved successfully");

    console.log("[Google OAuth] Successfully connected:", connectedEmail);
    return res.redirect("/settings?google_success=true");
  } catch (error) {
    console.error("[Google OAuth] Callback error:", error);
    return res.redirect("/settings?google_error=callback_failed");
  }
});

export default router;
