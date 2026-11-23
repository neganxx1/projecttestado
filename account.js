(() => {
    "use strict";

    const setup = document.getElementById("account-setup");
    const notice = document.getElementById("account-notice");
    const guest = document.getElementById("account-guest");
    const profile = document.getElementById("account-profile");
    const form = document.getElementById("email-login");
    const email = document.getElementById("account-email");
    const google = document.getElementById("google-login");
    const googleNotice = document.getElementById("google-availability");
    const sendLink = document.getElementById("send-email-link");
    const signOut = document.getElementById("account-sign-out");
    const profileEmail = document.getElementById("account-profile-email");
    let busy = false;
    let googleAvailable = true;

    function message(text, error = false) {
        notice.textContent = text;
        notice.dataset.error = String(error);
    }

    function setBusy(value) {
        busy = value;
        google.disabled = value || !googleAvailable;
        email.disabled = value;
        sendLink.disabled = value;
        signOut.disabled = value;
    }

    function renderSession(session) {
        const user = session?.user;
        guest.hidden = Boolean(user);
        profile.hidden = !user;
        profileEmail.textContent = user?.email || "";
    }

    function loadSupabase() {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2";
            script.integrity = "sha384-7i/4BYWz4Mn+lJfg2HWfEPfZQ7tmFKF3CTSKlXBpxWjNlLjcg+T6smpHG4gLmU1u";
            script.crossOrigin = "anonymous";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function getProviderSettings(projectUrl, publicKey) {
        try {
            const settingsUrl = new URL("/auth/v1/settings", projectUrl);
            const response = await fetch(settingsUrl, { headers: { apikey: publicKey } });
            return response.ok ? await response.json() : null;
        } catch {
            return null;
        }
    }

    async function start() {
        const projectUrl = document.querySelector('meta[name="supabase-url"]').content.trim();
        const publicKey = document.querySelector('meta[name="supabase-publishable-key"]').content.trim();
        if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(projectUrl) || !/^sb_publishable_[\w-]+$/.test(publicKey)) {
            setup.textContent = "Account sign-in is not set up yet.";
            return;
        }

        const local = ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
        if (location.protocol !== "https:" && !(location.protocol === "http:" && local)) {
            setup.textContent = "Open this page on the website or on a localhost server to sign in.";
            return;
        }

        const accountUrl = new URL(location.href);
        const authCode = accountUrl.searchParams.get("code");
        const returnedError = accountUrl.searchParams.has("error") || new URLSearchParams(accountUrl.hash.slice(1)).has("error");
        accountUrl.search = "";
        accountUrl.hash = "";
        if (returnedError) history.replaceState(history.state, "", accountUrl);

        setup.textContent = "Loading account sign-in…";
        const [, providerSettings] = await Promise.all([
            loadSupabase(),
            getProviderSettings(projectUrl, publicKey),
        ]);
        googleAvailable = providerSettings?.external?.google !== false;
        googleNotice.hidden = googleAvailable;

        const client = window.supabase.createClient(projectUrl, publicKey, {
            auth: { flowType: "pkce", detectSessionInUrl: false },
        });
        client.auth.onAuthStateChange((event, session) => {
            renderSession(session);
            if (event === "SIGNED_IN" || event === "SIGNED_OUT") message("");
        });

        if (authCode && !returnedError) {
            const { data: callback, error: exchangeError } = await client.auth.exchangeCodeForSession(authCode);
            if (!exchangeError && callback?.session?.user) {
                location.replace(new URL("./", accountUrl).href);
                return;
            }
            history.replaceState(history.state, "", accountUrl);
        }

        const { data, error } = await client.auth.getSession();
        renderSession(data?.session);
        setup.hidden = true;
        if (error || returnedError || authCode) message("Sign-in could not be completed. Please try again.", true);

        google.addEventListener("click", async () => {
            if (busy) return;
            setBusy(true);
            message("Opening Google…");
            try {
                const { error: authError } = await client.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: accountUrl.href },
                });
                if (authError) throw authError;
            } catch {
                message("Google sign-in is unavailable. Try again or use email.", true);
            } finally {
                setBusy(false);
            }
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (busy || !form.reportValidity()) return;
            setBusy(true);
            message("");
            try {
                const { error: authError } = await client.auth.signInWithOtp({
                    email: email.value.trim(),
                    options: { shouldCreateUser: true, emailRedirectTo: accountUrl.href },
                });
                if (authError) throw authError;
                message("Check your email for your sign-in link. Open it in this browser.");
            } catch {
                message("We couldn’t send a sign-in link. Check your email address or try again soon.", true);
            } finally {
                setBusy(false);
            }
        });

        signOut.addEventListener("click", async () => {
            if (busy) return;
            setBusy(true);
            try {
                const { error: authError } = await client.auth.signOut({ scope: "local" });
                if (authError) throw authError;
                message("You’re signed out.");
            } catch {
                message("Sign-out could not be completed. Please try again.", true);
            } finally {
                setBusy(false);
            }
        });

        setBusy(false);
    }

    start().catch(() => {
        setup.hidden = false;
        setup.textContent = "Account sign-in could not load. Refresh this page to try again.";
        message("", false);
    });
})();
