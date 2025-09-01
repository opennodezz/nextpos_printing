import frappe
from frappe.model.document import Document

class NextPOSSettings(Document):
    pass


@frappe.whitelist()
def run_setup_wizard():
    """Apply some sensible defaults so user doesn't need to configure too much manually."""
    settings = frappe.get_single("NextPOS Settings")

    # Set defaults only if not already set
    if not settings.default_printer:
        settings.default_printer = "Default Printer"
    if not settings.cut_mode:
        settings.cut_mode = "Full Cut"
    if not settings.feed_before_cut:
        settings.feed_before_cut = 5
    if not settings.print_copies:
        settings.print_copies = 1

    settings.enable_auto_print = 1
    settings.save(ignore_permissions=True)

    return "Setup Wizard applied defaults successfully"


@frappe.whitelist()
def test_drawer():
    """
    Old backend test drawer function. 
    (Kept for compatibility but frontend now uses first available printer).
    """
    return "Test drawer called – use Test Drawer button on UI"
