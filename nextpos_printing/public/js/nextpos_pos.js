// nextpos_printing/public/js/nextpos_pos.js
(function () {
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

    window.printInvoiceWithQZ = async function (invoiceName, openDrawerFlag = false) {
        await ensureQZ();

        let posProfile = (cur_frm && cur_frm.doc && cur_frm.doc.pos_profile) || null;

        let res = await frappe.call({
            method: "nextpos_printing.utils.settings.get_printer_for_pos",
            args: { pos_profile: posProfile }
        });

        if (!res || !res.message) {
            frappe.msgprint("No printer configuration found. Please check NextPOS Settings.");
            return;
        }

        let { printer, cut_mode, feed_before_cut, print_copies, open_cash_drawer, drawer_pin } = res.message;

        let printers = await qz.printers.find();
        if (!printers.includes(printer)) {
            frappe.msgprint(`Configured printer "${printer}" not found. Using first available printer.`);
            printer = printers[0];
        }

        const resp = await fetch(
            `/api/method/nextpos_printing.api.print.get_print_payload?pos_invoice_name=${invoiceName}`
        ).then(r => r.json());

        let data = resp.message;
        if (!Array.isArray(data)) data = [data];

        // --- Cut logic ---
        if (cut_mode && cut_mode !== "None") {
            let cutCommand = { type: "raw", format: "hex", data: "" };

            if (feed_before_cut && parseInt(feed_before_cut) > 0) {
                const n = parseInt(feed_before_cut);
                cutCommand.data += "1B64" + n.toString(16).padStart(2, "0");
            }

            if (cut_mode === "Full Cut") cutCommand.data += "1D5600";
            else if (cut_mode === "Partial Cut") cutCommand.data += "1D5601";

            data.push(cutCommand);
        }

        const cfg = qz.configs.create(printer);
        let copies = parseInt(print_copies) || 1;

        // After printing all copies
        for (let i = 0; i < copies; i++) {
            await qz.print(cfg, data)
                .then(() => console.log(`Printed copy ${i + 1}/${copies} to ${printer}`))
                .catch(err => console.error("Print failed", err));
        }

        if (openDrawerFlag && open_cash_drawer) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
            let pin = parseInt(drawer_pin);
            if (isNaN(pin)) pin = 0;
            let t1 = 50, t2 = 50;
            let drawerCommand = {
                type: "raw",
                format: "hex",
                data:
                    "1B70" +
                    pin.toString(16).padStart(2, "0") +
                    t1.toString(16).padStart(2, "0") +
                    t2.toString(16).padStart(2, "0")
            };

            console.log("[nextpos_printing] Drawer command fired:", drawerCommand.data);
            await qz.print(cfg, [drawerCommand])
                .then(() => console.log("Drawer opened after print"))
                .catch(err => console.error("Drawer open failed", err));
        }
    };

    // --- BUTTONS ---
    function add_invoice_buttons() {
        for (const sel of TOOLBAR_SELECTORS) {
            const actions = document.querySelector(sel);
            if (!actions) continue;

            if (document.getElementById("npp-print-current-btn")) return;

            const currentBtn = document.createElement("button");
            currentBtn.id = "npp-print-current-btn";
            currentBtn.className = "btn btn-primary";
            currentBtn.innerHTML = `<i class="fa fa-print" style="margin-right:6px"></i> Print Current Invoice`;
            currentBtn.onclick = async () => {
                const invoice = cur_frm && cur_frm.doc;
                if (!invoice || invoice.doctype !== "POS Invoice") {
                    frappe.msgprint("No POS Invoice is currently open");
                    return;
                }
                await printInvoiceWithQZ(invoice.name, false);
            };

            const lastBtn = document.createElement("button");
            lastBtn.id = "npp-reprint-last-btn";
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
                    await printInvoiceWithQZ(res[0].name, false);
                } catch (err) {
                    frappe.msgprint("Error fetching last invoice: " + err);
                }
            };

            const drawerBtn = document.createElement("button");
            drawerBtn.id = "npp-open-drawer-btn";
            drawerBtn.className = "btn btn-warning";
            drawerBtn.style.marginLeft = "6px";
            drawerBtn.innerHTML = `<i class="fa fa-cash-register" style="margin-right:6px"></i> Open Drawer`;
            drawerBtn.onclick = window.open_drawer;

            actions.prepend(drawerBtn);
            actions.prepend(lastBtn);
            actions.prepend(currentBtn);
            console.log("[nextpos_printing] Added NPP buttons to", sel);
            return;
        }
    }

    window.open_drawer = async () => {
        try {
            await ensureQZ();
            const posProfile = (cur_frm && cur_frm.doc && cur_frm.doc.pos_profile) || null;
            const mappingRes = await frappe.call({
                method: "nextpos_printing.utils.settings.get_printer_for_pos",
                args: { pos_profile: posProfile }
            });

            if (mappingRes.message && mappingRes.message.printer) {
                let pin = parseInt(mappingRes.message.drawer_pin) || 0;
                let t1 = 50, t2 = 50;
                let drawerCommand = {
                    type: "raw",
                    format: "hex",
                    data:
                        "1B70" +
                        pin.toString(16).padStart(2, "0") +
                        t1.toString(16).padStart(2, "0") +
                        t2.toString(16).padStart(2, "0")
                };

                console.log("[nextpos_printing] Manual Open Drawer:", drawerCommand.data);

                const cfg = qz.configs.create(mappingRes.message.printer);
                await qz.print(cfg, [drawerCommand]);
                frappe.show_alert({ message: "Cash drawer opened", indicator: "green" });
            } else {
                frappe.msgprint("No printer mapping found for this POS Profile.");
            }
        } catch (err) {
            frappe.msgprint("Failed to open drawer: " + err);
        }
    };

    // --- Replace ERPNext buttons ---
    function replace_print_receipt_button() {
        const host = document.querySelector(".summary-btns");
        if (!host) return;

        const oldBtn = host.querySelector(".summary-btn.print-btn");
        if (oldBtn) oldBtn.style.display = "none";

        if (document.getElementById("npp-print-btn")) return;

        const newBtn = document.createElement("button");
        newBtn.id = "npp-print-btn";
        newBtn.type = "button";
        newBtn.className = "summary-btn btn btn-primary";
        newBtn.innerHTML = `<i class="fa fa-print" style="margin-right:6px"></i> Print Receipt (NPP)`;

        newBtn.onclick = async () => {
            const invoice = cur_frm && cur_frm.doc;
            if (!invoice || invoice.doctype !== "POS Invoice") {
                frappe.msgprint("No POS Invoice is currently open");
                return;
            }
            await printInvoiceWithQZ(invoice.name);
        };

        host.prepend(newBtn);
        console.log("[nextpos_printing] Replaced ERPNext Print Receipt button with NPP version");
    }

    function watch_summary_btns() {
        const mo = new MutationObserver(() => replace_print_receipt_button());
        mo.observe(document.body, { childList: true, subtree: true });
    }

    function wait_for_toolbar_then_mount() {
        const mo = new MutationObserver((_m, obs) => {
            if (document.querySelector(".summary-btns")) {
                replace_print_receipt_button();
            }
            for (const sel of TOOLBAR_SELECTORS) {
                if (document.querySelector(sel)) {
                    obs.disconnect();
                    add_invoice_buttons();
                    return;
                }
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => mo.disconnect(), 5000);
    }

    async function autoPrintIfEnabled(invoice) {
        try {
            const res = await frappe.call({
                method: "frappe.client.get",
                args: { doctype: "NextPOS Settings", name: "NextPOS Settings" }
            });

            if (res.message && res.message.enable_auto_print) {
                console.log("[nextpos_printing] Auto-print enabled, sending invoice", invoice.name);
                await printInvoiceWithQZ(invoice.name, true);
            }
        } catch (err) {
            console.error("[nextpos_printing] Auto-print check failed:", err);
        }
    }

    function on_pos_route() {
        const route = frappe.get_route_str && frappe.get_route_str();
        if (route === "point-of-sale") {
            setTimeout(wait_for_toolbar_then_mount, 300);
            setTimeout(watch_summary_btns, 300);

            frappe.ui.form.on("POS Invoice", {
                after_save: function (frm) {
                    if (frm.doc.docstatus === 1) {
                        autoPrintIfEnabled(frm.doc);
                    }
                }
            });
        }
    }

    on_pos_route();
    frappe.router && frappe.router.on("change", on_pos_route);
})();
