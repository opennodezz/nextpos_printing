// nextpos_printing/public/js/nextpos_pos.js

(function () {
    const BTN_ID = "nextpos-raw-print-btn";

    const TOOLBAR_SELECTORS = [
        ".pos-bill-toolbar",
        ".pos-actions",
        ".page-head .page-actions",
        "header .actions",
    ];

    // --- QZ CONNECTION HANDLING ---
    async function ensureQZ() {
        if (!window.qz) {
            frappe.msgprint({
                title: "QZ Tray Not Loaded",
                indicator: "red",
                message: `
                    QZ Tray library is missing.<br>
                    <a href="https://qz.io/download/" target="_blank">Download QZ Tray</a>
                `
            });
            throw new Error("QZ Tray library not loaded");
        }

        if (qz.websocket.isActive()) return;

        try {
            setupQZSecurity();
            await qz.websocket.connect();
        } catch (e) {
            frappe.msgprint({
                title: "QZ Tray Not Running",
                indicator: "red",
                message: `
                    QZ Tray is not running or not accessible.<br>
                    Please <a href="https://qz.io/download/" target="_blank">download QZ Tray</a> 
                    or start it from your system tray.
                `
            });
            throw e;
        }
    }

    // Prompt user if no default printer is available
    async function getPrinterOrPrompt() {
        try {
            return await qz.printers.getDefault();
        } catch {
            console.warn("[nextpos_printing] Default printer not found, prompting...");
            const printers = await qz.printers.find();

            if (!printers || !printers.length) {
                frappe.msgprint({
                    title: "No Printers Found",
                    indicator: "red",
                    message: "QZ Tray is running but no printers were detected."
                });
                throw new Error("No printers available");
            }

            let options = printers.map(p => `<option value="${p}">${p}</option>`).join("");
            let selectHtml = `<select id="printer-picker" style="width:100%">${options}</select>`;

            return new Promise((resolve) => {
                const d = new frappe.ui.Dialog({
                    title: "Select Printer",
                    fields: [{ fieldtype: "HTML", fieldname: "printer_list", options: selectHtml }],
                    primary_action_label: "Select",
                    primary_action: () => {
                        const chosen = d.$wrapper.find("#printer-picker").val();
                        d.hide();
                        resolve(chosen);
                    }
                });
                d.show();
            });
        }
    }

    // --- TEST PRINT ---
    async function sendCutTest() {
        try {
            await ensureQZ();
            const printer = await getPrinterOrPrompt();

            const cfg = qz.configs.create(printer);

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

            await qz.print(cfg, data);
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

    // --- QZ SECURITY ---
    function setupQZSecurity() {
        if (!window.qz) return;

        qz.security.setCertificatePromise((resolve, reject) => {
            fetch('/api/method/nextpos_printing.api.qz.qz_get_certificate')
                .then(r => r.json())
                .then(j => {
                    if (!j || !j.message) throw new Error("No certificate returned");
                    resolve(j.message);
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
                    if (!j || !j.message) {
                        frappe.msgprint({
                            title: "QZ Signing Failed",
                            indicator: "red",
                            message: `
                                Could not sign request.<br>
                                Please check that <code>npp_private_key</code> is set in site_config.json.
                            `
                        });
                        throw new Error("Signing failed, check site_config.json");
                    }
                    resolve(j.message);
                })
                .catch(err => {
                    frappe.msgprint({
                        title: "QZ Signing Error",
                        indicator: "red",
                        message: `Error while signing: ${err}`
                    });
                    reject(err);
                });
        });
    }

    // --- INVOICE PRINTING ---
    window.printInvoiceWithQZ = async function (invoiceName) {
        await ensureQZ();
        const printer = await getPrinterOrPrompt();

        const resp = await fetch(
            `/api/method/nextpos_printing.api.print.get_print_payload?pos_invoice_name=${invoiceName}`
        ).then(r => r.json());

        const data = resp.message;
        const cfg = qz.configs.create(printer);

        return qz.print(cfg, data)
            .then(() => console.log("Printed successfully"))
            .catch(err => console.error("Print failed", err));
    };

    // Add Print Current and Reprint Last buttons
    function add_invoice_buttons() {
        const actions = document.querySelector(".pos-bill-toolbar") || document.querySelector(".pos-actions");
        if (!actions) return;

        // Print Current Invoice
        const currentBtn = document.createElement("button");
        currentBtn.className = "btn btn-primary";
        currentBtn.innerHTML = `<i class="fa fa-print" style="margin-right:6px"></i> Print Current Invoice`;
        currentBtn.onclick = async () => {
            const invoice = cur_frm && cur_frm.doc;
            if (!invoice || invoice.doctype !== "POS Invoice") {
                frappe.msgprint("No POS Invoice is currently open");
                return;
            }
            await printInvoiceWithQZ(invoice.name);
        };

        // Reprint Last Invoice
        const lastBtn = document.createElement("button");
        lastBtn.className = "btn btn-secondary";
        lastBtn.style.marginLeft = "6px";
        lastBtn.innerHTML = `<i class="fa fa-history" style="margin-right:6px"></i> Reprint Last Invoice`;
        lastBtn.onclick = async () => {
            try {
                const res = await frappe.db.get_list('POS Invoice', {
                    fields: ['name'],
                    filters: { docstatus: 1 },
                    order_by: 'creation desc',
                    limit: 1
                });
                if (!res || res.length === 0) {
                    frappe.msgprint("No submitted POS invoices found");
                    return;
                }
                await printInvoiceWithQZ(res[0].name);
            } catch (err) {
                frappe.msgprint("Error fetching last invoice: " + err);
            }
        };

        actions.prepend(lastBtn);
        actions.prepend(currentBtn);
    }

    function replace_print_receipt_button() {
        const host = document.querySelector(".summary-btns");
        if (!host) return;

        // Find original ERPNext button
        const oldBtn = host.querySelector(".summary-btn.print-btn");
        if (oldBtn) {
            oldBtn.style.display = "none"; // hide it
        }

        // Prevent duplicate injection
        if (document.getElementById("npp-print-btn")) return;

        // Create our replacement
        const newBtn = document.createElement("button");
        newBtn.id = "npp-print-btn";
        newBtn.type = "button";
        newBtn.className = "summary-btn btn btn-primary"; // matches ERPNext styling
        newBtn.innerHTML = `<i class="fa fa-print" style="margin-right:6px"></i> Print Receipt (NPP)`;

        newBtn.onclick = async () => {
            const invoice = cur_frm && cur_frm.doc;
            if (!invoice || invoice.doctype !== "POS Invoice") {
                frappe.msgprint("No POS Invoice is currently open");
                return;
            }
            await printInvoiceWithQZ(invoice.name);
        };

        // Insert our button into the same place
        host.prepend(newBtn);
        console.log("[nextpos_printing] Replaced ERPNext Print Receipt button with NPP version");
    }

    function watch_summary_btns() {
        const mo = new MutationObserver(() => replace_print_receipt_button());
        mo.observe(document.body, { childList: true, subtree: true });
        // optional timeout to stop watching
        // setTimeout(() => mo.disconnect(), 60000);
    }

    function add_reprint_button() {
        if (document.getElementById("npp-reprint-btn")) return;

        const btn = document.createElement("button");
        btn.id = "npp-reprint-btn";
        btn.type = "button";
        btn.className = "btn btn-secondary";
        btn.innerHTML = `<i class="fa fa-history" style="margin-right:6px"></i> Reprint Last Invoice`;
        btn.onclick = async () => {
            try {
                const res = await frappe.db.get_list('POS Invoice', {
                    fields: ['name'],
                    filters: { docstatus: 1 },
                    order_by: 'creation desc',
                    limit: 1
                });
                if (!res || res.length === 0) {
                    frappe.msgprint("No submitted POS invoices found");
                    return;
                }
                await printInvoiceWithQZ(res[0].name);
            } catch (err) {
                frappe.msgprint("Error fetching last invoice: " + err);
            }
        };

        for (const sel of TOOLBAR_SELECTORS) {
            const host = document.querySelector(sel);
            if (host) { host.prepend(btn); return; }
        }
    }



    function wait_for_toolbar_then_mount() {
        const mo = new MutationObserver((_m, obs) => {
            if (document.querySelector(".summary-btns")) {
                replace_print_receipt_button();
            }
            for (const sel of TOOLBAR_SELECTORS) {
                if (document.querySelector(sel)) {
                    obs.disconnect();
                    add_reprint_button();
                    return;
                }
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => mo.disconnect(), 5000);
    }

    function on_pos_route() {
        const route = frappe.get_route_str && frappe.get_route_str();
        if (route === "point-of-sale") {
            setTimeout(wait_for_toolbar_then_mount, 300);
            setTimeout(watch_summary_btns, 300);
        }
    }


    on_pos_route();
    frappe.router && frappe.router.on("change", on_pos_route);
})();
