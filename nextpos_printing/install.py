import frappe

def after_install():
    if not frappe.db.exists("DocType", "NextPOS Settings"):
        # programmatically create the single DocType
        doc = frappe.get_doc({
            "doctype": "DocType",
            "name": "NextPOS Settings",
            "module": "NextPOS",
            "custom": 1,
            "issingle": 1,
            "fields": []
        })
        doc.insert()
        frappe.db.commit()

    if not frappe.db.exists("NextPOS Settings"):
        frappe.get_doc({"doctype": "NextPOS Settings"}).insert()
        frappe.db.commit()
