import frappe

@frappe.whitelist()
def get_printer_for_pos(pos_profile):
    """Return printer mapping for a given POS Profile, with fallback to default"""
    settings = frappe.get_single("NextPOS Settings")

    # Search child table for matching POS Profile
    for row in settings.printer_mappings:
        if row.pos_profile == pos_profile:
            return {
                "printer": row.printer,
                "auto_cut": row.auto_cut,
                "default_printer": settings.default_printer
            }

    # Fallback to default
    return {
        "printer": settings.default_printer,
        "auto_cut": 0,
        "default_printer": settings.default_printer
    }
