frappe.ui.form.on("NextPOS Settings", {
    refresh: function(frm) {
        // --- Test Print ---
        if (frm.fields_dict.test_print) {
            frm.fields_dict.test_print.$input && frm.fields_dict.test_print.$input.on("click", async () => {
                frappe.show_alert({ message: "Sending test print…", indicator: "blue" });
                try {
                    if (window.ensureQZ && window.qz) {
                        await ensureQZ();

                        // Dummy test receipt
                        let data = [{
                            type: "raw",
                            data: [
                                "***** NEXTPOS TEST RECEIPT *****\n",
                                "Printer and QZ Tray connection OK\n",
                                "-------------------------------\n",
                                "Bananas       1 x 1.20   1.20\n",
                                "Apples        2 x 2.00   4.00\n",
                                "-------------------------------\n",
                                "TOTAL                  5.20\n",
                                "\n\n\n"
                            ].join("")
                        }];

                        let printers = await qz.printers.find();
                        if (!printers.length) {
                            frappe.msgprint("No printers found. Please check QZ Tray.");
                            return;
                        }

                        const cfg = qz.configs.create(printers[0]); // use first available printer
                        await qz.print(cfg, data);
                        frappe.show_alert({ message: "Test receipt sent", indicator: "green" });
                    } else {
                        frappe.msgprint("QZ Tray not connected. Open POS first.");
                    }
                } catch (err) {
                    frappe.msgprint("Test print failed: " + err);
                }
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

                        // ESC/POS drawer kick command (pin 2)
                        let drawerCommand = {
                            type: "raw",
                            format: "hex",
                            data: "1B70003232"
                        };

                        const cfg = qz.configs.create(printers[0]); // first available printer
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
    }
});
