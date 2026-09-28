'use strict';
// Epochen – Grenzen und Staaten zum 1. Januar 1936.
// Zuordnung: moderne Natural-Earth-Region (adm0_a3 + Name) -> Staat von 1936.
// Wo eine alte Grenze quer durch moderne Regionen laeuft, wird die Region mit der
// historischen Karte von 1938 (historical-basemaps) zerschnitten (SCHNITT).

// Staaten: Kuerzel -> Name, Grundfarbe, Hauptstadt [lon, lat]
const STAATEN = {
  // Europa
  GER:{ n:'Deutsches Reich', f:'#6e6e68', h:[13.40,52.52] },
  AUT:{ n:'Österreich', f:'#e2dfd6', h:[16.37,48.21] },
  CZE:{ n:'Tschechoslowakei', f:'#4f9bb3', h:[14.42,50.08] },
  POL:{ n:'Polen', f:'#c65b7c', h:[21.01,52.23] },
  HUN:{ n:'Ungarn', f:'#d98b3a', h:[19.04,47.50] },
  ROM:{ n:'Rumänien', f:'#d9b43a', h:[26.10,44.43] },
  YUG:{ n:'Jugoslawien', f:'#5b4ba8', h:[20.46,44.80] },
  BUL:{ n:'Bulgarien', f:'#6ba05b', h:[23.32,42.70] },
  GRE:{ n:'Griechenland', f:'#72c2e2', h:[23.73,37.98] },
  ALB:{ n:'Albanien', f:'#8c2d2d', h:[19.82,41.33] },
  TUR:{ n:'Türkei', f:'#7b9b4b', h:[32.85,39.93] },
  ITA:{ n:'Italien', f:'#3f8f4a', h:[12.50,41.90] },
  FRA:{ n:'Frankreich', f:'#3452ab', h:[2.35,48.86] },
  ENG:{ n:'Vereinigtes Königreich', f:'#b8393c', h:[-0.13,51.51] },
  IRE:{ n:'Irland', f:'#5ca35c', h:[-6.26,53.35] },
  SPA:{ n:'Spanien', f:'#d8c55c', h:[-3.70,40.42] },
  POR:{ n:'Portugal', f:'#2f7d55', h:[-9.14,38.72] },
  SWI:{ n:'Schweiz', f:'#c42c2c', h:[7.45,46.95] },
  BEL:{ n:'Belgien', f:'#d9c542', h:[4.35,50.85] },
  HOL:{ n:'Niederlande', f:'#e27b2b', h:[4.90,52.37] },
  LUX:{ n:'Luxemburg', f:'#7cc2d2', h:[6.13,49.61] },
  DEN:{ n:'Dänemark', f:'#a35c3b', h:[12.57,55.68] },
  NOR:{ n:'Norwegen', f:'#cc6d6d', h:[10.75,59.91] },
  SWE:{ n:'Schweden', f:'#3d7cc9', h:[18.07,59.33] },
  FIN:{ n:'Finnland', f:'#e9eef6', h:[24.94,60.17] },
  EST:{ n:'Estland', f:'#3c6c9c', h:[24.75,59.44] },
  LAT:{ n:'Lettland', f:'#8c3c4c', h:[24.11,56.95] },
  LIT:{ n:'Litauen', f:'#d9d16c', h:[23.90,54.90] },
  SOV:{ n:'Sowjetunion', f:'#8e2323', h:[37.62,55.75] },
  ICE:{ n:'Island', f:'#6d8dd2', h:[-21.90,64.14] },
  // Amerika
  USA:{ n:'Vereinigte Staaten', f:'#5d88c8', h:[-77.04,38.90] },
  CAN:{ n:'Kanada', f:'#c2544d', h:[-75.70,45.42] },
  MEX:{ n:'Mexiko', f:'#3c7c5c', h:[-99.13,19.43] },
  GUA:{ n:'Guatemala', f:'#5c9cc2', h:[-90.51,14.63] },
  HON:{ n:'Honduras', f:'#3c7cb2', h:[-87.21,14.07] },
  ELS:{ n:'El Salvador', f:'#3c4cb2', h:[-89.19,13.69] },
  NIC:{ n:'Nicaragua', f:'#aac26c', h:[-86.25,12.13] },
  COS:{ n:'Costa Rica', f:'#c2a2d2', h:[-84.08,9.93] },
  PAN:{ n:'Panama', f:'#b26c8c', h:[-79.52,8.98] },
  CUB:{ n:'Kuba', f:'#2c5c9c', h:[-82.37,23.11] },
  HAI:{ n:'Haiti', f:'#3c3ca2', h:[-72.34,18.54] },
  DOM:{ n:'Dominikanische Republik', f:'#6c6cc2', h:[-69.93,18.49] },
  COL:{ n:'Kolumbien', f:'#d9b94c', h:[-74.07,4.71] },
  VEN:{ n:'Venezuela', f:'#a97c3c', h:[-66.90,10.49] },
  ECU:{ n:'Ecuador', f:'#d9c96c', h:[-78.47,-0.18] },
  PRU:{ n:'Peru', f:'#c96c4c', h:[-77.04,-12.05] },
  BOL:{ n:'Bolivien', f:'#9c7c4c', h:[-68.15,-16.50] },
  CHL:{ n:'Chile', f:'#a24c6c', h:[-70.67,-33.45] },
  ARG:{ n:'Argentinien', f:'#8cbae2', h:[-58.38,-34.60] },
  URU:{ n:'Uruguay', f:'#4c6cc2', h:[-56.16,-34.90] },
  PAR:{ n:'Paraguay', f:'#6c8ca2', h:[-57.58,-25.26] },
  BRA:{ n:'Brasilien', f:'#3c9c4c', h:[-43.20,-22.91] },
  // Afrika, Naher Osten, Asien, Ozeanien
  EGY:{ n:'Ägypten', f:'#c9b26c', h:[31.24,30.04] },
  ETH:{ n:'Äthiopien', f:'#4c9c4c', h:[38.75,9.03] },
  LIB:{ n:'Liberia', f:'#b96c6c', h:[-10.80,6.30] },
  SAF:{ n:'Südafrikanische Union', f:'#6c9c4c', h:[28.19,-25.75] },
  SAU:{ n:'Saudi-Arabien', f:'#4c7c4c', h:[46.72,24.69] },
  YEM:{ n:'Jemen', f:'#9c4c4c', h:[44.21,15.35] },
  OMA:{ n:'Maskat und Oman', f:'#a96c6c', h:[58.41,23.59] },
  IRQ:{ n:'Irak', f:'#9ca26c', h:[44.37,33.31] },
  IRN:{ n:'Iran', f:'#5c8c7c', h:[51.39,35.69] },
  AFG:{ n:'Afghanistan', f:'#6c8c6c', h:[69.21,34.53] },
  NEP:{ n:'Nepal', f:'#8c6c9c', h:[85.32,27.72] },
  BHU:{ n:'Bhutan', f:'#d9a262', h:[89.64,27.47] },
  TIB:{ n:'Tibet', f:'#c9a2c2', h:[91.14,29.65] },
  MON:{ n:'Mongolei', f:'#8c6cc2', h:[106.91,47.92] },
  TAN:{ n:'Tannu-Tuwa', f:'#a2c26c', h:[94.44,51.72] },
  SIA:{ n:'Siam', f:'#4c5cb2', h:[100.50,13.75] },
  PHI:{ n:'Philippinen', f:'#d2d2a2', h:[120.98,14.60] },
  MAN:{ n:'Mandschukuo', f:'#8c7c4c', h:[125.32,43.88], o:'JAP' },
  CHI:{ n:'China', f:'#bb9d3e', h:[118.80,32.06] },
  SIK:{ n:'Sinkiang', f:'#6c8c8c', h:[87.62,43.83] },
  YUN:{ n:'Yunnan', f:'#a27c9c', h:[102.71,25.04] },
  GXC:{ n:'Guangxi-Clique', f:'#6cb2a2', h:[110.29,25.27] },
  XSM:{ n:'Ma-Clique', f:'#9c9c6c', h:[101.78,36.62] },
  SHX:{ n:'Shanxi', f:'#b2826c', h:[112.55,37.87] },
  JAP:{ n:'Japan', f:'#eee2b6', h:[139.69,35.69] },
  RAJ:{ n:'Britisch-Indien', f:'#d98c5f', h:[77.21,28.61], o:'ENG' },
  AST:{ n:'Australien', f:'#4c8c6c', h:[149.13,-35.28] },
  NZL:{ n:'Neuseeland', f:'#3c4c7c', h:[174.78,-41.29] }
};

// Moderne Laender (adm0_a3) -> Staat 1936. null = weglassen (unbewohnt/winzig).
const LAND = {
  DEU:'GER', AUT:'AUT', CZE:'CZE', SVK:'CZE', HUN:'HUN', ROU:'ROM', BIH:'YUG', SRB:'YUG', MNE:'YUG', MKD:'YUG', KOS:'YUG',
  BGR:'BUL', GRC:'GRE', ALB:'ALB', TUR:'TUR', ITA:'ITA', SMR:'ITA', VAT:'ITA', MLT:'ENG', FRA:'FRA', MCO:'FRA', AND:'SPA',
  GBR:'ENG', IMN:'ENG', JEY:'ENG', GGY:'ENG', GIB:'ENG', IRL:'IRE', ESP:'SPA', PRT:'POR', CHE:'SWI', LIE:'SWI', BEL:'BEL',
  NLD:'HOL', LUX:'LUX', DNK:'DEN', FRO:'DEN', GRL:'DEN', NOR:'NOR', SWE:'SWE', ALD:'FIN', FIN:'FIN', EST:'EST', LVA:'LAT',
  LTU:'LIT', POL:'POL', BLR:'SOV', UKR:'SOV', MDA:'ROM', RUS:'SOV', ISL:'ICE', CYP:'ENG', CYN:'ENG', ESB:'ENG', WSB:'ENG',
  SVN:'YUG', HRV:'YUG', GEO:'SOV', ARM:'SOV', AZE:'SOV', KAZ:'SOV', UZB:'SOV', TKM:'SOV', KGZ:'SOV', TJK:'SOV', KAB:'SOV',
  SYR:'FRA', LBN:'FRA', ISR:'ENG', PSX:'ENG', JOR:'ENG', IRQ:'IRQ', KWT:'ENG', SAU:'SAU', YEM:'YEM', OMN:'OMA', ARE:'ENG',
  QAT:'ENG', BHR:'ENG', IRN:'IRN', AFG:'AFG',
  PAK:'RAJ', IND:'RAJ', BGD:'RAJ', LKA:'ENG', MMR:'RAJ', MDV:'ENG', KAS:'RAJ', NPL:'NEP', BTN:'BHU', CHN:'CHI', HKG:'ENG',
  MAC:'POR', TWN:'JAP', MNG:'MON', PRK:'JAP', KOR:'JAP', JPN:'JAP', VNM:'FRA', LAO:'FRA', KHM:'FRA', THA:'SIA', MYS:'ENG',
  SGP:'ENG', BRN:'ENG', IDN:'HOL', TLS:'POR', PHL:'PHI', PGA:null,
  AUS:'AST', NZL:'NZL', PNG:'AST', SLB:'ENG', VUT:'FRA', NCL:'FRA', FJI:'ENG', WSM:'NZL', ASM:'USA', TON:'ENG', PYF:'FRA',
  COK:'NZL', NIU:'NZL', KIR:'ENG', TUV:'ENG', NRU:'AST', MHL:'JAP', FSM:'JAP', PLW:'JAP', MNP:'JAP', GUM:'USA', UMI:'USA',
  WLF:'FRA', PCN:'ENG', NFK:'AST', CSI:null, ATC:null, IOA:'AST', HMD:null, ATF:null, ATA:null,
  EGY:'EGY', LBY:'ITA', TUN:'FRA', DZA:'FRA', MAR:'FRA', SAH:'SPA', MRT:'FRA', SEN:'FRA', MLI:'FRA', GIN:'FRA', CIV:'FRA',
  BFA:'FRA', NER:'FRA', BEN:'FRA', TGO:'FRA', GHA:'ENG', NGA:'ENG', CMR:'FRA', TCD:'FRA', CAF:'FRA', GAB:'FRA', COG:'FRA',
  GNQ:'SPA', STP:'POR', COD:'BEL', RWA:'BEL', BDI:'BEL', AGO:'POR', NAM:'SAF', ZAF:'SAF', BWA:'ENG', LSO:'ENG', SWZ:'ENG',
  ZWE:'ENG', ZMB:'ENG', MWI:'ENG', MOZ:'POR', TZA:'ENG', KEN:'ENG', UGA:'ENG', SDN:'ENG', SDS:'ENG', ERI:'ITA', ETH:'ETH',
  DJI:'FRA', SOL:'ENG', SOM:'ITA', MDG:'FRA', COM:'FRA', MUS:'ENG', SYC:'ENG', CPV:'POR', GNB:'POR', GMB:'ENG', SLE:'ENG',
  LBR:'LIB', SHN:'ENG', IOT:'ENG', SGS:'ENG', FLK:'ENG',
  USA:'USA', CAN:'CAN', MEX:'MEX', GTM:'GUA', BLZ:'ENG', HND:'HON', SLV:'ELS', NIC:'NIC', CRI:'COS', PAN:'PAN', CUB:'CUB',
  USG:'USA', HTI:'HAI', DOM:'DOM', PRI:'USA', VIR:'USA', JAM:'ENG', BHS:'ENG', TCA:'ENG', CYM:'ENG', BMU:'ENG', VGB:'ENG',
  AIA:'ENG', KNA:'ENG', ATG:'ENG', MSR:'ENG', DMA:'ENG', LCA:'ENG', VCT:'ENG', GRD:'ENG', BRB:'ENG', TTO:'ENG', BLM:'FRA',
  MAF:'FRA', SXM:'HOL', CUW:'HOL', ABW:'HOL', COL:'COL', VEN:'VEN', GUY:'ENG', SUR:'HOL', ECU:'ECU', PER:'PRU', BOL:'BOL',
  CHL:'CHL', ARG:'ARG', URY:'URU', PRY:'PAR', BRA:'BRA', SPM:'FRA', CLP:null
};

// Einzelne Regionen, die 1936 anders lagen ('ADM0/Name')
const REGION = {
  'POL/Warmian-Masurian':'GER', // Quelle 1938 fuehrt Ostpreussen faelschlich als polnisch
  'RUS/Kaliningrad':'GER', 'RUS/Tuva':'TAN',
  'UKR/Transcarpathia':'CZE',
  'BGR/Dobrich':'ROM', 'BGR/Silistra':'ROM',
  'TUR/Hatay':'FRA',
  'CHN/Xinjiang':'SIK', 'CHN/Xizang':'TIB', 'CHN/Yunnan':'YUN', 'CHN/Guangxi':'GXC', 'CHN/Qinghai':'XSM', 'CHN/Ningxia':'XSM',
  'CHN/Shanxi':'SHX', 'CHN/Heilongjiang':'MAN', 'CHN/Jilin':'MAN', 'CHN/Liaoning':'MAN', 'CHN/Paracel Islands':null,
  'YEM/Hadramawt':'ENG', 'YEM/Al Mahrah':'ENG', 'YEM/Lahij':'ENG', 'YEM/`Adan':'ENG', 'YEM/Abyan':'ENG', 'YEM/Shabwah':'ENG',
  "YEM/Al Dali'":'ENG',
  'MAR/Tanger - Tétouan':'SPA', 'MAR/Laâyoune - Boujdour - Sakia El Hamra':'SPA', 'MAR/Oued el Dahab':'SPA',
  'CMR/Nord-Ouest':'ENG', 'CMR/Sud-Ouest':'ENG',
  'CAN/Newfoundland and Labrador':'ENG',
  'MDA/Camenca':'SOV', 'MDA/Stîngă Nistrului':'SOV', 'MDA/Grigoriopol':'SOV', 'MDA/Transnistria':'SOV'
};

// Regeln fuer Teilstuecke grosser Regionen (Mittelpunkt lon/lat)
function regel(adm0, name, lon, lat){
  if (adm0 === 'CHN' && name === 'Inner Mongol') return lon >= 117.5 ? 'MAN' : 'CHI';
  if (adm0 === 'RUS' && name === 'Sakhalin') return (lat < 50 || lon > 145) ? 'JAP' : 'SOV';
  return undefined;
}

// Regionen, die entlang der Karte von 1938 zerschnitten werden
const SCHNITT_LAENDER = new Set(['POL','LTU','BLR','SVN']);
const SCHNITT_REGIONEN = new Set([
  "UKR/Volyn","UKR/Rivne","UKR/L'viv","UKR/Ternopil'","UKR/Ivano-Frankivs'k","UKR/Khmel'nyts'kyy","UKR/Zhytomyr",
  'UKR/Odessa','UKR/Chernivtsi',
  'RUS/Leningrad','RUS/Karelia','RUS/Murmansk','RUS/Pskov',
  'HRV/Istarska','HRV/Primorsko-Goranska','HRV/Zadarska'
]);
// Namen in der Karte von 1938 -> Staat
const NAMEN_1938 = {
  'Germany':'GER', 'Poland':'POL', 'Lithuania':'LIT', 'Latvia':'LAT', 'Estonia':'EST', 'Finland':'FIN', 'USSR':'SOV',
  'Romania':'ROM', 'Italy':'ITA', 'Yugoslavia':'YUG', 'Hungary':'HUN', 'Czechoslovakia':'CZE'
};

// Namen, die 1936 anders lauteten (Anfang des Provinznamens)
const NAMEN = {
  'Kaliningrad':'Königsberg', 'Wolgograd':'Stalingrad', 'Sankt Petersburg':'Leningrad', 'Nischni Nowgorod':'Gorki',
  'Samara':'Kuibyschew', 'Twer':'Kalinin', 'Donezk':'Stalino', 'Luhansk':'Woroschilowgrad', 'Wilnius':'Wilna', 'Vilnius':'Wilna',
  'Hrodna':'Grodno', 'Lwiw':'Lemberg', 'Lviv':'Lemberg', 'Taiwan':'Formosa', 'Tschennai':'Madras', 'Chennai':'Madras',
  'Kolkata':'Kalkutta', 'Mumbai':'Bombay',
  // Britisch-Indien: Provinzen und Fuerstenstaaten statt heutiger Bundesstaaten
  'Maharashtra':'Bombay', 'Tamil Nadu':'Madras', 'Andhra Pradesh':'Andhra', 'Telangana':'Hyderabad', 'Karnataka':'Mysore',
  'Kerala':'Travancore', 'Madhya Pradesh':'Zentralprovinzen', 'Uttar Pradesh':'Vereinigte Provinzen', 'Uttarakhand':'Kumaon',
  'Odisha':'Orissa', 'Jharkhand':'Chota Nagpur', 'Westbengalen':'Bengalen', 'Dhaka':'Dacca', 'Rajasthan':'Rajputana',
  'Khyber Pakhtunkhwa':'Nordwest-Grenzprovinz', 'Gilgit-Baltistan':'Gilgit', 'Arunachal Pradesh':'Nordostgrenze',
  'Himachal Pradesh':'Punjab-Bergstaaten', 'Haryana':'Punjab Südost', 'Tanintharyi':'Tenasserim', 'Magway':'Magwe',
  'Nunavut':'Nordwest-Territorien', 'Almaty':'Alma-Ata', 'Bischkek':'Frunse', 'Duschanbe':'Stalinabad'
};

// Namen der Hauptstaedte 1936
const HAUPTSTADT = {
  GER:'Berlin', AUT:'Wien', CZE:'Prag', POL:'Warschau', HUN:'Budapest', ROM:'Bukarest', YUG:'Belgrad', BUL:'Sofia', GRE:'Athen',
  ALB:'Tirana', TUR:'Ankara', ITA:'Rom', FRA:'Paris', ENG:'London', IRE:'Dublin', SPA:'Madrid', POR:'Lissabon', SWI:'Bern',
  BEL:'Brüssel', HOL:'Amsterdam', LUX:'Luxemburg', DEN:'Kopenhagen', NOR:'Oslo', SWE:'Stockholm', FIN:'Helsinki', EST:'Tallinn',
  LAT:'Riga', LIT:'Kaunas', SOV:'Moskau', ICE:'Reykjavík', USA:'Washington', CAN:'Ottawa', MEX:'Mexiko-Stadt',
  GUA:'Guatemala-Stadt', HON:'Tegucigalpa', ELS:'San Salvador', NIC:'Managua', COS:'San José', PAN:'Panama-Stadt', CUB:'Havanna',
  HAI:'Port-au-Prince', DOM:'Ciudad Trujillo', COL:'Bogotá', VEN:'Caracas', ECU:'Quito', PRU:'Lima', BOL:'La Paz', CHL:'Santiago',
  ARG:'Buenos Aires', URU:'Montevideo', PAR:'Asunción', BRA:'Rio de Janeiro', EGY:'Kairo', ETH:'Addis Abeba', LIB:'Monrovia',
  SAF:'Pretoria', SAU:'Riad', YEM:'Sanaa', OMA:'Maskat', IRQ:'Bagdad', IRN:'Teheran', AFG:'Kabul', NEP:'Kathmandu', BHU:'Punakha',
  TIB:'Lhasa', MON:'Ulan Bator', TAN:'Kysyl', SIA:'Bangkok', PHI:'Manila', MAN:'Hsinking', CHI:'Nanking', SIK:'Ürümqi',
  YUN:'Kunming', GXC:'Guilin', XSM:'Xining', SHX:'Taiyuan', JAP:'Tokio', RAJ:'Neu-Delhi', AST:'Canberra', NZL:'Wellington'
};

module.exports = { HAUPTSTADT, NAMEN, STAATEN, LAND, REGION, regel, SCHNITT_LAENDER, SCHNITT_REGIONEN, NAMEN_1938 };
