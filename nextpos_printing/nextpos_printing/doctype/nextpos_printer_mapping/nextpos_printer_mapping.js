frappe.ui.form.on('NextPOS Printer Mapping', {
    printer: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (!row._printers_loaded) {
            if (window.qz) {
                qz.printers.find().then(printers => {
                    let df = frappe.meta.get_docfield(cdt, "printer", cdn);
                    df.options = printers;
                    row._printers_loaded = true;
                    frappe.model.set_value(cdt, cdn, "printer", printers[0] || "");
                }).catch(err => {
                    frappe.msgprint("Could not fetch printers. Make sure QZ Tray is running.");
                });
            } else {
                frappe.msgprint("QZ Tray not detected in browser.");
            }
        }
    }
});
