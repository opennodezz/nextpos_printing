# nextpos_printing/install.py
import frappe

def create_default_settings():
    """Ensure a default NextPOS Setting document exists after install."""
    if not frappe.db.exists("NextPOS Setting"):
        doc = frappe.get_doc({
            "doctype": "NextPOS Setting",
            "setting_name": "Default",
            "enable_printing": 1,
            "default_printer": ""
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
