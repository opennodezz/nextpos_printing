frappe.ui.form.on("NextPOS Settings", {
    refresh: function(frm) {
        // --- Test Print (simplified) ---
        if (frm.fields_dict.test_print) {
            frm.fields_dict.test_print.$input && frm.fields_dict.test_print.$input.on("click", () => {
                frappe.msgprint("Test printing is only available from the POS screen. Please open POS first.");
            });
        }

        // --- Test Drawer ---
        if (frm.fields_dict.test_drawer) {
            frm.fields_dict.test_drawer.$input && frm.fields_dict.test_drawer.$input.on("click", async () => {
                frappe.show_alert({ message: "Sending drawer open command…", indicator: "blue" });
                try {
                    if (window.ensureQZ && window.qz) {
                        await ensureQZ();
                        let printers = await qz.printers.find();
                        if (!printers.length) {
                            frappe.msgprint("No printers found. Please check QZ Tray.");
                            return;
                        }
                        const drawerCommand = {
                            type: "raw",
                            format: "hex",
                            data: "1B70003232" // pin 2 command
                        };
                        const cfg = qz.configs.create(printers[0]);
                        await qz.print(cfg, [drawerCommand]);
                        frappe.show_alert({ message: "Drawer test command sent", indicator: "green" });
                    } else {
                        frappe.msgprint("QZ Tray not connected. Open POS first.");
                    }
                } catch (err) {
                    frappe.msgprint("Drawer test failed: " + err);
                }
            });
        }

        // --- Run Setup Wizard ---
        if (frm.fields_dict.run_setup_wizard) {
            frm.fields_dict.run_setup_wizard.$input && frm.fields_dict.run_setup_wizard.$input.on("click", () => {
                frappe.call({
                    method: "nextpos_printing.nextpos_printing.doctype.nextpos_settings.nextpos_settings.run_setup_wizard",
                    callback: function(r) {
                        if (!r.exc) {
                            frappe.show_alert({ message: r.message || "Setup Wizard finished", indicator: "green" });
                            frm.reload_doc();
                        }
                    }
                });
            });
        }

        // --- Show/Generate QZ Keys ---
        frm.add_custom_button("Show/Generate QZ Keys", function() {
            frappe.call({
                method: "nextpos_printing.api.qz.qz_generate_or_show_keys",
            }).then(r => {
                if (r.message && r.message.certificate_available) {
                    const newlyGenerated = r.message.newly_generated;

                    let html = `
                        <p>Private key is stored in <code>site_config.json</code>.</p>
                        <p>Download the certificate below and import it into QZ Tray:</p>
                        <a href="/api/method/nextpos_printing.api.qz.download_qz_certificate"
                           class="btn btn-sm btn-primary">
                           Download Certificate (.pem)
                        </a>
                        <p>
                          In QZ Tray, go to <b>Advanced → Site Manager</b> and import this file.
                        </p>
                    `;

                    frappe.msgprint({
                        title: newlyGenerated ? "QZ Keys Generated" : "Existing QZ Keys Found",
                        indicator: "green",
                        message: html
                    });
                }
            }).catch(err => {
                frappe.msgprint({
                    title: "Error",
                    indicator: "red",
                    message: err.message || err
                });
            });
        });
    }
});
