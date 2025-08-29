import frappe
from nextpos_printing.printing.receipt import render_invoice

@frappe.whitelist()
def get_print_payload(pos_invoice_name):
    return render_invoice(pos_invoice_name)