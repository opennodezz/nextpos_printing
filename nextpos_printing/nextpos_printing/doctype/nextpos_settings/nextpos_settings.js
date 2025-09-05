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
                if (r.message && r.message.public_key) {
                    const pubKey = r.message.public_key;
                    const newlyGenerated = r.message.newly_generated;

                    let html = `
                        <p>Private key is stored in <code>site_config.json</code>.</p>
                        <p>Copy the following Public Key into your QZ Tray trust store:</p>
                        <textarea readonly style="width:100%;height:200px;">${pubKey}</textarea>
                        <br>
                        <button class="btn btn-sm btn-primary" id="copy-qz-key">
                            Copy Public Key
                        </button>
                        <p>
                          See how to trust the key manually in QZ Tray.
                        </p>
                    `;

                    frappe.msgprint({
                        title: newlyGenerated ? "QZ Keys Generated" : "Existing QZ Keys Found",
                        indicator: "green",
                        message: html
                    });

                    // Safe clipboard logic with fallback
                    setTimeout(() => {
                        const btn = document.getElementById("copy-qz-key");
                        if (btn) {
                            const fallbackCopy = () => {
                                const el = document.createElement("textarea");
                                el.value = pubKey;
                                el.setAttribute("readonly", "");
                                el.style.position = "absolute";
                                el.style.left = "-9999px";
                                document.body.appendChild(el);
                                el.select();
                                document.execCommand("copy");
                                document.body.removeChild(el);
                                frappe.show_alert({
                                    message: "Public key copied to clipboard",
                                    indicator: "green"
                                });
                            };

                            const copyKey = () => {
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    navigator.clipboard.writeText(pubKey)
                                        .then(() => frappe.show_alert({ message: "Public key copied to clipboard", indicator: "green" }))
                                        .catch(err => {
                                            console.error("Clipboard API failed, using fallback:", err);
                                            fallbackCopy();
                                        });
                                } else {
                                    fallbackCopy();
                                }
                            };

                            btn.addEventListener("click", copyKey);
                        }
                    }, 300);
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
