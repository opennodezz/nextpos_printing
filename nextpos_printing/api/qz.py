import base64
import json
import frappe
from cryptography.hazmat.primitives.serialization import (
    load_pem_private_key,
    Encoding,
    PublicFormat,
)
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend


@frappe.whitelist(allow_guest=True)
def qz_get_certificate():
    """Return publisher certificate PEM (string) for QZ Tray."""
    pem_b64 = frappe.conf.get("npp_cert_pem")
    if not pem_b64:
        frappe.throw("Missing npp_cert_pem in site_config.json")
    return base64.b64decode(pem_b64).decode("utf-8")


@frappe.whitelist(allow_guest=True)
def qz_sign():
    """Sign the raw string from QZ using RSA-SHA1 and return base64(signature)."""
    to_sign = frappe.form_dict.get("toSign")
    if not to_sign:
        frappe.throw("Missing toSign parameter")

    key_b64 = frappe.conf.get("npp_private_key")
    if not key_b64:
        frappe.throw(
            "Missing npp_private_key in site_config.json. "
            "Please generate and add RSA keypair to site config."
        )

    try:
        key_bytes = base64.b64decode(key_b64)
        private_key = load_pem_private_key(
            key_bytes, password=None, backend=default_backend()
        )
    except Exception as e:
        frappe.throw(f"Failed to load private key: {str(e)}")

    try:
        signature = private_key.sign(
            to_sign.encode("utf-8"), padding.PKCS1v15(), hashes.SHA1()
        )
        return base64.b64encode(signature).decode("utf-8")
    except Exception as e:
        frappe.throw(f"Signing failed: {str(e)}")


# 🔹 NEW: Generate or show RSA keys for QZ
@frappe.whitelist()
def qz_generate_or_show_keys():
    """Return QZ public key. Generate if not present, otherwise return existing one."""
    site_config_path = frappe.get_site_path("site_config.json")

    # Load current config
    with open(site_config_path) as f:
        site_conf = json.load(f)

    key_b64 = site_conf.get("npp_private_key")

    if not key_b64:
        # Generate fresh RSA keypair
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        private_pem = private_key.private_bytes(
            encoding=Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )

        # Save base64 private key to site_config.json
        site_conf["npp_private_key"] = base64.b64encode(private_pem).decode()
        with open(site_config_path, "w") as f:
            json.dump(site_conf, f, indent=2)
        frappe.clear_cache()

    else:
        # Load existing private key
        private_pem = base64.b64decode(key_b64)
        private_key = load_pem_private_key(private_pem, password=None, backend=default_backend())

    # Export public key
    public_pem = private_key.public_key().public_bytes(
        encoding=Encoding.PEM,
        format=PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    return {"public_key": public_pem, "newly_generated": not bool(key_b64)}
