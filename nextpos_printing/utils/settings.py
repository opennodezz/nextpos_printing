import frappe


def get_printer_for_pos(pos_profile=None):
    """Return printer mapping for a given POS Profile,
    with fallback to default printer and global cut mode."""
    settings = get_nextpos_settings()

    # Default values
    printer = settings.default_printer
    cut_mode = settings.cut_mode or "Full Cut"
    feed_before_cut = settings.feed_before_cut or 5
    print_copies = settings.print_copies or 1
    drawer_pin = settings.drawer_pin
    open_cash_drawer = bool(settings.open_cash_drawer)

    # Try to find a specific mapping for this POS Profile
    if hasattr(settings, "printer_mappings"):
        for row in settings.printer_mappings:
            if row.pos_profile == pos_profile:
                printer = row.printer
                break

    return {
        "printer": printer,
        "cut_mode": cut_mode,
        "feed_before_cut": feed_before_cut,
        "print_copies": print_copies,
        "drawer_pin": drawer_pin,
        "open_cash_drawer": open_cash_drawer,
    }


def get_nextpos_settings():
    """Return the single NextPOS Settings document."""
    return frappe.get_single("NextPOS Settings")
