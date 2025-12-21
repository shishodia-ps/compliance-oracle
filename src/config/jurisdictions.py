"""Jurisdiction and regulatory benchmark registry."""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field


@dataclass
class RegulatorySource:
    """A single regulatory source/benchmark."""
    name: str
    full_name: str
    citation: str
    url: Optional[str] = None
    is_primary: bool = False
    language: str = "en"


@dataclass
class Regulator:
    """Regulatory authority information."""
    name: str
    full_name: str
    url: str


@dataclass
class JurisdictionConfig:
    """Configuration for a jurisdiction."""
    code: str
    name: str
    flag: str
    primary_language: str
    supported_languages: List[str]
    inherit_from: Optional[str] = None  # Inherit benchmarks from parent (e.g., EU)
    is_supranational: bool = False
    benchmarks: Dict[str, List[RegulatorySource]] = field(default_factory=dict)
    regulator: Optional[Regulator] = None


JURISDICTION_REGISTRY: Dict[str, JurisdictionConfig] = {
    # =========================================================================
    # European Union (Supranational)
    # =========================================================================
    "EU": JurisdictionConfig(
        code="EU",
        name="European Union",
        flag="🇪🇺",
        primary_language="en",
        supported_languages=["en", "de", "fr", "nl", "it", "es"],
        is_supranational=True,
        benchmarks={
            "AML": [
                RegulatorySource(
                    name="AMLD6",
                    full_name="6th Anti-Money Laundering Directive",
                    citation="Directive (EU) 2024/1640",
                    url="https://eur-lex.europa.eu/eli/dir/2024/1640/oj",
                    is_primary=True
                ),
                RegulatorySource(
                    name="AMLD5",
                    full_name="5th Anti-Money Laundering Directive",
                    citation="Directive (EU) 2018/843",
                    url="https://eur-lex.europa.eu/eli/dir/2018/843/oj"
                ),
                RegulatorySource(
                    name="AMLD4",
                    full_name="4th Anti-Money Laundering Directive",
                    citation="Directive (EU) 2015/849",
                    url="https://eur-lex.europa.eu/eli/dir/2015/849/oj"
                ),
            ],
            "GDPR": [
                RegulatorySource(
                    name="GDPR",
                    full_name="General Data Protection Regulation",
                    citation="Regulation (EU) 2016/679",
                    url="https://eur-lex.europa.eu/eli/reg/2016/679/oj",
                    is_primary=True
                ),
            ],
            "SANCTIONS": [
                RegulatorySource(
                    name="EU Sanctions Framework",
                    full_name="EU Restrictive Measures Framework",
                    citation="Various EU Regulations",
                    url="https://www.sanctionsmap.eu/",
                    is_primary=True
                ),
            ],
            "MIFID": [
                RegulatorySource(
                    name="MiFID II",
                    full_name="Markets in Financial Instruments Directive II",
                    citation="Directive 2014/65/EU",
                    url="https://eur-lex.europa.eu/eli/dir/2014/65/oj",
                    is_primary=True
                ),
            ],
            "PSD2": [
                RegulatorySource(
                    name="PSD2",
                    full_name="Payment Services Directive 2",
                    citation="Directive (EU) 2015/2366",
                    url="https://eur-lex.europa.eu/eli/dir/2015/2366/oj",
                    is_primary=True
                ),
            ],
            "DORA": [
                RegulatorySource(
                    name="DORA",
                    full_name="Digital Operational Resilience Act",
                    citation="Regulation (EU) 2022/2554",
                    url="https://eur-lex.europa.eu/eli/reg/2022/2554/oj",
                    is_primary=True
                ),
            ],
        }
    ),

    # =========================================================================
    # Luxembourg
    # =========================================================================
    "LU": JurisdictionConfig(
        code="LU",
        name="Luxembourg",
        flag="🇱🇺",
        primary_language="fr",
        supported_languages=["fr", "de", "lu", "en"],
        inherit_from="EU",
        benchmarks={
            "AML": [
                RegulatorySource(
                    name="Luxembourg AML Law",
                    full_name="Loi du 12 novembre 2004 relative à la lutte contre le blanchiment",
                    citation="Loi du 12 novembre 2004",
                    url="https://legilux.public.lu/eli/etat/leg/loi/2004/11/12/n1/jo",
                    is_primary=True,
                    language="fr"
                ),
                RegulatorySource(
                    name="CSSF Regulation 12-02",
                    full_name="CSSF Regulation N° 12-02 on AML/CFT",
                    citation="CSSF Reg. 12-02",
                    url="https://www.cssf.lu/en/Document/cssf-regulation-n-12-02/"
                ),
                RegulatorySource(
                    name="Grand-Ducal Regulation",
                    full_name="Règlement grand-ducal du 1er février 2010",
                    citation="RGD 1 février 2010",
                    url="https://legilux.public.lu/eli/etat/leg/rgd/2010/02/01/n1/jo",
                    language="fr"
                ),
            ],
        },
        regulator=Regulator(
            name="CSSF",
            full_name="Commission de Surveillance du Secteur Financier",
            url="https://www.cssf.lu/"
        )
    ),

    # =========================================================================
    # Netherlands
    # =========================================================================
    "NL": JurisdictionConfig(
        code="NL",
        name="Netherlands",
        flag="🇳🇱",
        primary_language="nl",
        supported_languages=["nl", "en"],
        inherit_from="EU",
        benchmarks={
            "AML": [
                RegulatorySource(
                    name="Wwft",
                    full_name="Wet ter voorkoming van witwassen en financieren van terrorisme",
                    citation="Wwft",
                    url="https://wetten.overheid.nl/BWBR0024282/",
                    is_primary=True,
                    language="nl"
                ),
                RegulatorySource(
                    name="DNB Guidance",
                    full_name="DNB Leidraad Wwft en Sanctiewet",
                    citation="DNB Leidraad",
                    url="https://www.dnb.nl/en/sector-information/supervision-stages/ongoing-supervision/integrity-supervision/"
                ),
            ],
        },
        regulator=Regulator(
            name="DNB",
            full_name="De Nederlandsche Bank",
            url="https://www.dnb.nl/"
        )
    ),

    # =========================================================================
    # Germany
    # =========================================================================
    "DE": JurisdictionConfig(
        code="DE",
        name="Germany",
        flag="🇩🇪",
        primary_language="de",
        supported_languages=["de", "en"],
        inherit_from="EU",
        benchmarks={
            "AML": [
                RegulatorySource(
                    name="GwG",
                    full_name="Geldwäschegesetz",
                    citation="GwG",
                    url="https://www.gesetze-im-internet.de/gwg_2017/",
                    is_primary=True,
                    language="de"
                ),
                RegulatorySource(
                    name="BaFin AML Guidelines",
                    full_name="BaFin Auslegungs- und Anwendungshinweise zum Geldwäschegesetz",
                    citation="BaFin AuA GwG",
                    url="https://www.bafin.de/"
                ),
            ],
        },
        regulator=Regulator(
            name="BaFin",
            full_name="Bundesanstalt für Finanzdienstleistungsaufsicht",
            url="https://www.bafin.de/"
        )
    ),

    # =========================================================================
    # France
    # =========================================================================
    "FR": JurisdictionConfig(
        code="FR",
        name="France",
        flag="🇫🇷",
        primary_language="fr",
        supported_languages=["fr", "en"],
        inherit_from="EU",
        benchmarks={
            "AML": [
                RegulatorySource(
                    name="CMF LCB-FT",
                    full_name="Code monétaire et financier - Lutte contre le blanchiment",
                    citation="CMF L561-1 et seq.",
                    url="https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072026/LEGISCTA000006154360/",
                    is_primary=True,
                    language="fr"
                ),
                RegulatorySource(
                    name="ACPR Guidelines",
                    full_name="Lignes directrices ACPR LCB-FT",
                    citation="ACPR LCB-FT",
                    url="https://acpr.banque-france.fr/"
                ),
            ],
        },
        regulator=Regulator(
            name="ACPR",
            full_name="Autorité de contrôle prudentiel et de résolution",
            url="https://acpr.banque-france.fr/"
        )
    ),

    # =========================================================================
    # Belgium
    # =========================================================================
    "BE": JurisdictionConfig(
        code="BE",
        name="Belgium",
        flag="🇧🇪",
        primary_language="fr",  # Official languages: fr, nl, de
        supported_languages=["fr", "nl", "de", "en"],
        inherit_from="EU",
        benchmarks={
            "AML": [
                RegulatorySource(
                    name="Belgian AML Law",
                    full_name="Loi du 18 septembre 2017 relative à la prévention du blanchiment",
                    citation="Loi du 18 septembre 2017",
                    url="https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=2017091807",
                    is_primary=True,
                    language="fr"
                ),
            ],
        },
        regulator=Regulator(
            name="NBB",
            full_name="National Bank of Belgium",
            url="https://www.nbb.be/"
        )
    ),

    # =========================================================================
    # United Kingdom
    # =========================================================================
    "UK": JurisdictionConfig(
        code="UK",
        name="United Kingdom",
        flag="🇬🇧",
        primary_language="en",
        supported_languages=["en"],
        inherit_from=None,  # No longer inherits from EU post-Brexit
        benchmarks={
            "AML": [
                RegulatorySource(
                    name="MLR 2017",
                    full_name="Money Laundering, Terrorist Financing and Transfer of Funds Regulations 2017",
                    citation="MLR 2017 (SI 2017/692)",
                    url="https://www.legislation.gov.uk/uksi/2017/692/",
                    is_primary=True
                ),
                RegulatorySource(
                    name="FCA FC Guide",
                    full_name="FCA Financial Crime Guide",
                    citation="FCA FCG",
                    url="https://www.fca.org.uk/publication/finalised-guidance/fg-final-guidance-financial-crime-guide.pdf"
                ),
                RegulatorySource(
                    name="POCA 2002",
                    full_name="Proceeds of Crime Act 2002",
                    citation="POCA 2002",
                    url="https://www.legislation.gov.uk/ukpga/2002/29/"
                ),
            ],
            "GDPR": [
                RegulatorySource(
                    name="UK GDPR",
                    full_name="UK General Data Protection Regulation",
                    citation="UK GDPR",
                    url="https://www.legislation.gov.uk/eur/2016/679/",
                    is_primary=True
                ),
                RegulatorySource(
                    name="DPA 2018",
                    full_name="Data Protection Act 2018",
                    citation="DPA 2018",
                    url="https://www.legislation.gov.uk/ukpga/2018/12/"
                ),
            ],
            "SANCTIONS": [
                RegulatorySource(
                    name="UK Sanctions",
                    full_name="UK Sanctions and Anti-Money Laundering Act 2018",
                    citation="SAMLA 2018",
                    url="https://www.legislation.gov.uk/ukpga/2018/13/",
                    is_primary=True
                ),
            ],
        },
        regulator=Regulator(
            name="FCA",
            full_name="Financial Conduct Authority",
            url="https://www.fca.org.uk/"
        )
    ),

    # =========================================================================
    # United States
    # =========================================================================
    "US": JurisdictionConfig(
        code="US",
        name="United States",
        flag="🇺🇸",
        primary_language="en",
        supported_languages=["en"],
        inherit_from=None,
        benchmarks={
            "AML": [
                RegulatorySource(
                    name="BSA",
                    full_name="Bank Secrecy Act",
                    citation="31 USC 5311 et seq.",
                    url="https://www.fincen.gov/resources/statutes-and-regulations",
                    is_primary=True
                ),
                RegulatorySource(
                    name="AML Act 2020",
                    full_name="Anti-Money Laundering Act of 2020",
                    citation="AML Act 2020",
                    url="https://www.fincen.gov/anti-money-laundering-act-2020"
                ),
                RegulatorySource(
                    name="FinCEN CDD Rule",
                    full_name="Customer Due Diligence Requirements for Financial Institutions",
                    citation="31 CFR 1010.230",
                    url="https://www.fincen.gov/resources/statutes-regulations/guidance/customer-due-diligence-requirements"
                ),
                RegulatorySource(
                    name="FFIEC Manual",
                    full_name="FFIEC BSA/AML Examination Manual",
                    citation="FFIEC BSA/AML Manual",
                    url="https://bsaaml.ffiec.gov/manual"
                ),
            ],
            "SANCTIONS": [
                RegulatorySource(
                    name="OFAC Regulations",
                    full_name="Office of Foreign Assets Control Regulations",
                    citation="31 CFR Chapter V",
                    url="https://ofac.treasury.gov/sanctions-programs-and-country-information",
                    is_primary=True
                ),
            ],
        },
        regulator=Regulator(
            name="FinCEN",
            full_name="Financial Crimes Enforcement Network",
            url="https://www.fincen.gov/"
        )
    ),

    # =========================================================================
    # Switzerland
    # =========================================================================
    "CH": JurisdictionConfig(
        code="CH",
        name="Switzerland",
        flag="🇨🇭",
        primary_language="de",
        supported_languages=["de", "fr", "it", "en"],
        inherit_from=None,
        benchmarks={
            "AML": [
                RegulatorySource(
                    name="GwG",
                    full_name="Geldwäschereigesetz",
                    citation="GwG (SR 955.0)",
                    url="https://www.fedlex.admin.ch/eli/cc/1998/892_892_892/de",
                    is_primary=True,
                    language="de"
                ),
                RegulatorySource(
                    name="FINMA AML Ordinance",
                    full_name="FINMA Anti-Money Laundering Ordinance",
                    citation="GwV-FINMA",
                    url="https://www.finma.ch/"
                ),
            ],
        },
        regulator=Regulator(
            name="FINMA",
            full_name="Swiss Financial Market Supervisory Authority",
            url="https://www.finma.ch/"
        )
    ),
}


def get_jurisdiction_config(code: str) -> Optional[JurisdictionConfig]:
    """Get configuration for a jurisdiction."""
    return JURISDICTION_REGISTRY.get(code)


def get_all_jurisdictions() -> List[str]:
    """Get list of all jurisdiction codes."""
    return list(JURISDICTION_REGISTRY.keys())


def get_benchmarks_for_jurisdiction(
    jurisdiction_code: str,
    domain: str,
    include_inherited: bool = True
) -> List[RegulatorySource]:
    """
    Get all benchmarks for a jurisdiction and domain.
    
    Args:
        jurisdiction_code: Jurisdiction code (e.g., "LU")
        domain: Domain code (e.g., "AML")
        include_inherited: Include benchmarks from parent jurisdiction (e.g., EU)
    
    Returns:
        List of regulatory sources
    """
    config = get_jurisdiction_config(jurisdiction_code)
    if not config:
        return []
    
    benchmarks = config.benchmarks.get(domain, [])
    
    # Include inherited benchmarks (e.g., EU for Luxembourg)
    if include_inherited and config.inherit_from:
        parent_config = get_jurisdiction_config(config.inherit_from)
        if parent_config:
            parent_benchmarks = parent_config.benchmarks.get(domain, [])
            # Add parent benchmarks after local ones
            benchmarks = benchmarks + [
                b for b in parent_benchmarks 
                if b.name not in [x.name for x in benchmarks]
            ]
    
    return benchmarks


def get_primary_benchmark(
    jurisdiction_code: str,
    domain: str
) -> Optional[RegulatorySource]:
    """Get the primary benchmark for a jurisdiction and domain."""
    benchmarks = get_benchmarks_for_jurisdiction(jurisdiction_code, domain)
    
    for benchmark in benchmarks:
        if benchmark.is_primary:
            return benchmark
    
    # Return first if no primary marked
    return benchmarks[0] if benchmarks else None


def get_jurisdictions_by_language(language: str) -> List[JurisdictionConfig]:
    """Get all jurisdictions that support a specific language."""
    return [
        config for config in JURISDICTION_REGISTRY.values()
        if language in config.supported_languages
    ]
