"""Multilingual keyword registry for compliance domains."""

from typing import Dict, List, Optional


MULTILINGUAL_KEYWORDS: Dict[str, Dict] = {
    # =========================================================================
    # AML - Anti-Money Laundering
    # =========================================================================
    "AML": {
        "name": {
            "en": "Anti-Money Laundering",
            "de": "Geldwäscheprävention",
            "fr": "Lutte contre le blanchiment",
            "nl": "Anti-witwassen",
            "lu": "Géigewäschbekämpfung"
        },
        "keywords": {
            "en": [
                "anti-money laundering", "AML", "money laundering",
                "ML/TF", "financial crime", "proceeds of crime",
                "laundering", "illicit funds", "dirty money",
                "placement", "layering", "integration"
            ],
            "de": [
                "Geldwäsche", "GwG", "Geldwäschegesetz",
                "Geldwäschebekämpfung", "Geldwäscheprävention",
                "Terrorismusfinanzierung", "Geldwäscherisiko"
            ],
            "fr": [
                "blanchiment", "LCB-FT", "lutte contre le blanchiment",
                "blanchiment de capitaux", "LAB", "blanchiment d'argent",
                "capitaux illicites"
            ],
            "nl": [
                "witwassen", "Wwft", "anti-witwassen",
                "witwasbestrijding", "witwaswet", "witwaspraktijken",
                "crimineel geld"
            ],
            "lu": [
                "Blanchiment", "blanchiment d'argent", "LBC",
                "lutte contre le blanchiment"
            ]
        },
        "regulations": {
            "EU": ["AMLD4", "AMLD5", "AMLD6", "2015/849", "2018/843", "2024/1640"],
            "DE": ["GwG", "Geldwäschegesetz"],
            "FR": ["CMF L561", "Code monétaire et financier"],
            "NL": ["Wwft", "Wet ter voorkoming van witwassen"],
            "LU": ["Loi AML", "Loi du 12 novembre 2004"],
            "UK": ["MLR 2017", "POCA 2002"],
            "US": ["BSA", "Bank Secrecy Act", "AML Act 2020"]
        },
        "category_icon": "🏦"
    },

    # =========================================================================
    # KYC - Know Your Customer
    # =========================================================================
    "KYC": {
        "name": {
            "en": "Know Your Customer",
            "de": "Kenne deinen Kunden",
            "fr": "Connaissance du client",
            "nl": "Ken uw klant",
            "lu": "Connaissance du client"
        },
        "keywords": {
            "en": [
                "know your customer", "KYC", "customer identification",
                "CIP", "identity verification", "customer onboarding",
                "ID verification", "identity check", "customer identity",
                "identification requirements"
            ],
            "de": [
                "Kundenidentifizierung", "KYC", "Identifizierung",
                "Legitimationsprüfung", "Kundenkenntnis", "Identitätsprüfung",
                "Identitätsnachweis"
            ],
            "fr": [
                "connaissance client", "KYC", "identification client",
                "vérification d'identité", "identification du client",
                "pièce d'identité"
            ],
            "nl": [
                "cliëntidentificatie", "KYC", "ken uw klant",
                "cliëntenonderzoek", "identificatie", "identiteitsverificatie",
                "legitimatie"
            ],
            "lu": [
                "identification client", "KYC", "connaissance client",
                "vérification identité"
            ]
        },
        "regulations": {
            "EU": ["AMLD Article 13"],
            "US": ["CIP Rule", "31 CFR 1020.220"]
        },
        "category_icon": "🪪"
    },

    # =========================================================================
    # CDD - Customer Due Diligence
    # =========================================================================
    "CDD": {
        "name": {
            "en": "Customer Due Diligence",
            "de": "Kundensorgfaltspflichten",
            "fr": "Devoir de vigilance",
            "nl": "Cliëntenonderzoek",
            "lu": "Vigilance client"
        },
        "keywords": {
            "en": [
                "customer due diligence", "CDD", "due diligence",
                "standard due diligence", "SDD", "simplified due diligence",
                "ongoing due diligence", "ongoing monitoring",
                "risk assessment", "customer risk"
            ],
            "de": [
                "Sorgfaltspflichten", "CDD", "Kundensorgfaltspflichten",
                "verstärkte Sorgfaltspflichten", "vereinfachte Sorgfaltspflichten",
                "allgemeine Sorgfaltspflichten", "laufende Überwachung"
            ],
            "fr": [
                "vigilance", "obligation de vigilance", "mesures de vigilance",
                "vigilance simplifiée", "vigilance renforcée", "devoir de vigilance",
                "surveillance continue"
            ],
            "nl": [
                "cliëntenonderzoek", "CDD", "verscherpt cliëntenonderzoek",
                "vereenvoudigd cliëntenonderzoek", "doorlopend cliëntenonderzoek",
                "voortdurende controle"
            ],
            "lu": [
                "vigilance", "diligence", "mesures de vigilance",
                "obligations de vigilance"
            ]
        },
        "regulations": {
            "EU": ["AMLD Article 13", "AMLD Article 14", "AMLD Article 15"]
        },
        "category_icon": "🔍"
    },

    # =========================================================================
    # EDD - Enhanced Due Diligence
    # =========================================================================
    "EDD": {
        "name": {
            "en": "Enhanced Due Diligence",
            "de": "Verstärkte Sorgfaltspflichten",
            "fr": "Vigilance renforcée",
            "nl": "Verscherpt cliëntenonderzoek",
            "lu": "Vigilance renforcée"
        },
        "keywords": {
            "en": [
                "enhanced due diligence", "EDD", "enhanced measures",
                "high risk customer", "high-risk", "enhanced scrutiny",
                "additional measures", "heightened monitoring"
            ],
            "de": [
                "verstärkte Sorgfaltspflichten", "EDD", "erhöhte Sorgfalt",
                "Hochrisiko-Kunde", "erhöhtes Risiko", "verstärkte Maßnahmen",
                "verschärfte Prüfung"
            ],
            "fr": [
                "vigilance renforcée", "mesures renforcées",
                "client à haut risque", "risque élevé", "vigilance accrue",
                "mesures complémentaires"
            ],
            "nl": [
                "verscherpt cliëntenonderzoek", "EDD", "verhoogd risico",
                "hoog-risico klant", "verscherpte maatregelen",
                "aanvullende maatregelen"
            ],
            "lu": [
                "vigilance renforcée", "risque élevé", "mesures renforcées"
            ]
        },
        "regulations": {
            "EU": ["AMLD Article 18", "AMLD Article 18a", "AMLD Article 18b"]
        },
        "category_icon": "🔎"
    },

    # =========================================================================
    # UBO - Ultimate Beneficial Owner
    # =========================================================================
    "UBO": {
        "name": {
            "en": "Ultimate Beneficial Owner",
            "de": "Wirtschaftlich Berechtigter",
            "fr": "Bénéficiaire effectif",
            "nl": "Uiteindelijk belanghebbende",
            "lu": "Bénéficiaire effectif"
        },
        "keywords": {
            "en": [
                "beneficial owner", "UBO", "ultimate beneficial owner",
                "beneficial ownership", "controlling person", "25%",
                "ownership structure", "control structure", "true owner",
                "natural person"
            ],
            "de": [
                "wirtschaftlich Berechtigter", "UBO", "wirtschaftliche Berechtigung",
                "Begünstigter", "25%", "25 Prozent", "Eigentümerstruktur",
                "Kontrollstruktur", "wirtschaftlicher Eigentümer"
            ],
            "fr": [
                "bénéficiaire effectif", "UBO", "propriétaire effectif",
                "ayant droit économique", "25%", "structure de propriété",
                "personne physique"
            ],
            "nl": [
                "uiteindelijk belanghebbende", "UBO", "uiteindelijke begunstigde",
                "25%", "eigendomsstructuur", "feitelijke zeggenschap"
            ],
            "lu": [
                "bénéficiaire effectif", "ayant droit économique", "25%",
                "propriétaire réel"
            ]
        },
        "regulations": {
            "EU": ["AMLD Article 3(6)", "UBO Directive"]
        },
        "category_icon": "👤"
    },

    # =========================================================================
    # PEP - Politically Exposed Person
    # =========================================================================
    "PEP": {
        "name": {
            "en": "Politically Exposed Person",
            "de": "Politisch exponierte Person",
            "fr": "Personne politiquement exposée",
            "nl": "Politiek prominent persoon",
            "lu": "Personne politiquement exposée"
        },
        "keywords": {
            "en": [
                "politically exposed person", "PEP", "PEPs",
                "senior political figure", "domestic PEP", "foreign PEP",
                "family member of PEP", "close associate",
                "prominent public function", "government official"
            ],
            "de": [
                "politisch exponierte Person", "PEP", "PeP",
                "politisch exponiert", "inländische PEP", "ausländische PEP",
                "Familienangehöriger", "nahestehende Person"
            ],
            "fr": [
                "personne politiquement exposée", "PPE", "PEP",
                "personne exposée politiquement", "PPE nationale",
                "PPE étrangère", "membre de la famille", "proche collaborateur"
            ],
            "nl": [
                "politiek prominent persoon", "PEP", "politiek prominente persoon",
                "binnenlandse PEP", "buitenlandse PEP", "familielid",
                "naaste geassocieerde"
            ],
            "lu": [
                "personne politiquement exposée", "PPE",
                "personne exposée politiquement"
            ]
        },
        "regulations": {
            "EU": ["AMLD Article 3(9)", "AMLD Article 20", "AMLD Article 23"]
        },
        "category_icon": "🏛️"
    },

    # =========================================================================
    # SANCTIONS - Sanctions Compliance
    # =========================================================================
    "SANCTIONS": {
        "name": {
            "en": "Sanctions Compliance",
            "de": "Sanktions-Compliance",
            "fr": "Conformité aux sanctions",
            "nl": "Sanctie-compliance",
            "lu": "Conformité aux sanctions"
        },
        "keywords": {
            "en": [
                "sanctions", "sanctions screening", "OFAC", "SDN list",
                "embargo", "restricted party", "blocked person",
                "sanctions list", "EU sanctions", "UN sanctions",
                "designated person", "restrictive measures"
            ],
            "de": [
                "Sanktionen", "Sanktionsprüfung", "Embargo",
                "Sanktionsliste", "Finanzsanktionen", "EU-Sanktionen",
                "UN-Sanktionen", "Sanktionslistenprüfung", "Embargoprüfung"
            ],
            "fr": [
                "sanctions", "gel des avoirs", "embargo",
                "liste des sanctions", "mesures restrictives",
                "sanctions européennes", "sanctions ONU", "personne désignée"
            ],
            "nl": [
                "sancties", "sanctiescreening", "embargo",
                "sanctielijst", "bevriezing van tegoeden",
                "EU-sancties", "VN-sancties", "sanctietoetsing"
            ],
            "lu": [
                "sanctions", "embargo", "gel des avoirs",
                "mesures restrictives", "liste de sanctions"
            ]
        },
        "regulations": {
            "EU": ["EU Regulation 2580/2001", "EU Sanctions Framework"],
            "US": ["OFAC Regulations", "31 CFR Chapter V"],
            "UN": ["UN Security Council Resolutions"]
        },
        "category_icon": "🚫"
    },

    # =========================================================================
    # STR - Suspicious Transaction Reporting
    # =========================================================================
    "STR": {
        "name": {
            "en": "Suspicious Transaction Reporting",
            "de": "Verdachtsmeldung",
            "fr": "Déclaration de soupçon",
            "nl": "Melding ongebruikelijke transactie",
            "lu": "Déclaration de soupçon"
        },
        "keywords": {
            "en": [
                "suspicious transaction report", "STR", "SAR",
                "suspicious activity report", "reporting obligation",
                "FIU", "financial intelligence unit", "unusual transaction",
                "mandatory reporting", "tipping off"
            ],
            "de": [
                "Verdachtsmeldung", "Verdachtsanzeige", "SAR",
                "Geldwäscheverdacht", "FIU", "Zentralstelle",
                "Meldepflicht", "verdächtige Transaktion", "ungewöhnliche Transaktion"
            ],
            "fr": [
                "déclaration de soupçon", "DOS", "TRACFIN",
                "obligation de déclaration", "cellule de renseignement",
                "transaction suspecte", "CRF"
            ],
            "nl": [
                "ongebruikelijke transactie", "MOT", "FIU-Nederland",
                "meldplicht", "verdachte transactie", "meldingsplicht",
                "FIU", "melding"
            ],
            "lu": [
                "déclaration de soupçon", "CRF",
                "cellule de renseignement financier", "obligation de déclaration"
            ]
        },
        "regulations": {
            "EU": ["AMLD Article 33", "AMLD Article 34"],
            "US": ["31 CFR 1020.320"],
            "UK": ["POCA 2002 Part 7"]
        },
        "category_icon": "📋"
    },

    # =========================================================================
    # GDPR - Data Protection
    # =========================================================================
    "GDPR": {
        "name": {
            "en": "Data Protection (GDPR)",
            "de": "Datenschutz (DSGVO)",
            "fr": "Protection des données (RGPD)",
            "nl": "Gegevensbescherming (AVG)",
            "lu": "Protection des données (RGPD)"
        },
        "keywords": {
            "en": [
                "data protection", "GDPR", "personal data", "privacy",
                "data subject", "data controller", "data processor",
                "consent", "right to erasure", "data breach",
                "privacy notice", "data processing"
            ],
            "de": [
                "Datenschutz", "DSGVO", "personenbezogene Daten",
                "Betroffenenrechte", "Verantwortlicher", "Auftragsverarbeiter",
                "Einwilligung", "Löschung", "Datenschutzverletzung"
            ],
            "fr": [
                "protection des données", "RGPD", "données personnelles",
                "vie privée", "personne concernée", "responsable du traitement",
                "consentement", "droit à l'effacement"
            ],
            "nl": [
                "gegevensbescherming", "AVG", "persoonsgegevens",
                "privacy", "betrokkene", "verwerkingsverantwoordelijke",
                "toestemming", "recht op vergetelheid"
            ],
            "lu": [
                "protection des données", "RGPD", "données personnelles",
                "consentement"
            ]
        },
        "regulations": {
            "EU": ["GDPR", "Regulation (EU) 2016/679"],
            "DE": ["BDSG"],
            "FR": ["Loi Informatique et Libertés"],
            "UK": ["UK GDPR", "Data Protection Act 2018"]
        },
        "category_icon": "🔒"
    },

    # =========================================================================
    # RISK - Risk Assessment
    # =========================================================================
    "RISK": {
        "name": {
            "en": "Risk Assessment",
            "de": "Risikobewertung",
            "fr": "Évaluation des risques",
            "nl": "Risicobeoordeling",
            "lu": "Évaluation des risques"
        },
        "keywords": {
            "en": [
                "risk assessment", "risk-based approach", "RBA",
                "risk factors", "risk appetite", "risk tolerance",
                "inherent risk", "residual risk", "risk mitigation",
                "risk scoring", "customer risk assessment"
            ],
            "de": [
                "Risikobewertung", "risikobasierter Ansatz", "Risikofaktoren",
                "Risikoappetit", "Risikotoleranz", "inhärentes Risiko",
                "Restrisiko", "Risikominderung"
            ],
            "fr": [
                "évaluation des risques", "approche fondée sur les risques",
                "facteurs de risque", "appétit pour le risque",
                "risque inhérent", "risque résiduel"
            ],
            "nl": [
                "risicobeoordeling", "risicogebaseerde benadering",
                "risicofactoren", "risicobereidheid", "inherent risico",
                "restrisico"
            ],
            "lu": [
                "évaluation des risques", "approche basée sur les risques",
                "facteurs de risque"
            ]
        },
        "regulations": {
            "EU": ["AMLD Article 8"],
            "FATF": ["FATF Recommendation 1"]
        },
        "category_icon": "📊"
    },
}


def get_keywords_for_domain(
    domain: str,
    language: str = "en",
    include_all_languages: bool = False
) -> List[str]:
    """
    Get keywords for a specific domain and language.
    
    Args:
        domain: Domain code (e.g., "AML", "KYC")
        language: Language code (e.g., "en", "de")
        include_all_languages: If True, return keywords from all languages
    
    Returns:
        List of keywords
    """
    if domain not in MULTILINGUAL_KEYWORDS:
        return []
    
    domain_data = MULTILINGUAL_KEYWORDS[domain]
    keywords = domain_data.get("keywords", {})
    
    if include_all_languages:
        all_keywords = []
        for lang_keywords in keywords.values():
            all_keywords.extend(lang_keywords)
        return list(set(all_keywords))
    
    return keywords.get(language, keywords.get("en", []))


def get_domain_name(domain: str, language: str = "en") -> str:
    """Get the display name for a domain in a specific language."""
    if domain not in MULTILINGUAL_KEYWORDS:
        return domain
    
    names = MULTILINGUAL_KEYWORDS[domain].get("name", {})
    return names.get(language, names.get("en", domain))


def get_all_domains() -> List[str]:
    """Get list of all available domain codes."""
    return list(MULTILINGUAL_KEYWORDS.keys())


def get_domain_icon(domain: str) -> str:
    """Get the icon for a domain."""
    if domain not in MULTILINGUAL_KEYWORDS:
        return "📋"
    return MULTILINGUAL_KEYWORDS[domain].get("category_icon", "📋")
