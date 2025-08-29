import frappe

@frappe.whitelist()
def get_printer_for_pos(pos_profile):
    """Return printer mapping for a given POS Profile,
    with fallback to default printer and global cut mode."""
    settings = frappe.get_single("NextPOS Settings")

    # Default values
    printer = settings.default_printer
    cut_mode = settings.cut_mode or "Full Cut"
    feed_before_cut = settings.feed_before_cut or 5
    print_copies = settings.print_copies or 1

    # Try to find a specific mapping for this POS Profile
    for row in settings.printer_mappings:
        if row.pos_profile == pos_profile:
            printer = row.printer
            break

    return {
        "printer": printer,
        "cut_mode": cut_mode,
        "feed_before_cut": feed_before_cut,
        "print_copies": print_copies
    }
