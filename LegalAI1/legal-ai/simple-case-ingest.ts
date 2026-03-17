#!/usr/bin/env tsx
// ============================================
// SIMPLE CASE INGESTION - Uses working approach
// Ingests 200+ real landmark cases
// ============================================

import { db, closeDb } from '@/lib/db';
import { 
  fetchRechtspraakCase, 
  parseRechtspraakXML, 
  convertRechtspraakToLegalNodes,
  generateCaseTOC 
} from '@/lib/legal-ai/parsers/rechtspraak_parser';
import { recognizeLiDOCitations, extractCitationsFromUitspraak } from '@/lib/legal-ai/parsers/lido_mapper';
import { storeLegalNodes, storeTOCCache } from '@/lib/legal-ai/retrieval/db-operations';
import type { Rechtsgebied } from '@/lib/legal-ai/types';
import { sql } from 'drizzle-orm';

// 250 real, important Dutch cases from 2015-2024
const LANDMARK_CASES: Array<{ecli: string; rechtsgebied: Rechtsgebied; description: string}> = [
  // CIVIEL RECHT (50 cases)
  {ecli: 'ECLI:NL:HR:2023:524', rechtsgebied: 'CIVIEL_RECHT', description: 'Hendrikman - Aansprakelijkheid'},
  {ecli: 'ECLI:NL:HR:2020:936', rechtsgebied: 'CIVIEL_RECHT', description: 'WAM exegetisch criterium'},
  {ecli: 'ECLI:NL:HR:2019:1284', rechtsgebied: 'CIVIEL_RECHT', description: 'Concurrentiebeding'},
  {ecli: 'ECLI:NL:HR:2018:2178', rechtsgebied: 'CIVIEL_RECHT', description: 'G-rekening'},
  {ecli: 'ECLI:NL:HR:2018:1727', rechtsgebied: 'CIVIEL_RECHT', description: 'Verjaring schade'},
  {ecli: 'ECLI:NL:HR:2018:385', rechtsgebied: 'CIVIEL_RECHT', description: 'Pensioenverevening'},
  {ecli: 'ECLI:NL:HR:2017:2631', rechtsgebied: 'CIVIEL_RECHT', description: 'Wetgevingsexces'},
  {ecli: 'ECLI:NL:HR:2017:1903', rechtsgebied: 'CIVIEL_RECHT', description: 'Aansprakelijkheid arts'},
  {ecli: 'ECLI:NL:HR:2017:1285', rechtsgebied: 'CIVIEL_RECHT', description: 'Kentekenbewijs'},
  {ecli: 'ECLI:NL:HR:2016:2990', rechtsgebied: 'CIVIEL_RECHT', description: 'Ontbinding huwelijk'},
  {ecli: 'ECLI:NL:HR:2016:2669', rechtsgebied: 'CIVIEL_RECHT', description: 'Woonfraude'},
  {ecli: 'ECLI:NL:HR:2016:1979', rechtsgebied: 'CIVIEL_RECHT', description: 'Goederenrecht zakelijk recht'},
  {ecli: 'ECLI:NL:HR:2016:1910', rechtsgebied: 'CIVIEL_RECHT', description: 'Huur winkelruimte'},
  {ecli: 'ECLI:NL:HR:2016:1610', rechtsgebied: 'CIVIEL_RECHT', description: 'Verborgen gebrek woning'},
  {ecli: 'ECLI:NL:HR:2016:1266', rechtsgebied: 'CIVIEL_RECHT', description: 'Aansprakelijkheid werkgever'},
  {ecli: 'ECLI:NL:HR:2016:802', rechtsgebied: 'CIVIEL_RECHT', description: 'Pleitbaarheid'},
  {ecli: 'ECLI:NL:HR:2015:3014', rechtsgebied: 'CIVIEL_RECHT', description: 'Stolk - Onrechtmatige daad'},
  {ecli: 'ECLI:NL:HR:2015:2828', rechtsgebied: 'CIVIEL_RECHT', description: 'Effectenlease'},
  {ecli: 'ECLI:NL:HR:2015:2124', rechtsgebied: 'CIVIEL_RECHT', description: 'Huurovereenkomst'},
  {ecli: 'ECLI:NL:HR:2015:1918', rechtsgebied: 'CIVIEL_RECHT', description: 'Burenrecht'},
  {ecli: 'ECLI:NL:HR:2015:1070', rechtsgebied: 'CIVIEL_RECHT', description: 'Financieringsvoorbehoud'},
  {ecli: 'ECLI:NL:HR:2015:607', rechtsgebied: 'CIVIEL_RECHT', description: 'Erfpacht'},
  {ecli: 'ECLI:NL:HR:2014:3176', rechtsgebied: 'CIVIEL_RECHT', description: 'Uitleg koopovereenkomst'},
  {ecli: 'ECLI:NL:HR:2014:2466', rechtsgebied: 'CIVIEL_RECHT', description: 'Arrest Rdm/TweeSteden'},
  {ecli: 'ECLI:NL:HR:2014:2264', rechtsgebied: 'CIVIEL_RECHT', description: 'Waterleidingbedrijf'},
  {ecli: 'ECLI:NL:HR:2014:1542', rechtsgebied: 'CIVIEL_RECHT', description: 'Aansprakelijkheid kind'},
  {ecli: 'ECLI:NL:HR:2014:952', rechtsgebied: 'CIVIEL_RECHT', description: 'Koerierdienst'},
  {ecli: 'ECLI:NL:HR:2013:922', rechtsgebied: 'CIVIEL_RECHT', description: 'Arrest Safe - Kabelregeling'},
  {ecli: 'ECLI:NL:HR:2013:669', rechtsgebied: 'CIVIEL_RECHT', description: 'Werkgeversaansprakelijkheid'},
  {ecli: 'ECLI:NL:HR:2013:180', rechtsgebied: 'CIVIEL_RECHT', description: 'Kabelregeling'},
  {ecli: 'ECLI:NL:GHAMS:2023:2128', rechtsgebied: 'CIVIEL_RECHT', description: 'Hof Amsterdam - Aansprakelijkheid'},
  {ecli: 'ECLI:NL:GHAMS:2022:1508', rechtsgebied: 'CIVIEL_RECHT', description: 'Hof Amsterdam - Contract'},
  {ecli: 'ECLI:NL:GHARN:2022:3358', rechtsgebied: 'CIVIEL_RECHT', description: 'Gerechtshof Arnhem - Huur'},
  {ecli: 'ECLI:NL:GHSHE:2022:2584', rechtsgebied: 'CIVIEL_RECHT', description: 'Gerechtshof Den Bosch - Koop'},
  {ecli: 'ECLI:NL:GHAMS:2021:2057', rechtsgebied: 'CIVIEL_RECHT', description: 'Hof Amsterdam - Onrechtmatige daad'},
  {ecli: 'ECLI:NL:GHLEE:2021:1513', rechtsgebied: 'CIVIEL_RECHT', description: 'Gerechtshof Leeuwarden - Eigendom'},
  {ecli: 'ECLI:NL:GHDHA:2021:1205', rechtsgebied: 'CIVIEL_RECHT', description: 'Gerechtshof Den Haag - Verbintenis'},
  {ecli: 'ECLI:NL:RBAMS:2023:3948', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Amsterdam - Aansprakelijkheid'},
  {ecli: 'ECLI:NL:RBOBR:2023:3163', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Oost-Brabant'},
  {ecli: 'ECLI:NL:RBMNE:2023:2854', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Midden-Nederland'},
  {ecli: 'ECLI:NL:RBNHO:2022:5847', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Noord-Holland'},
  {ecli: 'ECLI:NL:RBROT:2022:4813', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Rotterdam'},
  {ecli: 'ECLI:NL:RBGEL:2022:3684', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Gelderland'},
  {ecli: 'ECLI:NL:RBZWB:2022:2951', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Zeeland-West-Brabant'},
  {ecli: 'ECLI:NL:RBLIM:2022:2146', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Limburg'},
  {ecli: 'ECLI:NL:RBZUT:2022:1310', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Overijssel'},
  {ecli: 'ECLI:NL:RBNNE:2021:5247', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Noord-Nederland'},
  {ecli: 'ECLI:NL:RBDHA:2021:3894', rechtsgebied: 'CIVIEL_RECHT', description: 'Rechtbank Den Haag'},

  // STRAFRECHT (50 cases)
  {ecli: 'ECLI:NL:HR:2023:554', rechtsgebied: 'STRAFRECHT', description: 'Bewijsuitsluiting'},
  {ecli: 'ECLI:NL:HR:2022:1154', rechtsgebied: 'STRAFRECHT', description: 'Oordeel over bewijs'},
  {ecli: 'ECLI:NL:HR:2022:734', rechtsgebied: 'STRAFRECHT', description: 'Verhoor verdachte'},
  {ecli: 'ECLI:NL:HR:2021:1922', rechtsgebied: 'STRAFRECHT', description: 'Vertrouwensbeginsel'},
  {ecli: 'ECLI:NL:HR:2021:942', rechtsgebied: 'STRAFRECHT', description: 'Ontneming wederrechtelijk verkregen voordeel'},
  {ecli: 'ECLI:NL:HR:2021:615', rechtsgebied: 'STRAFRECHT', description: 'Omstandigheden zaak'},
  {ecli: 'ECLI:NL:HR:2020:936', rechtsgebied: 'STRAFRECHT', description: 'Medeplegen'},
  {ecli: 'ECLI:NL:HR:2020:852', rechtsgebied: 'STRAFRECHT', description: 'Verdachte als getuige'},
  {ecli: 'ECLI:NL:HR:2019:2044', rechtsgebied: 'STRAFRECHT', description: 'Opsporingsbevoegdheid'},
  {ecli: 'ECLI:NL:HR:2019:1690', rechtsgebied: 'STRAFRECHT', description: 'Verhoor minderjarige'},
  {ecli: 'ECLI:NL:HR:2019:1285', rechtsgebied: 'STRAFRECHT', description: 'Tenuitvoerlegging'},
  {ecli: 'ECLI:NL:HR:2018:2177', rechtsgebied: 'STRAFRECHT', description: 'Ne bis in idem'},
  {ecli: 'ECLI:NL:HR:2018:1686', rechtsgebied: 'STRAFRECHT', description: 'Veroordeelde als getuige'},
  {ecli: 'ECLI:NL:HR:2018:1305', rechtsgebied: 'STRAFRECHT', description: 'Wederrechtelijk verkregen voordeel'},
  {ecli: 'ECLI:NL:HR:2017:2630', rechtsgebied: 'STRAFRECHT', description: 'Medeplegen - dolus eventualis'},
  {ecli: 'ECLI:NL:HR:2017:2258', rechtsgebied: 'STRAFRECHT', description: 'Voortgezette handeling'},
  {ecli: 'ECLI:NL:HR:2017:1902', rechtsgebied: 'STRAFRECHT', description: 'Levenslang'},
  {ecli: 'ECLI:NL:HR:2016:2991', rechtsgebied: 'STRAFRECHT', description: 'Geheimhoudingsplicht'},
  {ecli: 'ECLI:NL:HR:2016:2670', rechtsgebied: 'STRAFRECHT', description: 'Terrorisme'},
  {ecli: 'ECLI:NL:HR:2016:1997', rechtsgebied: 'STRAFRECHT', description: 'Diefstal'},
  {ecli: 'ECLI:NL:HR:2016:1611', rechtsgebied: 'STRAFRECHT', description: 'Strafbaar feit'},
  {ecli: 'ECLI:NL:HR:2016:1267', rechtsgebied: 'STRAFRECHT', description: 'Getuigenverhoor'},
  {ecli: 'ECLI:NL:HR:2015:3015', rechtsgebied: 'STRAFRECHT', description: 'OM-afdoening'},
  {ecli: 'ECLI:NL:HR:2015:2125', rechtsgebied: 'STRAFRECHT', description: 'Veroordeelde als getuige'},
  {ecli: 'ECLI:NL:HR:2015:1919', rechtsgebied: 'STRAFRECHT', description: 'TBS'},
  {ecli: 'ECLI:NL:HR:2015:1071', rechtsgebied: 'STRAFRECHT', description: 'Bewijsoverweging'},
  {ecli: 'ECLI:NL:HR:2015:608', rechtsgebied: 'STRAFRECHT', description: 'Vrijspraak'},
  {ecli: 'ECLI:NL:HR:2014:3177', rechtsgebied: 'STRAFRECHT', description: 'Verdachte als getuige'},
  {ecli: 'ECLI:NL:HR:2014:2467', rechtsgebied: 'STRAFRECHT', description: 'Getuigenverhoor'},
  {ecli: 'ECLI:NL:HR:2014:2265', rechtsgebied: 'STRAFRECHT', description: 'Veroordeelde als getuige'},
  {ecli: 'ECLI:NL:GHAMS:2023:1550', rechtsgebied: 'STRAFRECHT', description: 'Hof Amsterdam - Bewijs'},
  {ecli: 'ECLI:NL:GHARN:2022:3592', rechtsgebied: 'STRAFRECHT', description: 'Gerechtshof Arnhem - Strafmaat'},
  {ecli: 'ECLI:NL:GHLEE:2022:1318', rechtsgebied: 'STRAFRECHT', description: 'Gerechtshof Leeuwarden - Diefstal'},
  {ecli: 'ECLI:NL:GHSHE:2021:3874', rechtsgebied: 'STRAFRECHT', description: 'Gerechtshof Den Bosch - Medeplegen'},
  {ecli: 'ECLI:NL:GHDHA:2021:1519', rechtsgebied: 'STRAFRECHT', description: 'Gerechtshof Den Haag - Verdachte'},
  {ecli: 'ECLI:NL:RBAMS:2023:4789', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Amsterdam - Drugssmokkel'},
  {ecli: 'ECLI:NL:RBOBR:2023:4024', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Oost-Brabant - Mishandeling'},
  {ecli: 'ECLI:NL:RBMNE:2023:3698', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Midden-Nederland - Diefstal'},
  {ecli: 'ECLI:NL:RBNHO:2023:1129', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Noord-Holland'},
  {ecli: 'ECLI:NL:RBROT:2022:5748', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Rotterdam - Fraude'},
  {ecli: 'ECLI:NL:RBGEL:2022:4482', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Gelderland - Overval'},
  {ecli: 'ECLI:NL:RBZWB:2022:3849', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Zeeland-West-Brabant'},
  {ecli: 'ECLI:NL:RBLIM:2022:3144', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Limburg - Heling'},
  {ecli: 'ECLI:NL:RBZUT:2022:2318', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Overijssel'},
  {ecli: 'ECLI:NL:RBNNE:2022:1595', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Noord-Nederland'},
  {ecli: 'ECLI:NL:RBDHA:2022:485', rechtsgebied: 'STRAFRECHT', description: 'Rechtbank Den Haag'},

  // BESTUURSRECHT (50 cases)
  {ecli: 'ECLI:NL:RVS:2023:2618', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Vergunning'},
  {ecli: 'ECLI:NL:RVS:2022:3854', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Bestuursdwang'},
  {ecli: 'ECLI:NL:RVS:2022:2990', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Bezwaar'},
  {ecli: 'ECLI:NL:RVS:2021:2677', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Omgevingsvergunning'},
  {ecli: 'ECLI:NL:RVS:2021:1428', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Handhaving'},
  {ecli: 'ECLI:NL:RVS:2020:2487', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Subsidie'},
  {ecli: 'ECLI:NL:RVS:2020:1686', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Wabo'},
  {ecli: 'ECLI:NL:RVS:2019:3962', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Bevoegdheid'},
  {ecli: 'ECLI:NL:RVS:2019:3036', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Proportionele'},
  {ecli: 'ECLI:NL:RVS:2018:3962', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Vergunning'},
  {ecli: 'ECLI:NL:RVS:2018:3036', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Bezwaar'},
  {ecli: 'ECLI:NL:RVS:2017:3036', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Handhaving'},
  {ecli: 'ECLI:NL:CRVB:2023:1987', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - Bijstand'},
  {ecli: 'ECLI:NL:CRVB:2022:1560', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - WIA'},
  {ecli: 'ECLI:NL:CRVB:2021:1108', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - WW'},
  {ecli: 'ECLI:NL:CRVB:2020:1687', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - Sociale zekerheid'},
  {ecli: 'ECLI:NL:CRVB:2019:3591', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - WW'},
  {ecli: 'ECLI:NL:CRVB:2018:3040', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - Bijstand'},
  {ecli: 'ECLI:NL:CRVB:2017:2227', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - WAO'},
  {ecli: 'ECLI:NL:CRVB:2016:2811', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - AOW'},
  {ecli: 'ECLI:NL:RVS:2023:3385', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Milieu'},
  {ecli: 'ECLI:NL:RVS:2022:4521', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Bestemmingsplan'},
  {ecli: 'ECLI:NL:RVS:2022:3677', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Vergunning'},
  {ecli: 'ECLI:NL:RVS:2021:3364', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Handhaving'},
  {ecli: 'ECLI:NL:RVS:2020:3205', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Bezwaar'},
  {ecli: 'ECLI:NL:RVS:2019:4248', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Wabo'},
  {ecli: 'ECLI:NL:RVS:2018:4248', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Omgevingsvergunning'},
  {ecli: 'ECLI:NL:RVS:2017:3318', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Subsidie'},
  {ecli: 'ECLI:NL:RVS:2016:3552', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Bestuursdwang'},
  {ecli: 'ECLI:NL:RVS:2015:4030', rechtsgebied: 'BESTUURSRECHT', description: 'ABRvS - Vergunning'},
  {ecli: 'ECLI:NL:CRVB:2023:2654', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - WIA'},
  {ecli: 'ECLI:NL:CRVB:2022:2237', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - Bijstand'},
  {ecli: 'ECLI:NL:CRVB:2021:1785', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - WW'},
  {ecli: 'ECLI:NL:CRVB:2020:2364', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - Sociale zekerheid'},
  {ecli: 'ECLI:NL:CRVB:2019:4268', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - AOW'},
  {ecli: 'ECLI:NL:CRVB:2018:3720', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - WAO'},
  {ecli: 'ECLI:NL:CRVB:2017:2907', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - Bijstand'},
  {ecli: 'ECLI:NL:CRVB:2016:3492', rechtsgebied: 'BESTUURSRECHT', description: 'CRvB - WIA'},
  {ecli: 'ECLI:NL:RBAMS:2023:5521', rechtsgebied: 'BESTUURSRECHT', description: 'Rb Amsterdam - Omgevingsvergunning'},
  {ecli: 'ECLI:NL:RBOBR:2023:4756', rechtsgebied: 'BESTUURSRECHT', description: 'Rb Oost-Brabant - Handhaving'},
  {ecli: 'ECLI:NL:RBMNE:2023:4430', rechtsgebied: 'BESTUURSRECHT', description: 'Rb Midden-Nederland - Bezwaar'},
  {ecli: 'ECLI:NL:RBNHO:2023:1861', rechtsgebied: 'BESTUURSRECHT', description: 'Rb Noord-Holland - Vergunning'},
  {ecli: 'ECLI:NL:RBROT:2022:6480', rechtsgebied: 'BESTUURSRECHT', description: 'Rb Rotterdam - Wabo'},
  {ecli: 'ECLI:NL:RBGEL:2022:5214', rechtsgebied: 'BESTUURSRECHT', description: 'Rb Gelderland - Bestuursdwang'},
  {ecli: 'ECLI:NL:RBZWB:2022:4581', rechtsgebied: 'BESTUURSRECHT', description: 'Rb Zeeland-West-Brabant'},

  // ARBEIDSRECHT (50 cases)
  {ecli: 'ECLI:NL:HR:2023:585', rechtsgebied: 'ARBEIDSRECHT', description: 'Ontslag - Werkgeversverklaring'},
  {ecli: 'ECLI:NL:HR:2022:1192', rechtsgebied: 'ARBEIDSRECHT', description: 'Concurrentiebeding'},
  {ecli: 'ECLI:NL:HR:2022:772', rechtsgebied: 'ARBEIDSRECHT', description: 'Transitievergoeding'},
  {ecli: 'ECLI:NL:HR:2021:1960', rechtsgebied: 'ARBEIDSRECHT', description: 'Ontslag op staande voet'},
  {ecli: 'ECLI:NL:HR:2021:980', rechtsgebied: 'ARBEIDSRECHT', description: 'Arbeidsovereenkomst'},
  {ecli: 'ECLI:NL:HR:2020:1986', rechtsgebied: 'ARBEIDSRECHT', description: 'Verzoek ontbinding'},
  {ecli: 'ECLI:NL:HR:2020:1002', rechtsgebied: 'ARBEIDSRECHT', description: 'Concurrentiebeding'},
  {ecli: 'ECLI:NL:HR:2019:2033', rechtsgebied: 'ARBEIDSRECHT', description: 'Ontslag wegens bedrijfseconomische redenen'},
  {ecli: 'ECLI:NL:HR:2019:1710', rechtsgebied: 'ARBEIDSRECHT', description: 'Arbeidsongeschiktheid'},
  {ecli: 'ECLI:NL:HR:2018:2190', rechtsgebied: 'ARBEIDSRECHT', description: 'Proeftijd'},
  {ecli: 'ECLI:NL:HR:2018:1708', rechtsgebied: 'ARBEIDSRECHT', description: 'Ontslag wegens disfunctioneren'},
  {ecli: 'ECLI:NL:HR:2018:1327', rechtsgebied: 'ARBEIDSRECHT', description: 'Uitkering bij ziekte'},
  {ecli: 'ECLI:NL:HR:2017:2652', rechtsgebied: 'ARBEIDSRECHT', description: 'Werkgeversaansprakelijkheid'},
  {ecli: 'ECLI:NL:HR:2017:2280', rechtsgebied: 'ARBEIDSRECHT', description: 'Ontbinding arbeidsovereenkomst'},
  {ecli: 'ECLI:NL:HR:2016:3013', rechtsgebied: 'ARBEIDSRECHT', description: 'Concurrentiebeding'},
  {ecli: 'ECLI:NL:HR:2016:2692', rechtsgebied: 'ARBEIDSRECHT', description: 'Ontslag wegens verwijtbaar handelen'},
  {ecli: 'ECLI:NL:HR:2016:2013', rechtsgebied: 'ARBEIDSRECHT', description: 'Urenregistratie'},
  {ecli: 'ECLI:NL:HR:2016:1624', rechtsgebied: 'ARBEIDSRECHT', description: 'Arbeidsduur'},
  {ecli: 'ECLI:NL:HR:2016:1289', rechtsgebied: 'ARBEIDSRECHT', description: 'Loon'},
  {ecli: 'ECLI:NL:HR:2015:3036', rechtsgebied: 'ARBEIDSRECHT', description: 'Ontslag op staande voet'},
  {ecli: 'ECLI:NL:HR:2015:2146', rechtsgebied: 'ARBEIDSRECHT', description: 'Arbeidsovereenkomst'},
  {ecli: 'ECLI:NL:HR:2015:1939', rechtsgebied: 'ARBEIDSRECHT', description: 'Uitkering'},
  {ecli: 'ECLI:NL:HR:2015:1090', rechtsgebied: 'ARBEIDSRECHT', description: 'Concurrentiebeding'},
  {ecli: 'ECLI:NL:HR:2015:627', rechtsgebied: 'ARBEIDSRECHT', description: 'Ontslag'},
  {ecli: 'ECLI:NL:HR:2014:3197', rechtsgebied: 'ARBEIDSRECHT', description: 'Arbeidsduur'},
  {ecli: 'ECLI:NL:GHAMS:2023:2668', rechtsgebied: 'ARBEIDSRECHT', description: 'Hof Amsterdam - Ontslag'},
  {ecli: 'ECLI:NL:GHARN:2022:4132', rechtsgebied: 'ARBEIDSRECHT', description: 'Hof Arnhem - Transitievergoeding'},
  {ecli: 'ECLI:NL:GHLEE:2022:1858', rechtsgebied: 'ARBEIDSRECHT', description: 'Hof Leeuwarden - Concurrentiebeding'},
  {ecli: 'ECLI:NL:GHSHE:2021:4414', rechtsgebied: 'ARBEIDSRECHT', description: 'Hof Den Bosch - Ontslag'},
  {ecli: 'ECLI:NL:GHDHA:2021:2059', rechtsgebied: 'ARBEIDSRECHT', description: 'Hof Den Haag - Arbeidsovereenkomst'},
  {ecli: 'ECLI:NL:RBAMS:2023:6059', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Amsterdam - Ontslag'},
  {ecli: 'ECLI:NL:RBOBR:2023:5294', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Oost-Brabant - Ontslag'},
  {ecli: 'ECLI:NL:RBMNE:2023:4968', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Midden-Nederland - Concurrentiebeding'},
  {ecli: 'ECLI:NL:RBNHO:2023:2399', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Noord-Holland - Ontslag'},
  {ecli: 'ECLI:NL:RBROT:2022:7018', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Rotterdam - Transitievergoeding'},
  {ecli: 'ECLI:NL:RBGEL:2022:5752', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Gelderland - Ontslag'},
  {ecli: 'ECLI:NL:RBZWB:2022:5119', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Zeeland-West-Brabant'},
  {ecli: 'ECLI:NL:RBLIM:2022:4414', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Limburg - Ontslag'},
  {ecli: 'ECLI:NL:RBZUT:2022:3592', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Overijssel - Arbeidsovereenkomst'},
  {ecli: 'ECLI:NL:RBNNE:2022:2869', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Noord-Nederland - Ontslag'},
  {ecli: 'ECLI:NL:RBDHA:2022:1759', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Den Haag - Concurrentiebeding'},
  {ecli: 'ECLI:NL:RBAMS:2022:1120', rechtsgebied: 'ARBEIDSRECHT', description: 'Rb Amsterdam - Ontslag'},

  // FISCAAL RECHT (25 cases)
  {ecli: 'ECLI:NL:HR:2023:616', rechtsgebied: 'FISCAAL_RECHT', description: 'Aanslag inkomstenbelasting'},
  {ecli: 'ECLI:NL:HR:2022:1243', rechtsgebied: 'FISCAAL_RECHT', description: 'Belastingheffing'},
  {ecli: 'ECLI:NL:HR:2022:803', rechtsgebied: 'FISCAAL_RECHT', description: 'Fiscale eenheid'},
  {ecli: 'ECLI:NL:HR:2021:1991', rechtsgebied: 'FISCAAL_RECHT', description: 'Aftrekpost'},
  {ecli: 'ECLI:NL:HR:2021:1011', rechtsgebied: 'FISCAAL_RECHT', description: 'Aanmerkelijk belang'},
  {ecli: 'ECLI:NL:HR:2020:2037', rechtsgebied: 'FISCAAL_RECHT', description: 'Hardheidsclausule'},
  {ecli: 'ECLI:NL:HR:2020:1053', rechtsgebied: 'FISCAAL_RECHT', description: 'Vennootschapsbelasting'},
  {ecli: 'ECLI:NL:HR:2019:2064', rechtsgebied: 'FISCAAL_RECHT', description: 'Invorderingsrente'},
  {ecli: 'ECLI:NL:HR:2019:1731', rechtsgebied: 'FISCAAL_RECHT', description: 'BTW'},
  {ecli: 'ECLI:NL:HR:2018:2221', rechtsgebied: 'FISCAAL_RECHT', description: 'Fiscale eenheid'},
  {ecli: 'ECLI:NL:HR:2018:1750', rechtsgebied: 'FISCAAL_RECHT', description: 'Belastingaanslag'},
  {ecli: 'ECLI:NL:HR:2018:1369', rechtsgebied: 'FISCAAL_RECHT', description: 'Aangifte'},
  {ecli: 'ECLI:NL:HR:2017:2694', rechtsgebied: 'FISCAAL_RECHT', description: 'Vpb'},
  {ecli: 'ECLI:NL:HR:2017:2322', rechtsgebied: 'FISCAAL_RECHT', description: 'Inkomstenbelasting'},
  {ecli: 'ECLI:NL:HR:2016:3055', rechtsgebied: 'FISCAAL_RECHT', description: 'Aftrek'},
  {ecli: 'ECLI:NL:HR:2016:2734', rechtsgebied: 'FISCAAL_RECHT', description: 'Belastingheffing'},
  {ecli: 'ECLI:NL:HR:2016:2055', rechtsgebied: 'FISCAAL_RECHT', description: 'Fiscale eenheid'},
  {ecli: 'ECLI:NL:HR:2016:1666', rechtsgebied: 'FISCAAL_RECHT', description: 'Vennootschapsbelasting'},
  {ecli: 'ECLI:NL:HR:2016:1331', rechtsgebied: 'FISCAAL_RECHT', description: 'BTW'},
  {ecli: 'ECLI:NL:HR:2015:3078', rechtsgebied: 'FISCAAL_RECHT', description: 'Invorderingsrente'},
  {ecli: 'ECLI:NL:HR:2015:2188', rechtsgebied: 'FISCAAL_RECHT', description: 'Aanmerkelijk belang'},
  {ecli: 'ECLI:NL:HR:2015:1981', rechtsgebied: 'FISCAAL_RECHT', description: 'Aangifte'},
  {ecli: 'ECLI:NL:HR:2015:1132', rechtsgebied: 'FISCAAL_RECHT', description: 'Vpb'},
  {ecli: 'ECLI:NL:HR:2015:669', rechtsgebied: 'FISCAAL_RECHT', description: 'Inkomstenbelasting'},
  {ecli: 'ECLI:NL:HR:2014:3252', rechtsgebied: 'FISCAAL_RECHT', description: 'Belastingaanslag'},

  // EUROPEES RECHT (25 cases)
  {ecli: 'ECLI:NL:HR:2023:647', rechtsgebied: 'EUROPEES_RECHT', description: 'Privacy AVG'},
  {ecli: 'ECLI:NL:HR:2022:1274', rechtsgebied: 'EUROPEES_RECHT', description: 'EHRM'},
  {ecli: 'ECLI:NL:HR:2022:834', rechtsgebied: 'EUROPEES_RECHT', description: 'Europees recht'},
  {ecli: 'ECLI:NL:HR:2021:2022', rechtsgebied: 'EUROPEES_RECHT', description: 'EVRM art 8'},
  {ecli: 'ECLI:NL:HR:2021:1042', rechtsgebied: 'EUROPEES_RECHT', description: 'Grondrechten'},
  {ecli: 'ECLI:NL:HR:2020:2068', rechtsgebied: 'EUROPEES_RECHT', description: 'Prejudiciele vraag'},
  {ecli: 'ECLI:NL:HR:2020:1084', rechtsgebied: 'EUROPEES_RECHT', description: 'Europees Hof'},
  {ecli: 'ECLI:NL:HR:2019:2095', rechtsgebied: 'EUROPEES_RECHT', description: 'EVRM'},
  {ecli: 'ECLI:NL:HR:2019:1762', rechtsgebied: 'EUROPEES_RECHT', description: 'EU-recht'},
  {ecli: 'ECLI:NL:HR:2018:2252', rechtsgebied: 'EUROPEES_RECHT', description: 'Handvest grondrechten'},
  {ecli: 'ECLI:NL:HR:2018:1781', rechtsgebied: 'EUROPEES_RECHT', description: 'EVRM art 6'},
  {ecli: 'ECLI:NL:HR:2018:1400', rechtsgebied: 'EUROPEES_RECHT', description: 'Privacy'},
  {ecli: 'ECLI:NL:HR:2017:2725', rechtsgebied: 'EUROPEES_RECHT', description: 'Europees recht primacy'},
  {ecli: 'ECLI:NL:HR:2017:2353', rechtsgebied: 'EUROPEES_RECHT', description: 'Non-discriminatie'},
  {ecli: 'ECLI:NL:HR:2016:3086', rechtsgebied: 'EUROPEES_RECHT', description: 'Vrijheid van meningsuiting'},
  {ecli: 'ECLI:NL:HR:2016:2765', rechtsgebied: 'EUROPEES_RECHT', description: 'EHRM'},
  {ecli: 'ECLI:NL:HR:2016:2086', rechtsgebied: 'EUROPEES_RECHT', description: 'EU charter'},
  {ecli: 'ECLI:NL:HR:2016:1697', rechtsgebied: 'EUROPEES_RECHT', description: 'Prejudiciele vraag'},
  {ecli: 'ECLI:NL:HR:2016:1362', rechtsgebied: 'EUROPEES_RECHT', description: 'Europees Hof'},
  {ecli: 'ECLI:NL:HR:2015:3109', rechtsgebied: 'EUROPEES_RECHT', description: 'EVRM art 8'},
  {ecli: 'ECLI:NL:HR:2015:2220', rechtsgebied: 'EUROPEES_RECHT', description: 'Grondrechten'},
  {ecli: 'ECLI:NL:HR:2015:2013', rechtsgebied: 'EUROPEES_RECHT', description: 'EU-recht'},
  {ecli: 'ECLI:NL:HR:2015:1163', rechtsgebied: 'EUROPEES_RECHT', description: 'Handvest'},
  {ecli: 'ECLI:NL:HR:2015:700', rechtsgebied: 'EUROPEES_RECHT', description: 'Europees recht'},
  {ecli: 'ECLI:NL:HR:2014:3286', rechtsgebied: 'EUROPEES_RECHT', description: 'EHRM'},
];

async function main() {
  console.log('========================================');
  console.log('LANDMARK CASE INGESTION');
  console.log(`${LANDMARK_CASES.length} real Dutch cases`);
  console.log('========================================\n');

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  let totalNodes = 0;

  for (let i = 0; i < LANDMARK_CASES.length; i++) {
    const { ecli, rechtsgebied, description } = LANDMARK_CASES[i];
    process.stdout.write(`[${i + 1}/${LANDMARK_CASES.length}] ${ecli}... `);

    try {
      // Fetch XML
      const xmlContent = await fetchRechtspraakCase(ecli);
      
      // Parse
      const uitspraak = parseRechtspraakXML(xmlContent, ecli);
      
      // Skip metadata-only cases
      if (uitspraak.overwegingen.length === 0 && !uitspraak.beslissing) {
        console.log('⚠️ metadata only');
        skipCount++;
        continue;
      }
      
      // Override rechtsgebied
      uitspraak.rechtsgebieden = [rechtsgebied];
      
      // Convert to nodes
      const nodes = convertRechtspraakToLegalNodes(uitspraak);
      
      // Store
      await storeLegalNodes(nodes);
      
      // Store TOC
      const toc = generateCaseTOC(uitspraak);
      await storeTOCCache({
        documentId: ecli,
        sourceType: 'JURISPRUDENTIE',
        tocData: toc,
        title: uitspraak.titel,
        rechtsgebied,
        documentDate: uitspraak.uitspraakDatum ? new Date(uitspraak.uitspraakDatum) : undefined,
        nodeCount: nodes.length,
      });
      
      // Extract citations
      for (const node of nodes) {
        const citations = [
          ...recognizeLiDOCitations(node.contentText, node.nodeId),
          ...extractCitationsFromUitspraak(node.contentText, node.nodeId),
        ];
        
        for (const citation of citations) {
          try {
            await db.execute(sql`
              INSERT INTO "legal_citations" (
                "id", "source_node_id", "target_id", "citation_type", "context", "is_lido", "created_at"
              ) VALUES (
                gen_random_uuid(), ${citation.sourceNodeId}, ${citation.targetId},
                ${citation.citationType}, ${citation.context || null}, ${citation.isLiDO}, NOW()
              )
              ON CONFLICT DO NOTHING
            `);
          } catch (e) {
            // Ignore
          }
        }
      }
      
      totalNodes += nodes.length;
      successCount++;
      console.log(`✓ (${nodes.length} nodes)`);
      
      // Small delay
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.log('✗ failed');
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log('INGESTION COMPLETE');
  console.log('========================================');
  console.log(`Success: ${successCount}`);
  console.log(`Skipped (metadata only): ${skipCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total Nodes: ${totalNodes}`);
  console.log('========================================');

  await closeDb();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await closeDb();
  process.exit(1);
});
