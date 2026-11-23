(() => {
    "use strict";

    // Add each merchant-issued hosted payment URL after card payments are enabled.
    const cardLinks = new Map([
        ["7", null],
        ["30", null],
        ["180", null],
    ]);

    const plan = new URLSearchParams(location.search).get("plan");
    const packageLinks = document.querySelectorAll(".checkout-packages [data-plan]");
    const selectedPackage = Array.from(packageLinks).find((link) => link.dataset.plan === plan);
    if (!selectedPackage) return;

    selectedPackage.setAttribute("aria-current", "page");
    document.getElementById("checkout-duration").textContent = plan + "-day license";
    document.getElementById("checkout-price").textContent = selectedPackage.querySelector("strong").textContent + " USD";
    document.getElementById("checkout-quantity").textContent = "1";

    const cardLink = cardLinks.get(plan);
    if (!cardLink) return;

    let checkoutUrl;
    try {
        checkoutUrl = new URL(cardLink);
    } catch {
        return;
    }

    if (checkoutUrl.protocol !== "https:" || checkoutUrl.username || checkoutUrl.password) return;

    document.getElementById("checkout-cards").href = checkoutUrl.href;
    document.getElementById("checkout-methods").hidden = false;
    document.getElementById("checkout-message").hidden = true;
})();
