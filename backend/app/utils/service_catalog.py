SERVICE_CATALOG = [
    {"name": "General Dentistry", "description": "Preventive checkups, exams, diagnosis, and routine dental care."},
    {"name": "Cosmetic Dentistry", "description": "Smile-focused treatments that improve tooth shape, color, and appearance."},
    {"name": "Pediatric Dentistry", "description": "Gentle dental care, checkups, and prevention for children."},
    {"name": "Scaling & Polishing", "description": "Professional cleaning to remove plaque and surface stains."},
    {"name": "Maxillofacial Surgery", "description": "Specialist assessment and treatment planning for facial and jaw conditions."},
    {"name": "Dental Fillings", "description": "Repair for cavities and damaged teeth using durable filling materials."},
    {"name": "Root Canal", "description": "Treatment to remove infection, relieve pain, and preserve a natural tooth."},
    {"name": "Teeth Whitening", "description": "Professional treatment for a brighter, more even smile."},
    {"name": "Orthodontics", "description": "Braces and comprehensive treatment for tooth and bite alignment."},
    {"name": "Tooth Extraction", "description": "Careful removal of a tooth when restoration is not appropriate."},
    {"name": "Dental Crowns", "description": "Custom caps that protect, strengthen, and restore damaged teeth."},
    {"name": "Veneers", "description": "Thin custom shells that refine the shape, spacing, and appearance of teeth."},
    {"name": "Dental Implants", "description": "Long-term tooth replacement planned for missing teeth."},
    {"name": "Dentures", "description": "Removable custom solutions that restore chewing function and confidence."},
    {"name": "Clear Aligners", "description": "Discreet removable trays for selected tooth alignment cases."},
    {"name": "Gum Recontouring", "description": "Gumline reshaping to create a more balanced smile appearance."}
]


def service_catalog_text() -> str:
    return "\n".join(f"- {item['name']}: {item['description']}" for item in SERVICE_CATALOG)


def service_names_text() -> str:
    return "\n".join(f"- {item['name']}" for item in SERVICE_CATALOG)
