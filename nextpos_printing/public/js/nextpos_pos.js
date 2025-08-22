// nextpos_printing/public/js/nextpos_pos.js
(function () {
  const BTN_ID = "nextpos-raw-print-btn";

  const TOOLBAR_SELECTORS = [
    ".pos-bill-toolbar",
    ".pos-actions",
    ".page-head .page-actions",
    "header .actions",
  ];

  // --- QZ helpers ---
  async function ensureQZ() {
    if (!window.qz) throw new Error("QZ Tray library not loaded");
    if (qz.websocket.isActive()) return;

    // (Dev) no signing; requires "Allow unsigned requests" in QZ settings
    qz.security.setCertificatePromise((resolve, _reject) => resolve("UNSIGNED"));
    qz.security.setSignaturePromise((_toSign) => (resolve, _reject) => resolve(null));

    await qz.websocket.connect(); // auto-detects
  }

  async function getDefaultPrinter() {
    try { return await qz.printers.getDefault(); }
    catch { 
      const list = await qz.printers.find();
      if (!list || !list.length) throw new Error("No printers found");
      return list[0];
    }
  }

  // ESC/POS raw test: init, print text, feed 3 lines, full cut
  function buildCutTest() {
    // hex string (no spaces)
    const HEX = [
      "1B40",                         // init
      "43555420544553540A",           // "CUT TEST\n" (ASCII hex)
      "1B6403",                       // feed 3 lines
      "1D5600"                        // GS V 0 (full cut)
    ].join("");

    return [{ type: "raw", format: "hex", data: HEX }];
  }

async function sendCutTest() {
  try {
    await ensureQZ();

    // pick a printer
    let printer = null;
    try { 
      printer = await qz.printers.getDefault();
    } catch {
      const list = await qz.printers.find();
      if (!list || !list.length) throw new Error("No printers found");
      printer = list[0];
    }

    // create a CONFIG for this printer (required)
    const cfg = qz.configs.create(printer, {
      // recommended dev opts:
      // rasterize: false,     // keep raw as-is
      // copies: 1,
      // colorType: "color",   // or "grayscale"
      // encoding: "CP437"     // common ESC/POS charset
    });

    // ESC/POS: init, "CUT TEST\n", feed 3, full cut
    const data = [{
      type: "raw", format: "hex",
      data: ["1B40","43555420544553540A","1B6403","1D5600"].join("")
    }];

    await qz.print(cfg, data);  // <— pass CONFIG, not printer name
    frappe.show_alert({ message: `Sent cut test to: ${printer}`, indicator: "green" });
  } catch (e) {
    console.error("[nextpos_printing] QZ error:", e);
    frappe.msgprint({
      title: "QZ Tray",
      message: `Could not print: ${e.message || e}`,
      indicator: "red"
    });
  }
}


  // --- UI mounting ---
  function ensure_button() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.className = "btn btn-default";
    btn.style.marginRight = "8px";
    btn.innerHTML = `<i class="fa fa-print" style="margin-right:6px"></i> Test Raw Print`;
    btn.onclick = sendCutTest;

    for (const sel of TOOLBAR_SELECTORS) {
      const host = document.querySelector(sel);
      if (host) { host.prepend(btn); return; }
    }
    // Fallback (shouldn't happen now)
    Object.assign(btn.style, { position: "fixed", right: "16px", bottom: "16px", zIndex: 10000 });
    document.body.appendChild(btn);
  }

  function wait_for_toolbar_then_mount() {
    for (const sel of TOOLBAR_SELECTORS) if (document.querySelector(sel)) return ensure_button();

    const mo = new MutationObserver((_m, obs) => {
      for (const sel of TOOLBAR_SELECTORS) {
        if (document.querySelector(sel)) { obs.disconnect(); ensure_button(); return; }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 5000);
  }

  function on_pos_route() {
    const route = frappe.get_route_str && frappe.get_route_str();
    if (route === "point-of-sale") setTimeout(wait_for_toolbar_then_mount, 300);
  }

  on_pos_route();
  frappe.router && frappe.router.on("change", on_pos_route);
})();
