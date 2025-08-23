import frappe

@frappe.whitelist()
def get_print_payload(pos_invoice_name: str=None):
    """Return ESC/POS print payload for the given POS Invoice."""
    invoice = frappe.get_doc("POS Invoice", pos_invoice_name)

    # Step 1: build header
    lines = []
    lines.append("     My Shop Name     ")
    lines.append("123 Sample Street")
    lines.append("--------------------------")

    # Step 2: items
    for item in invoice.items:
        name = item.item_name[:20]   # truncate long names
        qty = f"{item.qty:.0f}"
        rate = f"{item.rate:.2f}"
        amt = f"{item.amount:.2f}"
        lines.append(f"{name} {qty} x {rate} {amt}")

    # Step 3: totals
    lines.append("--------------------------")
    lines.append(f"TOTAL: {invoice.grand_total:.2f}")
    lines.append(f"Paid:  {invoice.paid_amount:.2f}")
    lines.append(f"Change:{invoice.change_amount:.2f}")

    # Step 4: footer
    lines.append("--------------------------")
    lines.append("  Thank you, come again! ")
    lines.append("\n\n\n")  # feed

    # Step 5: add cut command
    cut_cmd = '\x1D\x56\x00'   # full cut
    payload = "\n".join(lines) + cut_cmd

    # Return in QZ raw format
    return [{
        "type": "raw",
        "format": "command",
        "data": payload
    }]
