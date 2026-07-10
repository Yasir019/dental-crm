def fallback_template(name: str, service: str):
    return {
        "subject": f"Following up about your {service} inquiry",
        "body": (
            f"Hi {name},\n\n"
            f"Thank you for reaching out about {service}. We would be happy to help you schedule "
            "a consultation and answer any general questions about your visit.\n\n"
            "Please reply with your preferred appointment time, and our team will help confirm availability.\n\n"
            "Best regards,\nDentalLead Clinic Team"
        ),
    }
