import base64
import json
import frappe
from cryptography import x509
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.serialization import (
    load_pem_private_key,
    Encoding,
    PrivateFormat,
    NoEncryption,
)
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import NameOID
import datetime


@frappe.whitelist(allow_guest=True)
def qz_get_certificate():
    """Return publisher certificate PEM (string) for QZ Tray."""
    pem_b64 = frappe.conf.get("npp_cert_pem")
    if not pem_b64:
        frappe.throw("Missing npp_cert_pem in site_config.json. Please generate QZ keys first.")
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
            "Please generate QZ keys first."
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
            to_sign.encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA1()
        )
        return base64.b64encode(signature).decode("utf-8")
    except Exception as e:
        frappe.throw(f"Signing failed: {str(e)}")


# 🔹 Generate or show RSA keys + certificate for QZ
@frappe.whitelist()
def qz_generate_or_show_keys():
    """Generate or return existing RSA keypair + certificate for QZ Tray."""
    site_config_path = frappe.get_site_path("site_config.json")

    # Load current config
    with open(site_config_path) as f:
        site_conf = json.load(f)

    private_key = None
    cert_pem = site_conf.get("npp_cert_pem")
    key_b64 = site_conf.get("npp_private_key")

    if not key_b64 or not cert_pem:
        # Generate RSA key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )

        # Self-signed certificate (10 years validity)
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, u"CA"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"NextPOS"),
            x509.NameAttribute(NameOID.COMMON_NAME, u"NextPOS QZ Cert"),
        ])
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(private_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=3650))
            .add_extension(
                x509.BasicConstraints(ca=True, path_length=None), critical=True,
            )
            .sign(private_key, hashes.SHA256())
        )

        # PEM encode
        private_pem = private_key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=NoEncryption(),
        )
        cert_pem = cert.public_bytes(Encoding.PEM).decode()

        # Save both into site_config.json
        site_conf["npp_private_key"] = base64.b64encode(private_pem).decode()
        site_conf["npp_cert_pem"] = base64.b64encode(cert_pem.encode()).decode()
        with open(site_config_path, "w") as f:
            json.dump(site_conf, f, indent=2)
        frappe.clear_cache()

        newly_generated = True
    else:
        newly_generated = False

    return {"newly_generated": newly_generated, "certificate_available": True}


@frappe.whitelist()
def download_qz_certificate():
    """Download the QZ certificate as .pem file for import into QZ Tray."""
    cert_b64 = frappe.conf.get("npp_cert_pem")
    if not cert_b64:
        frappe.throw("No certificate found. Please generate QZ keys first.")

    cert_pem = base64.b64decode(cert_b64).decode()

    frappe.local.response.filename = "qz-public-cert.pem"
    frappe.local.response.filecontent = cert_pem
    frappe.local.response.type = "download"
