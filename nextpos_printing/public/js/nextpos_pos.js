// nextpos_printing/public/js/nextpos_pos.js

(function () {
    const BTN_ID = "nextpos-raw-print-btn";

    const TOOLBAR_SELECTORS = [
        ".pos-bill-toolbar",
        ".pos-actions",
        ".page-head .page-actions",
        "header .actions",
    ];

    async function ensureQZ() {
        if (!window.qz) throw new Error("QZ Tray library not loaded");
        if (qz.websocket.isActive()) return;
        try {
            setupQZSecurity();
            await qz.websocket.connect();
        } catch (e) {
            console.warn("[nextpos_printing] QZ connect skipped:", e);
            // Don't rethrow — keep POS running even if QZ fails
        }
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

        const data = [{
        type: "raw",
        format: "hex",
        data: [
            "1B40", // ESC @ (init)
            "1B6101", // ESC a 1 (center)
            "4F50454E204E4F444520534F4C5554494F4E530A", // "OPEN NODE SOLUTIONS\n"
            "1B6100", // ESC a 0 (left align)
            "446174653A20323032352D30382D32322031323A33300A", // "Date: 2025-08-22 12:30\n"
            "436173686965723A204A6F686E20446F650A", // "Cashier: John Doe\n"
            "2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D0A", // -------------------
            "4974656D2020202020202020202051727479202050726963650A", // "Item            Qty   Price\n"
            "2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D0A", // -------------------
            "436F666665652020202020202020203120202024322E35300A", // "Coffee          1    $2.50\n"
            "53616E6477696368202020202020203220202024362E30300A", // "Sandwich        2    $6.00\n"
            "43616E20436F6B6520202020202020312020202024312E35300A", // "Can Coke        1    $1.50\n"
            "2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D2D0A", // -------------------
            "537562746F74616C3A2020202020202020202020202024302E30300A", // "Subtotal:           $10.00\n"
            "5461782028313525293A2020202020202020202024302E35300A", // "Tax (15%):          $0.50\n"
            "544F54414C3A202020202020202020202020202020202431302E35300A", // "TOTAL:              $10.50\n"
            "0A0A", // extra spacing
            "1B6101", // center again
            "5468616E6B20796F7520666F722073686F7070696E67210A", // "Thank you for shopping!\n"
            "1B6100", // back to left
            "0A0A0A0A0A", // feed 5 lines
            "1D5600" // GS V 0 (full cut)
        ].join("")
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

    function setupQZSecurity() {
        if (!window.qz) return; // don't break the page if qz not loaded

        qz.security.setCertificatePromise((resolve, reject) => {
            fetch('/api/method/nextpos_printing.api.qz.qz_get_certificate')
            .then(r => r.json())
            .then(j => {
                if (!j || !j.message) throw new Error("No certificate returned");
                resolve(j.message);              // PEM string
            })
            .catch(reject);
        });

        qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
            fetch('/api/method/nextpos_printing.api.qz.qz_sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Frappe-CSRF-Token': frappe.csrf_token || ''
            },
            body: JSON.stringify({ toSign })
            })
            .then(r => r.json())
            .then(j => {
                if (!j || !j.message) throw new Error("No signature returned");
                resolve(j.message);              // base64 signature
            })
            .catch(reject);
        });
    }

    window.printInvoiceWithQZ = async function(invoiceName) {
        await ensureQZ();
        const printer = await getDefaultPrinter();

        const resp = await fetch(
            `/api/method/nextpos_printing.api.print.get_print_payload?pos_invoice_name=${invoiceName}`
        ).then(r => r.json());

        const data = resp.message;
        const cfg = qz.configs.create(printer);

        return qz.print(cfg, data)
            .then(() => console.log("Printed successfully"))
            .catch(err => console.error("Print failed", err));
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
