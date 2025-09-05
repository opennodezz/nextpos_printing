// nextpos_printing/public/js/nextpos_pos.js
(function () {
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

    // --- SETTINGS LOADER ---
    async function loadNextPOSSettings() {
        try {
            const response = await frappe.call({
                method: "nextpos_printing.api.settings.get_nextpos_settings"
            });
            return response.message;
        } catch (e) {
            console.error("[NextPOS] Failed to load settings:", e);
            frappe.msgprint({
                title: "NextPOS Settings Missing",
                indicator: "red",
                message: "Unable to load NextPOS Settings. Please contact Administrator."
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

    // --- PRINT INVOICE ---
    window.printInvoiceWithQZ = async function (invoiceName, openDrawerFlag = false) {
        await ensureQZ();

        let posProfile = (cur_frm && cur_frm.doc && cur_frm.doc.pos_profile) || null;

        let res = await frappe.call({
            method: "nextpos_printing.api.settings.get_printer_for_pos",
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

        // Add cut commands if configured
        if (cut_mode && cut_mode !== "None") {
            let cutData = "";

            if (feed_before_cut && parseInt(feed_before_cut) > 0) {
                const n = parseInt(feed_before_cut);
                cutData += "\x1Bd" + String.fromCharCode(n);
            }

            if (cut_mode === "Full Cut") {
                cutData += "\x1DV\x00";
            } else if (cut_mode === "Partial Cut") {
                cutData += "\x1DV\x01";
            }

            data.push({ type: "raw", data: cutData });
        }

        const cfg = qz.configs.create(printer);
        let copies = parseInt(print_copies) || 1;

        for (let i = 0; i < copies; i++) {
            await qz.print(cfg, data)
                .then(() => console.log(`Printed copy ${i + 1}/${copies} to ${printer}`))
                .catch(err => console.error("Print failed", err));
        }

        // Auto open drawer if enabled
        if (openDrawerFlag && open_cash_drawer) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            let pin = parseInt(drawer_pin);
            if (isNaN(pin)) pin = 0;
            let drawerCommand = {
                type: "raw",
                format: "hex",
                data: "1B70" + pin.toString(16).padStart(2, "0") + "3232"
            };
            console.log("[nextpos_printing] Drawer command fired:", drawerCommand.data);
            await qz.print(cfg, [drawerCommand])
                .then(() => console.log("Drawer opened after print"))
                .catch(err => console.error("Drawer open failed", err));
        }
    };

    // POS sidebar drawer → use mapped printer (production use)
    window.open_drawer = async () => {
        try {
            await ensureQZ();

            const posProfile = (cur_frm && cur_frm.doc && cur_frm.doc.pos_profile) || null;
            const mappingRes = await frappe.call({
                method: "nextpos_printing.api.settings.get_printer_for_pos",
                args: { pos_profile: posProfile }
            });

            if (!mappingRes.message || !mappingRes.message.printer) {
                frappe.msgprint("No printer mapping found for this POS Profile.");
                return;
            }

            let pin = parseInt(mappingRes.message.drawer_pin) || 2;
            let drawerCommand = {
                type: "raw",
                format: "hex",
                data: "1B70" + pin.toString(16).padStart(2, "0") + "3232"
            };

            const cfg = qz.configs.create(mappingRes.message.printer);
            await qz.print(cfg, [drawerCommand]);
            frappe.show_alert({ message: "Cash drawer opened", indicator: "green" });
        } catch (err) {
            frappe.msgprint("Failed to open drawer: " + err);
        }
    };

    // --- SIDEBAR BUTTONS ---
    function add_sidebar_buttons() {
        const posWrapper = document.querySelector("#page-point-of-sale .point-of-sale-app");
        if (!posWrapper || document.getElementById("npp-sidebar-left")) return;

        // Left Sidebar
        const left = document.createElement("div");
        left.id = "npp-sidebar-left";
        left.className = "npp-sidebar npp-left";
        left.innerHTML = `
            <button class="npp-btn" id="npp-btn-current" title="Print Current">
                <i class="fa fa-print"></i>
            </button>
            <button class="npp-btn" id="npp-btn-last" title="Reprint Last">
                <i class="fa fa-history"></i>
            </button>
        `;
        posWrapper.prepend(left);

        // Right Sidebar
        const right = document.createElement("div");
        right.id = "npp-sidebar-right";
        right.className = "npp-sidebar npp-right";
        right.innerHTML = `
            <button class="npp-btn" id="npp-btn-drawer" title="Open Drawer">
                <i class="fa fa-unlock-alt"></i>
            </button>
        `;
        posWrapper.appendChild(right);

        // Bind actions
        document.getElementById("npp-btn-current").onclick = async () => {
            const invoice = cur_frm && cur_frm.doc;
            if (!invoice || invoice.doctype !== "POS Invoice") {
                frappe.msgprint("No POS Invoice is currently open");
                return;
            }
            await printInvoiceWithQZ(invoice.name, false);
        };

        document.getElementById("npp-btn-last").onclick = async () => {
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

        document.getElementById("npp-btn-drawer").onclick = window.open_drawer;
    }

    // --- Replace ERPNext Print Receipt button ---
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
        newBtn.innerHTML = `<i class="fa fa-print"></i>`;

        newBtn.onclick = async () => {
            const invoice = cur_frm && cur_frm.doc;
            if (!invoice || invoice.doctype !== "POS Invoice") {
                frappe.msgprint("No POS Invoice is currently open");
                return;
            }
            await printInvoiceWithQZ(invoice.name);
        };

        host.prepend(newBtn);
    }

    // --- Observe for dynamic UI elements ---
    function watch_summary_btns() {
        const mo = new MutationObserver(() => replace_print_receipt_button());
        mo.observe(document.body, { childList: true, subtree: true });
    }

    function wait_for_toolbar_then_mount() {
        const mo = new MutationObserver((_m, obs) => {
            if (document.querySelector(".summary-btns")) {
                replace_print_receipt_button();
            }
            if (document.querySelector("#page-point-of-sale .point-of-sale-app")) {
                obs.disconnect();
                add_sidebar_buttons();
                return;
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => mo.disconnect(), 5000);
    }

    // --- Auto-print after POS Invoice save ---
    async function autoPrintIfEnabled(invoice) {
        try {
            const settings = await loadNextPOSSettings();

            if (settings && settings.enable_auto_print) {
                console.log("[nextpos_printing] Auto-print enabled, sending invoice", invoice.name);
                await printInvoiceWithQZ(invoice.name, true);
            }
        } catch (err) {
            console.error("[nextpos_printing] Auto-print check failed:", err);
        }
    }

    // --- POS route hooks ---
    async function on_pos_route() {
        const route = frappe.get_route_str && frappe.get_route_str();
        if (route === "point-of-sale") {
            // Ensure settings exist on POS load
            await loadNextPOSSettings();

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
